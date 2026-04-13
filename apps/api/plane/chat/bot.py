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
        """Extract text from image attachment via Tesseract OCR + Ollama structuring."""
        attachment = message.attachments.first()
        if not attachment:
            PlainerBot._reply(message, "Aucune piece jointe. Uploadez une image puis tapez @planer ocr")
            return

        try:
            import pytesseract
            from PIL import Image
            from io import BytesIO

            # Download image
            with httpx.Client(timeout=30) as client:
                img_resp = client.get(attachment.file_url)

            image = Image.open(BytesIO(img_resp.content))

            # Tesseract OCR (French + English)
            raw_text = pytesseract.image_to_string(image, lang="fra+eng")

            if not raw_text.strip():
                PlainerBot._reply(message, "Aucun texte detecte dans l'image.")
                return

            # Structure with Ollama
            try:
                prompt = (
                    "Voici du texte extrait par OCR d'un document. "
                    "Restructure-le proprement, corrige les erreurs OCR evidentes, "
                    "et identifie le type de document.\n\nTexte brut:\n" + raw_text[:3000]
                )
                structured = PlainerBot._call_ollama("llama3.1:8b", prompt)
                result = structured
            except Exception:
                result = raw_text

        except ImportError:
            # Fallback to llava if tesseract not installed
            try:
                with httpx.Client(timeout=30) as client:
                    img_resp = client.get(attachment.file_url)
                    image_b64 = base64.b64encode(img_resp.content).decode()
                result = PlainerBot._call_ollama(
                    "llava:7b",
                    "Extract ALL text from this image. Return only the text.",
                    images=[image_b64],
                )
            except Exception as e:
                result = "Erreur OCR: {}".format(e)
        except Exception as e:
            result = "Erreur OCR: {}".format(e)

        # Save OCR result
        attachment.ocr_text = result
        attachment.save(update_fields=["ocr_text"])

        PlainerBot._reply(message, "OCR:\n---\n{}\n---".format(result))

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
                PlainerBot._reply(message, "Issue '{}' non trouvee".format(issue_key))
                return
            # Build rich context for Ollama
            assignees = ", ".join(
                [a.display_name for a in issue.assignees.all()]
            ) if hasattr(issue, "assignees") else "Non assigne"
            labels = ", ".join(
                [l.name for l in issue.labels.all()]
            ) if hasattr(issue, "labels") else "Aucun"
            state_name = issue.state.name if issue.state else "Non defini"
            priority_map = {0: "Aucune", 1: "Basse", 2: "Moyenne", 3: "Haute", 4: "Urgente"}
            priority_str = priority_map.get(issue.priority, "Non definie")
            text = (
                "Titre: {}\n"
                "Description: {}\n"
                "Statut: {}\n"
                "Priorite: {}\n"
                "Assigne a: {}\n"
                "Labels: {}\n"
                "Cree le: {}"
            ).format(
                issue.name,
                issue.description_stripped or "Pas de description",
                state_name,
                priority_str,
                assignees or "Non assigne",
                labels or "Aucun",
                issue.created_at.strftime("%d/%m/%Y") if issue.created_at else "?",
            )
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

        if issue_key:
            prompt = (
                "Resume cette issue de maniere concise et actionnable en francais. "
                "Donne: contexte, actions en cours, prochaines etapes.\n\n" + text[:4000]
            )
        else:
            prompt = (
                "Resume cette conversation en francais. "
                "Liste les points cles et les actions a mener.\n\n" + text[:4000]
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
        ).select_related("state").prefetch_related("assignees")[:5]

        if not issues:
            PlainerBot._reply(message, "Aucun resultat pour '{}'".format(args))
            return

        lines = ["Resultats ({} trouves):".format(len(issues))]
        for i, issue in enumerate(issues, 1):
            state = issue.state.name if issue.state else "?"
            assignees = ", ".join(
                [a.display_name for a in issue.assignees.all()]
            ) if hasattr(issue, "assignees") else ""
            assignee_str = " -- {}".format(assignees) if assignees else " -- Non assigne"
            seq = getattr(issue, "sequence_id", issue.id)
            lines.append("{}. #{}: {} ({}){}".format(i, seq, issue.name, state, assignee_str))

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
        """Post bot reply as a threaded message + broadcast via WebSocket."""
        msg = Message.objects.create(
            channel=parent_message.channel,
            actor=None,
            content=content,
            message_type="bot",
            parent=parent_message,
        )
        # Broadcast via Redis → WebSocket
        from plane.chat.broadcast import broadcast_message
        from plane.chat.serializers import MessageSerializer
        broadcast_message(
            str(parent_message.channel.id),
            MessageSerializer(msg).data,
        )
