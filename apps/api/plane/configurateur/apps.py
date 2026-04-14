# Planer custom: Configurateur AO app config
from django.apps import AppConfig


class ConfigurateurConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "plane.configurateur"
    verbose_name = "Configurateur AO"
