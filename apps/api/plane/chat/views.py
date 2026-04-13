# Planer custom: Chat API views
import base64
from datetime import timezone

import httpx
from django.utils import timezone as dj_timezone
from rest_framework import status
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated

from plane.authentication.session import BaseSessionAuthentication
from plane.chat.models import Channel, ChannelMember, Message, MessageAttachment
from plane.chat.serializers import (
    ChannelSerializer,
    MessageSerializer,
    MessageAttachmentSerializer,
)
from plane.db.models import Issue


# Mixin for Plane session auth on all chat views
class ChatAuthMixin:
    authentication_classes = [BaseSessionAuthentication]
    permission_classes = [IsAuthenticated]


class ChannelViewSet(ChatAuthMixin, ModelViewSet):
    """CRUD for chat channels within a workspace."""

    serializer_class = ChannelSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        workspace_slug = self.kwargs.get("workspace_slug")
        qs = Channel.objects.filter(
            workspace__slug=workspace_slug, is_archived=False
        ).order_by("name")

        channel_type = self.request.query_params.get("type")
        if channel_type:
            qs = qs.filter(channel_type=channel_type)

        project_id = self.request.query_params.get("project_id")
        if project_id:
            qs = qs.filter(project_id=project_id)

        return qs

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["request"] = self.request
        return ctx

    def perform_create(self, serializer):
        from plane.db.models import Workspace

        ws = Workspace.objects.get(slug=self.kwargs["workspace_slug"])
        channel = serializer.save(workspace=ws)
        ChannelMember.objects.create(
            channel=channel, member=self.request.user, role="admin"
        )

    def perform_destroy(self, instance):
        instance.is_archived = True
        instance.save()


class MessageViewSet(ChatAuthMixin, ModelViewSet):
    """CRUD for messages in a channel."""

    serializer_class = MessageSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        channel_id = self.kwargs.get("channel_id")
        qs = Message.objects.filter(channel_id=channel_id).select_related(
            "actor", "parent"
        ).prefetch_related("attachments", "replies")

        # ?all=true → return all messages (including replies inline)
        if self.request.query_params.get("all") == "true":
            return qs.order_by("created_at")

        # Filter top-level or threaded
        parent_id = self.request.query_params.get("parent_id")
        if parent_id == "null" or parent_id is None:
            qs = qs.filter(parent__isnull=True)
        elif parent_id:
            qs = qs.filter(parent_id=parent_id)

        return qs.order_by("created_at")

    def perform_create(self, serializer):
        channel = Channel.objects.get(id=self.kwargs["channel_id"])
        message = serializer.save(actor=self.request.user, channel=channel)

        # Broadcast via Redis → WebSocket
        from plane.chat.broadcast import broadcast_message
        broadcast_message(str(channel.id), MessageSerializer(message).data)

        # Check for bot commands
        if "@planer" in message.content:
            from plane.chat.bot import PlainerBot

            PlainerBot.process_command_sync(message)

    def perform_update(self, serializer):
        serializer.save(is_edited=True, edited_at=dj_timezone.now())


class MessageReactionView(ChatAuthMixin, APIView):
    """Add/remove reactions on a message."""

    permission_classes = [IsAuthenticated]

    def post(self, request, workspace_slug, channel_id, message_id):
        emoji = request.data.get("emoji")
        if not emoji:
            return Response(
                {"error": "emoji required"}, status=status.HTTP_400_BAD_REQUEST
            )

        message = Message.objects.get(id=message_id, channel_id=channel_id)
        user_id = str(request.user.id)
        reactions = message.reactions or {}

        if emoji not in reactions:
            reactions[emoji] = []
        if user_id in reactions[emoji]:
            reactions[emoji].remove(user_id)
            if not reactions[emoji]:
                del reactions[emoji]
        else:
            reactions[emoji].append(user_id)

        message.reactions = reactions
        message.save(update_fields=["reactions"])
        return Response({"reactions": reactions})


class AttachmentUploadView(ChatAuthMixin, APIView):
    """Upload file attachment to a message."""

    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser]

    def post(self, request, workspace_slug, channel_id, message_id):
        file = request.FILES.get("file")
        if not file:
            return Response(
                {"error": "file required"}, status=status.HTTP_400_BAD_REQUEST
            )

        message = Message.objects.get(id=message_id, channel_id=channel_id)

        # Store file — for now save locally, later integrate MinIO
        # In production this would use Plane's existing asset storage
        file_url = f"/uploads/chat/{workspace_slug}/{channel_id}/{file.name}"

        attachment = MessageAttachment.objects.create(
            message=message,
            file_name=file.name,
            file_url=file_url,
            file_size=file.size,
            file_type=file.content_type or "",
        )

        return Response(
            MessageAttachmentSerializer(attachment).data,
            status=status.HTTP_201_CREATED,
        )


class UnreadCountView(ChatAuthMixin, APIView):
    """Get unread message counts per channel."""

    permission_classes = [IsAuthenticated]

    def get(self, request, workspace_slug):
        memberships = ChannelMember.objects.filter(
            member=request.user,
            channel__workspace__slug=workspace_slug,
            channel__is_archived=False,
        ).select_related("channel")

        results = []
        total = 0
        for m in memberships:
            count = m.channel.messages.filter(
                created_at__gt=m.last_read
            ).count()
            if count > 0:
                results.append(
                    {
                        "channel_id": str(m.channel.id),
                        "channel_name": m.channel.name,
                        "unread_count": count,
                    }
                )
                total += count

        return Response({"results": results, "total_unread": total})


class MarkReadView(ChatAuthMixin, APIView):
    """Mark a channel as read for the current user."""

    permission_classes = [IsAuthenticated]

    def post(self, request, workspace_slug, channel_id):
        membership = ChannelMember.objects.filter(
            channel_id=channel_id, member=request.user
        ).first()
        if membership:
            membership.last_read = dj_timezone.now()
            membership.save(update_fields=["last_read"])
        return Response({"status": "ok"})
