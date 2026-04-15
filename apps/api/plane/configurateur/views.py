# Planer custom: Configurateur AO views
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet
from rest_framework.views import APIView

from plane.authentication.session import BaseSessionAuthentication
from plane.db.models import Workspace
from plane.configurateur.models import (
    Mercuriale, PosteType, ProjetAO, PointDeVente, ScenarioAO,
)
from plane.configurateur.serializers import (
    MercurialeSerializer, PosteTypeSerializer,
    ProjetAOSerializer, ProjetAOListSerializer,
    PointDeVenteSerializer, ScenarioAOSerializer,
)


class AOAuthMixin:
    authentication_classes = [BaseSessionAuthentication]
    permission_classes = [IsAuthenticated]


class ProjetAOViewSet(AOAuthMixin, ModelViewSet):
    def get_serializer_class(self):
        if self.action == "list":
            return ProjetAOListSerializer
        return ProjetAOSerializer

    def get_queryset(self):
        return ProjetAO.objects.filter(
            workspace__slug=self.kwargs["workspace_slug"]
        ).prefetch_related("points_de_vente", "scenarios")

    def perform_create(self, serializer):
        ws = Workspace.objects.get(slug=self.kwargs["workspace_slug"])
        serializer.save(workspace=ws)


class ChangeStatutView(AOAuthMixin, APIView):
    """Change the status of a ProjetAO."""

    def patch(self, request, workspace_slug, pk):
        projet = ProjetAO.objects.get(id=pk, workspace__slug=workspace_slug)
        nouveau_statut = request.data.get("statut")
        valid = dict(ProjetAO.STATUTS)
        if nouveau_statut not in valid:
            return Response(
                {"error": "Statut invalide: {}".format(nouveau_statut)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        projet.statut = nouveau_statut
        projet.save()
        return Response(ProjetAOSerializer(projet).data)


class DupliquerView(AOAuthMixin, APIView):
    """Duplicate a ProjetAO with all its PdV."""

    def post(self, request, workspace_slug, pk):
        original = ProjetAO.objects.get(id=pk, workspace__slug=workspace_slug)
        pdvs = list(original.points_de_vente.all())

        original.pk = None
        original.nom = "{} (copie)".format(original.nom)
        original.statut = "draft"
        original.save()

        for pdv in pdvs:
            pdv.pk = None
            pdv.projet_ao = original
            pdv.save()

        return Response(
            ProjetAOSerializer(original).data,
            status=status.HTTP_201_CREATED,
        )


class PointDeVenteViewSet(AOAuthMixin, ModelViewSet):
    serializer_class = PointDeVenteSerializer

    def get_queryset(self):
        return PointDeVente.objects.filter(
            projet_ao_id=self.kwargs["projet_id"]
        )

    def perform_create(self, serializer):
        projet = ProjetAO.objects.get(id=self.kwargs["projet_id"])
        serializer.save(projet_ao=projet)


class ScenarioAOViewSet(AOAuthMixin, ModelViewSet):
    serializer_class = ScenarioAOSerializer

    def get_queryset(self):
        return ScenarioAO.objects.filter(
            projet_ao_id=self.kwargs["projet_id"]
        )

    def perform_create(self, serializer):
        projet = ProjetAO.objects.get(id=self.kwargs["projet_id"])
        serializer.save(projet_ao=projet)


class MercurialeViewSet(AOAuthMixin, ModelViewSet):
    serializer_class = MercurialeSerializer
    queryset = Mercuriale.objects.all()


class PosteTypeViewSet(AOAuthMixin, ModelViewSet):
    serializer_class = PosteTypeSerializer
    queryset = PosteType.objects.all()


class AOStatsView(AOAuthMixin, APIView):
    def get(self, request, workspace_slug):
        projets = ProjetAO.objects.filter(workspace__slug=workspace_slug)
        return Response({
            "total": projets.count(),
            "en_cours": projets.filter(statut="en_cours").count(),
            "remis": projets.filter(statut="remis").count(),
            "gagnes": projets.filter(statut="gagne").count(),
            "perdus": projets.filter(statut="perdu").count(),
            "brouillons": projets.filter(statut="draft").count(),
        })
