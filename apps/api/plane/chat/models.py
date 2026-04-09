# Planer custom: Chat module models
# Channels, Messages, Attachments — linked to Plane entities

from django.db import models
from plane.db.models.base import BaseModel


class Channel(BaseModel):
    """Chat channel linked to Workspace, Project, or Module."""

    CHANNEL_TYPES = (
        ("general", "Workspace General"),
        ("project", "Project Channel"),
        ("module", "Module Channel"),
        ("direct", "Direct Message"),
    )

    name = models.CharField(max_length=100)
    description = models.TextField(blank=True, default="")
    channel_type = models.CharField(max_length=20, choices=CHANNEL_TYPES)

    workspace = models.ForeignKey(
        "db.Workspace",
        on_delete=models.CASCADE,
        related_name="chat_channels",
    )
    project = models.ForeignKey(
        "db.Project",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="chat_channels",
    )
    module = models.ForeignKey(
        "db.Module",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="chat_channels",
    )

    members = models.ManyToManyField(
        "db.User",
        through="ChannelMember",
        related_name="chat_channels",
    )
    is_archived = models.BooleanField(default=False)

    class Meta:
        verbose_name = "Chat Channel"
        db_table = "chat_channels"
        indexes = [
            models.Index(fields=["workspace", "channel_type"]),
            models.Index(fields=["project"]),
            models.Index(fields=["module"]),
        ]

    def __str__(self):
        return f"#{self.name} ({self.get_channel_type_display()})"


class ChannelMember(BaseModel):
    """Channel membership and preferences."""

    ROLE_CHOICES = (
        ("admin", "Admin"),
        ("member", "Member"),
    )

    channel = models.ForeignKey(
        Channel, on_delete=models.CASCADE, related_name="channel_members"
    )
    member = models.ForeignKey(
        "db.User", on_delete=models.CASCADE, related_name="chat_memberships"
    )
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default="member")
    last_read = models.DateTimeField(auto_now=True)
    notifications = models.BooleanField(default=True)

    class Meta:
        db_table = "chat_channel_members"
        unique_together = ("channel", "member")
        indexes = [models.Index(fields=["channel", "member"])]


class Message(BaseModel):
    """Chat message with threading and reactions."""

    MESSAGE_TYPES = (
        ("user", "User Message"),
        ("bot", "Bot Response"),
        ("system", "System Notification"),
        ("notification", "Plane Notification"),
    )

    channel = models.ForeignKey(
        Channel, on_delete=models.CASCADE, related_name="messages"
    )
    actor = models.ForeignKey(
        "db.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="chat_messages",
    )
    content = models.TextField()
    message_type = models.CharField(
        max_length=20, choices=MESSAGE_TYPES, default="user"
    )

    # Threading
    parent = models.ForeignKey(
        "self",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="replies",
    )

    # Editing
    is_edited = models.BooleanField(default=False)
    edited_at = models.DateTimeField(null=True, blank=True)

    # Reactions & metadata
    reactions = models.JSONField(default=dict, blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    # Link to Plane entities
    issue = models.ForeignKey(
        "db.Issue",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="chat_messages",
    )

    class Meta:
        db_table = "chat_messages"
        ordering = ["created_at"]
        indexes = [
            models.Index(fields=["channel", "created_at"]),
            models.Index(fields=["actor"]),
            models.Index(fields=["parent"]),
        ]

    def __str__(self):
        preview = (
            self.content[:50] + "..." if len(self.content) > 50 else self.content
        )
        actor_name = self.actor.display_name if self.actor else "System"
        return f"[{self.channel.name}] {actor_name}: {preview}"


class MessageAttachment(BaseModel):
    """File attachment (image, PDF, document)."""

    message = models.ForeignKey(
        Message, on_delete=models.CASCADE, related_name="attachments"
    )
    file_name = models.CharField(max_length=255)
    file_url = models.URLField()
    file_size = models.IntegerField(default=0)
    file_type = models.CharField(max_length=100, default="")
    ocr_text = models.TextField(blank=True, default="")

    class Meta:
        db_table = "chat_message_attachments"
        indexes = [models.Index(fields=["message"])]

    def __str__(self):
        return f"{self.file_name} ({self.file_type})"
