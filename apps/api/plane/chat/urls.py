# Planer custom: Chat URL routing
from django.urls import path
from plane.chat.views import (
    ChannelViewSet,
    MessageViewSet,
    MessageReactionView,
    AttachmentUploadView,
    UnreadCountView,
    MarkReadView,
)

# All prefixed with /api/v1/workspaces/<workspace_slug>/chat/

urlpatterns = [
    # Channels
    path(
        "channels/",
        ChannelViewSet.as_view({"get": "list", "post": "create"}),
        name="chat-channels",
    ),
    path(
        "channels/<uuid:pk>/",
        ChannelViewSet.as_view(
            {"get": "retrieve", "patch": "partial_update", "delete": "destroy"}
        ),
        name="chat-channel-detail",
    ),
    # Messages
    path(
        "channels/<uuid:channel_id>/messages/",
        MessageViewSet.as_view({"get": "list", "post": "create"}),
        name="chat-messages",
    ),
    path(
        "channels/<uuid:channel_id>/messages/<uuid:pk>/",
        MessageViewSet.as_view(
            {"get": "retrieve", "patch": "partial_update", "delete": "destroy"}
        ),
        name="chat-message-detail",
    ),
    # Reactions
    path(
        "channels/<uuid:channel_id>/messages/<uuid:message_id>/reactions/",
        MessageReactionView.as_view(),
        name="chat-reactions",
    ),
    # Attachments
    path(
        "channels/<uuid:channel_id>/messages/<uuid:message_id>/attachments/",
        AttachmentUploadView.as_view(),
        name="chat-attachments",
    ),
    # Unread counts
    path("unread/", UnreadCountView.as_view(), name="chat-unread"),
    # Mark read
    path(
        "channels/<uuid:channel_id>/read/",
        MarkReadView.as_view(),
        name="chat-mark-read",
    ),
]
