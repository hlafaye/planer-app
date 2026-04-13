# Planer custom: Chat serializers
from rest_framework import serializers
from plane.chat.models import Channel, ChannelMember, Message, MessageAttachment


class ChannelMemberSerializer(serializers.ModelSerializer):
    member_name = serializers.CharField(source="member.display_name", read_only=True)
    member_avatar = serializers.CharField(source="member.avatar", read_only=True)

    class Meta:
        model = ChannelMember
        fields = [
            "id", "channel", "member", "member_name", "member_avatar",
            "role", "last_read", "notifications",
        ]
        read_only_fields = ["id"]


class MessageAttachmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = MessageAttachment
        fields = [
            "id", "file_name", "file_url", "file_size", "file_type", "ocr_text",
        ]
        read_only_fields = ["id"]


class MessageSerializer(serializers.ModelSerializer):
    actor_name = serializers.CharField(source="actor.display_name", read_only=True, default="System")
    actor_avatar = serializers.CharField(source="actor.avatar", read_only=True, default="")
    attachments = MessageAttachmentSerializer(many=True, read_only=True)
    reply_count = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = [
            "id", "channel", "actor", "actor_name", "actor_avatar",
            "content", "message_type", "parent",
            "is_edited", "edited_at", "reactions", "metadata",
            "issue", "attachments", "reply_count",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "channel", "actor", "is_edited", "edited_at", "created_at"]

    def get_reply_count(self, obj):
        return obj.replies.count()


class ChannelSerializer(serializers.ModelSerializer):
    member_count = serializers.SerializerMethodField()
    last_message = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()

    class Meta:
        model = Channel
        fields = [
            "id", "name", "description", "channel_type",
            "workspace", "project", "module",
            "is_archived", "member_count", "last_message", "unread_count",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at"]

    def get_member_count(self, obj):
        return obj.channel_members.count()

    def get_last_message(self, obj):
        msg = obj.messages.order_by("-created_at").first()
        if msg:
            return {
                "content": msg.content[:100],
                "actor_name": msg.actor.display_name if msg.actor else "System",
                "created_at": msg.created_at.isoformat(),
            }
        return None

    def get_unread_count(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return 0
        membership = obj.channel_members.filter(member=request.user).first()
        if not membership:
            return 0
        return obj.messages.filter(created_at__gt=membership.last_read).count()
