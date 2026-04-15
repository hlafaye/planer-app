# Planer custom: Module Devis app config
import os
import threading

from django.apps import AppConfig


class DevisConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "plane.devis"
    verbose_name = "Planer Devis"

    def ready(self):
        # Warmup Ollama model in background on API startup
        if os.environ.get("RUN_MAIN") == "true" or "gunicorn" in os.environ.get("SERVER_SOFTWARE", ""):
            threading.Thread(target=self._warmup_ollama, daemon=True).start()

    @staticmethod
    def _warmup_ollama():
        import time
        time.sleep(10)  # Wait for services to be ready
        try:
            import requests
            ollama_url = os.environ.get("OLLAMA_URL", "http://ollama:11434")
            requests.post(
                "{}/api/generate".format(ollama_url),
                json={
                    "model": "llama3.1:8b",
                    "prompt": "hello",
                    "keep_alive": "30m",
                    "stream": False,
                },
                timeout=120,
            )
            print("[Ollama] Modele prechage OK")
        except Exception as e:
            print("[Ollama] Warmup echoue: {}".format(e))
