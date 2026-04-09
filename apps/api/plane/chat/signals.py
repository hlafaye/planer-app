# Planer custom: Auto-create channels + broadcast notifications
import logging

from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils.text import slugify

from plane.db.models import Workspace, Project, Module, Issue
from plane.chat.models import Channel, ChannelMember, Message

logger = logging.getLogger(__name__)


@receiver(post_save, sender=Workspace)
def create_workspace_general_channel(sender, instance, created, **kwargs):
    """Auto-create #général channel when workspace is created."""
    if not created:
        return
    channel, ch_created = Channel.objects.get_or_create(
        workspace=instance,
        channel_type="general",
        defaults={
            "name": "général",
            "description": f"Chat général — {instance.name}",
        },
    )
    if ch_created:
        logger.info("Chat: created #général for workspace %s", instance.name)


@receiver(post_save, sender=Project)
def create_project_channel(sender, instance, created, **kwargs):
    """Auto-create #project-slug channel when project is created."""
    if not created:
        return
    channel, ch_created = Channel.objects.get_or_create(
        workspace=instance.workspace,
        project=instance,
        channel_type="project",
        defaults={
            "name": slugify(instance.name)[:100] or instance.identifier.lower(),
            "description": f"Chat projet — {instance.name}",
        },
    )
    if ch_created:
        logger.info("Chat: created #%s for project %s", channel.name, instance.name)


@receiver(post_save, sender=Module)
def create_module_channel(sender, instance, created, **kwargs):
    """Auto-create #module-slug channel when module is created."""
    if not created:
        return
    channel, ch_created = Channel.objects.get_or_create(
        workspace=instance.workspace,
        project=instance.project,
        module=instance,
        channel_type="module",
        defaults={
            "name": slugify(instance.name)[:100] or "module",
            "description": f"Chat module — {instance.name}",
        },
    )
    if ch_created:
        logger.info("Chat: created #%s for module %s", channel.name, instance.name)


@receiver(post_save, sender=Issue)
def broadcast_issue_notification(sender, instance, created, **kwargs):
    """Post system notification to project channel when issue is created."""
    if not created:
        return

    project_channel = Channel.objects.filter(
        project=instance.project, channel_type="project"
    ).first()

    if not project_channel:
        return

    actor = instance.created_by
    actor_name = actor.display_name if actor else "Système"
    issue_key = getattr(instance, "sequence_id", instance.id)

    content = f"📋 {actor_name} a créé #{issue_key}: {instance.name}"

    Message.objects.create(
        channel=project_channel,
        actor=None,
        content=content,
        message_type="notification",
        issue=instance,
        metadata={
            "event": "issue.created",
            "issue_id": str(instance.id),
        },
    )
