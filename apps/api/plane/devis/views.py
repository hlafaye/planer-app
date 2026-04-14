# Planer custom: Module Devis API views
from decimal import Decimal

from rest_framework import status
from rest_framework.parsers import MultiPartParser, JSONParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet
from rest_framework.views import APIView

from plane.authentication.session import BaseSessionAuthentication
from plane.db.models import Project, Workspace
from plane.devis.models import (
    Fournisseur, Devis, ValidationRule, ValidationAction,
    BonDeCommande, Facture,
)
from plane.devis.serializers import (
    FournisseurSerializer,
    DevisSerializer, DevisListSerializer,
    ValidationRuleSerializer, ValidationActionSerializer,
    BonDeCommandeSerializer, FactureSerializer,
)


class DevisAuthMixin:
    authentication_classes = [BaseSessionAuthentication]
    permission_classes = [IsAuthenticated]


class FournisseurViewSet(DevisAuthMixin, ModelViewSet):
    serializer_class = FournisseurSerializer

    def get_queryset(self):
        return Fournisseur.objects.filter(
            workspace__slug=self.kwargs["workspace_slug"]
        ).order_by("nom")

    def perform_create(self, serializer):
        ws = Workspace.objects.get(slug=self.kwargs["workspace_slug"])
        serializer.save(workspace=ws)


class DevisViewSet(DevisAuthMixin, ModelViewSet):
    def get_serializer_class(self):
        if self.action == "list":
            return DevisListSerializer
        return DevisSerializer

    def get_queryset(self):
        qs = Devis.objects.filter(
            project_id=self.kwargs["project_id"],
            workspace__slug=self.kwargs["workspace_slug"],
        ).select_related("fournisseur", "module").prefetch_related("actions")

        # Filters
        statut = self.request.query_params.get("statut")
        if statut:
            qs = qs.filter(statut=statut)

        type_devis = self.request.query_params.get("type")
        if type_devis:
            qs = qs.filter(type_devis=type_devis)

        fournisseur = self.request.query_params.get("fournisseur")
        if fournisseur:
            qs = qs.filter(fournisseur_id=fournisseur)

        return qs.order_by("-created_at")

    def perform_create(self, serializer):
        project = Project.objects.get(id=self.kwargs["project_id"])
        serializer.save(project=project, workspace=project.workspace)


class ValidationRuleViewSet(DevisAuthMixin, ModelViewSet):
    serializer_class = ValidationRuleSerializer

    def get_queryset(self):
        return ValidationRule.objects.filter(
            project_id=self.kwargs["project_id"]
        )

    def perform_create(self, serializer):
        project = Project.objects.get(id=self.kwargs["project_id"])
        serializer.save(project=project)


class DevisActionView(DevisAuthMixin, APIView):
    """Submit, approve, reject, request modification on a devis."""

    def post(self, request, workspace_slug, project_id, devis_id):
        devis = Devis.objects.get(id=devis_id, project_id=project_id)
        action = request.data.get("action")
        comment = request.data.get("comment", "")

        valid_actions = ["submit", "approve", "reject", "request_modif", "resubmit"]
        if action not in valid_actions:
            return Response(
                {"error": "Action invalide. Choix: {}".format(", ".join(valid_actions))},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # State machine
        transitions = {
            "submit": {"from": ["draft", "modif_requested"], "to": "pending"},
            "approve": {"from": ["pending"], "to": "approved"},
            "reject": {"from": ["pending"], "to": "rejected"},
            "request_modif": {"from": ["pending"], "to": "modif_requested"},
            "resubmit": {"from": ["rejected", "modif_requested"], "to": "pending"},
        }

        transition = transitions.get(action)
        if devis.statut not in transition["from"]:
            return Response(
                {"error": "Transition impossible: {} -> {}".format(devis.statut, action)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Create action record
        ValidationAction.objects.create(
            devis=devis,
            action=action,
            from_user=request.user,
            comment=comment,
        )

        # Update devis status
        devis.statut = transition["to"]
        devis.save(update_fields=["statut", "updated_at"])

        return Response(DevisSerializer(devis).data)


class DevisStatsView(DevisAuthMixin, APIView):
    """Dashboard stats for devis in a project."""

    def get(self, request, workspace_slug, project_id):
        devis_qs = Devis.objects.filter(
            project_id=project_id, workspace__slug=workspace_slug
        )

        total = devis_qs.count()
        by_statut = {}
        for s in Devis.STATUT_CHOICES:
            count = devis_qs.filter(statut=s[0]).count()
            if count > 0:
                by_statut[s[0]] = {"label": s[1], "count": count}

        total_ht = sum(
            d.montant_ht for d in devis_qs.filter(statut__in=["approved", "ordered", "delivered", "invoiced"])
        )
        total_ttc = sum(
            d.montant_ttc for d in devis_qs.filter(statut__in=["approved", "ordered", "delivered", "invoiced"])
        )

        return Response({
            "total": total,
            "by_statut": by_statut,
            "total_approuve_ht": float(total_ht),
            "total_approuve_ttc": float(total_ttc),
        })


class ExtractFromPDFView(DevisAuthMixin, APIView):
    """Extract devis fields from uploaded PDF via OCR + Ollama AI."""
    parser_classes = [MultiPartParser]

    def post(self, request, workspace_slug, project_id):
        import logging
        logger = logging.getLogger("plane.devis.extract")

        try:
            if "file" not in request.FILES:
                return Response({"error": "Aucun fichier"}, status=status.HTTP_400_BAD_REQUEST)

            pdf_file = request.FILES["file"]
            logger.info("PDF upload: %s (%d bytes)", pdf_file.name, pdf_file.size)

            if not pdf_file.name.lower().endswith(".pdf"):
                return Response({"error": "PDF requis"}, status=status.HTTP_400_BAD_REQUEST)

            from plane.devis.services.pdf_extractor import extract_devis_from_pdf

            pdf_bytes = pdf_file.read()
            result = extract_devis_from_pdf(pdf_bytes)

            if "error" in result:
                logger.warning("PDF extraction error: %s", result["error"])
                return Response(result, status=status.HTTP_422_UNPROCESSABLE_ENTITY)

            logger.info("PDF extraction OK: %s", result.get("data", {}).get("nom", "?"))
            return Response(result)
        except Exception as e:
            logger.error("PDF extraction crash: %s", e, exc_info=True)
            return Response({"error": "Erreur serveur: {}".format(str(e))}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class PreviewValidationView(DevisAuthMixin, APIView):
    """Preview which validation chain will be triggered for a given amount + type."""

    def post(self, request, workspace_slug, project_id):
        type_devis = request.data.get("type_devis")
        montant_ht = request.data.get("montant_ht")

        if not type_devis or montant_ht is None:
            return Response(
                {"error": "type_devis et montant_ht requis"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        montant = Decimal(str(montant_ht))

        rules = ValidationRule.objects.filter(
            project_id=project_id, type_devis=type_devis
        ).order_by("order")

        applicable_rule = None
        for rule in rules:
            if rule.max_amount is None or montant <= rule.max_amount:
                applicable_rule = rule
                break

        if not applicable_rule:
            return Response({
                "mode": "none",
                "message": "Aucune regle applicable",
                "validators": [],
            })

        validators = [
            {
                "id": str(u.id),
                "name": u.display_name or u.email,
            }
            for u in applicable_rule.validators.all()
        ]

        return Response({
            "mode": applicable_rule.mode,
            "validators": validators,
            "seuil_franchi": float(applicable_rule.max_amount) if applicable_rule.max_amount else None,
        })
