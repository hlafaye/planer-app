# Planer custom: Chat module app config
from django.apps import AppConfig


class ChatConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "plane.chat"
    verbose_name = "Planer Chat"

    def ready(self):
        import plane.chat.signals  # noqa: F401
