# Planer custom: @planer bot — Ollama integration
import base64
import logging
import os
import re

import httpx
from django.db.models import Q

from plane.chat.models import Message
from plane.db.models import Issue

logger = logging.getLogger(__name__)

OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://ollama:11434")


def _parse_issue_key(key: str):
    """Parse 'ALBA-42' into (identifier='ALBA', sequence_id=42) or fallback to name search."""
    if "-" in key:
        parts = key.rsplit("-", 1)
        try:
            return {"project__identifier": parts[0], "sequence_id": int(parts[1])}
        except (ValueError, IndexError):
            pass
    return None


class PlainerBot:
    """@planer bot — OCR, summarize, create tasks, search, status."""

    @staticmethod
    def process_command_sync(message: Message):
        """Parse and execute bot command (sync wrapper)."""
        content = message.content.strip()
        if "@planer" not in content.lower():
            return

        parts = content.split()
        try:
            idx = next(
                i for i, p in enumerate(parts) if "planer" in p.lower()
            )
            command = parts[idx + 1].lower() if idx + 1 < len(parts) else "aide"
        except (StopIteration, IndexError):
            command = "aide"

        args = " ".join(parts[idx + 2:]) if idx + 2 < len(parts) else ""

        handlers = {
            "ocr": PlainerBot._handle_ocr,
            "résume": PlainerBot._handle_summarize,
            "resume": PlainerBot._handle_summarize,
            "tache": PlainerBot._handle_create_task,
            "cherche": PlainerBot._handle_search,
            "status": PlainerBot._handle_status,
            "aide": PlainerBot._handle_help,
            "help": PlainerBot._handle_help,
        }

        handler = handlers.get(command, PlainerBot._handle_help)
        try:
            handler(message, args)
        except Exception as e:
            logger.error("Bot command error: %s", e, exc_info=True)
            PlainerBot._reply(message, f"❌ Erreur: {e}")

    @staticmethod
    def _handle_ocr(message: Message, args: str):
        """Extract text from image attachment via llava."""
        attachment = message.attachments.first()
        if not attachment:
            PlainerBot._reply(message, "❌ Aucune pièce jointe trouvée. Uploadez une image puis tapez `@planer ocr`")
            return

        # Call Ollama llava
        prompt = (
            "Extract ALL text from this image exactly as written. "
            "Return only the extracted text, no commentary."
        )
        try:
            # Download image from URL (MinIO or local)
            with httpx.Client(timeout=30) as client:
                img_resp = client.get(attachment.file_url)
                image_b64 = base64.b64encode(img_resp.content).decode()

            result = PlainerBot._call_ollama(
                "llava:7b", prompt, images=[image_b64]
            )
        except Exception as e:
            result = f"Erreur OCR: {e}"

        # Save OCR result
        attachment.ocr_text = result
        attachment.save(update_fields=["ocr_text"])

        PlainerBot._reply(message, f"✅ OCR:\n---\n{result}\n---")

    @staticmethod
    def _handle_summarize(message: Message, args: str):
        """Summarize messages or specific issue."""
        issue_key = args.strip() if args else None

        if issue_key:
            # Summarize specific issue — parse "ALBA-42" format
            parsed = _parse_issue_key(issue_key)
            if parsed:
                issue = Issue.objects.filter(
                    **parsed,
                    project__workspace=message.channel.workspace,
                ).first()
            else:
                issue = Issue.objects.filter(
                    Q(name__icontains=issue_key),
                    project__workspace=message.channel.workspace,
                ).first()
            if not issue:
                PlainerBot._reply(message, f"❌ Issue '{issue_key}' non trouvée")
                return
            text = f"Titre: {issue.name}\nDescription: {issue.description_stripped or 'N/A'}"
        else:
            # Summarize last 50 messages
            msgs = message.channel.messages.filter(
                message_type="user"
            ).order_by("-created_at")[:50]
            text = "\n".join(
                f"{m.actor.display_name if m.actor else 'System'}: {m.content}"
                for m in reversed(msgs)
            )

        if not text.strip():
            PlainerBot._reply(message, "❌ Pas assez de messages à résumer")
            return

        prompt = (
            "Résume cette conversation en français. "
            "Liste les points clés et les actions à mener.\n\n" + text[:4000]
        )
        summary = PlainerBot._call_ollama("llama3.1:8b", prompt)
        PlainerBot._reply(message, f"📋 Résumé:\n\n{summary}")

    @staticmethod
    def _handle_create_task(message: Message, args: str):
        """Create an issue from natural language."""
        if not args:
            PlainerBot._reply(
                message,
                "Usage: `@planer tache Titre de la tâche @assignee #priority`"
            )
            return

        # Parse assignee (@user) and priority (#tag)
        assignee_match = re.search(r"@(\w+)", args)
        priority_match = re.search(r"#(urgent|high|medium|low)", args, re.I)

        title = re.sub(r"@\w+|#\w+", "", args).strip()
        priority_map = {"urgent": 4, "high": 3, "medium": 2, "low": 1}
        priority = priority_map.get(
            priority_match.group(1).lower() if priority_match else "medium", 2
        )

        # Find project from channel
        project = message.channel.project
        if not project:
            PlainerBot._reply(message, "❌ Ce channel n'est pas lié à un projet")
            return

        # Create issue
        issue = Issue.objects.create(
            name=title[:255],
            priority=priority,
            project=project,
            workspace=message.channel.workspace,
            created_by=message.actor,
            updated_by=message.actor,
        )

        issue_id = getattr(issue, "sequence_id", issue.id)
        PlainerBot._reply(
            message,
            f"✅ Issue créée: #{issue_id}\n"
            f"Titre: {title}\n"
            f"Priorité: {priority_match.group(1) if priority_match else 'Medium'}\n"
        )

    @staticmethod
    def _handle_search(message: Message, args: str):
        """Search issues by keyword."""
        if not args:
            PlainerBot._reply(message, "Usage: `@planer cherche mot-clé`")
            return

        issues = Issue.objects.filter(
            Q(name__icontains=args) | Q(description_stripped__icontains=args),
            project__workspace=message.channel.workspace,
        )[:5]

        if not issues:
            PlainerBot._reply(message, f"🔍 Aucun résultat pour '{args}'")
            return

        lines = [f"🔍 Résultats ({issues.count()} trouvés):"]
        for i, issue in enumerate(issues, 1):
            state = issue.state.name if issue.state else "?"
            lines.append(f"{i}. #{getattr(issue, 'sequence_id', issue.id)}: {issue.name} ({state})")

        PlainerBot._reply(message, "\n".join(lines))

    @staticmethod
    def _handle_status(message: Message, args: str):
        """Get project/module KPI summary."""
        project = message.channel.project
        if not project:
            PlainerBot._reply(message, "❌ Ce channel n'est pas lié à un projet")
            return

        total = Issue.objects.filter(project=project).count()
        done = Issue.objects.filter(project=project, state__group="completed").count()
        in_progress = Issue.objects.filter(project=project, state__group="started").count()
        backlog = total - done - in_progress

        pct = round(done / total * 100) if total else 0

        text = (
            f"📊 Status — {project.name}:\n\n"
            f"Progression: {done}/{total} ({pct}%)\n"
            f"✅ Done: {done}\n"
            f"🔄 In Progress: {in_progress}\n"
            f"📋 Backlog: {backlog}\n"
        )

        # Optionally enhance with Ollama
        if total > 0:
            prompt = (
                f"En une phrase, donne un commentaire constructif sur ce projet:\n"
                f"Total: {total}, Terminé: {done}, En cours: {in_progress}, Backlog: {backlog}"
            )
            try:
                insight = PlainerBot._call_ollama("llama3.1:8b", prompt)
                text += f"\n💡 {insight}"
            except Exception:
                pass

        PlainerBot._reply(message, text)

    @staticmethod
    def _handle_help(message: Message, args: str):
        """List available commands."""
        PlainerBot._reply(
            message,
            "🤖 **@planer** — Commandes disponibles:\n\n"
            "• `@planer ocr` — Extraire le texte d'une image (+ pièce jointe)\n"
            "• `@planer résume` — Résumer les derniers messages\n"
            "• `@planer résume ALBA-42` — Résumer une issue\n"
            "• `@planer tache Titre @user #priority` — Créer une tâche\n"
            "• `@planer cherche mot-clé` — Chercher des issues\n"
            "• `@planer status` — KPIs du projet\n"
            "• `@planer aide` — Cette aide\n"
        )

    @staticmethod
    def _call_ollama(model: str, prompt: str, images: list = None) -> str:
        """Call Ollama API synchronously."""
        payload = {"model": model, "prompt": prompt, "stream": False}
        if images:
            payload["images"] = images

        with httpx.Client(timeout=120) as client:
            resp = client.post(f"{OLLAMA_URL}/api/generate", json=payload)
            resp.raise_for_status()
            return resp.json().get("response", "").strip()

    @staticmethod
    def _reply(parent_message: Message, content: str):
        """Post bot reply as a threaded message."""
        Message.objects.create(
            channel=parent_message.channel,
            actor=None,
            content=content,
            message_type="bot",
            parent=parent_message,
        )
