# Planer custom: Configurateur AO views
import logging
import time

from django.http import HttpResponse
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet
from rest_framework.views import APIView

from plane.authentication.session import BaseSessionAuthentication
from plane.db.models import Workspace
from plane.configurateur.models import (
    Mercuriale, PosteType, ProjetAO, PointDeVente, ScenarioAO,
    CalculSnapshot,
)
from plane.configurateur.serializers import (
    MercurialeSerializer, PosteTypeSerializer,
    ProjetAOSerializer, ProjetAOListSerializer,
    PointDeVenteSerializer, ScenarioAOSerializer,
)

logger = logging.getLogger("plane.configurateur")


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


class SimulerView(AOAuthMixin, APIView):
    """Run the simulation pipeline and return full P&L + KPIs.

    Optional: save_snapshot=true creates a CalculSnapshot for traceability.
    """

    def post(self, request, workspace_slug, pk):
        try:
            projet = ProjetAO.objects.get(id=pk, workspace__slug=workspace_slug)
        except ProjetAO.DoesNotExist:
            return Response({"error": "Projet introuvable"}, status=status.HTTP_404_NOT_FOUND)

        params = request.data.get("parametres", {}) or {}
        save_snapshot = bool(request.data.get("save_snapshot"))
        scenario_id = request.data.get("scenario_id")

        from plane.configurateur.services.simulation_engine import SimulationEngine

        t0 = time.time()
        try:
            result = SimulationEngine(projet, params).run()
        except Exception as e:
            logger.exception("Simulation failed for projet %s", pk)
            return Response(
                {"error": "Erreur simulation: {}".format(str(e))},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        elapsed_ms = int((time.time() - t0) * 1000)
        result["_elapsed_ms"] = elapsed_ms

        if save_snapshot and scenario_id:
            try:
                scenario = ScenarioAO.objects.get(id=scenario_id, projet_ao=projet)
                scenario.parametres = params
                scenario.resultats = result
                scenario.save()
                CalculSnapshot.objects.create(
                    scenario=scenario,
                    ca_mensuel=result["pl"]["ca_total"],
                    masse_salariale=result["staffing"]["masse_chargee_mensuelle"],
                    cout_matiere=result["matiere"]["cout_matiere_mensuel"],
                    frais_generaux=result["fg"]["fg_mensuel"],
                    amortissements=result["invest"]["amortissement_mensuel"],
                    resultat=result["pl"]["resultat"],
                    marge_pct=result["pl"]["marge_pct"],
                    cout_par_couvert=result["kpis"]["cout_par_couvert"],
                    score_estime=result["score_estime"]["total"],
                    details=result,
                )
            except ScenarioAO.DoesNotExist:
                logger.warning("Scenario %s not found for snapshot", scenario_id)

        return Response(result)


class GenererBPUView(AOAuthMixin, APIView):
    """Generate BPU Excel for a projet."""

    def post(self, request, workspace_slug, pk):
        return _generate_excel(self, request, workspace_slug, pk, "bpu")


class GenererBudgetView(AOAuthMixin, APIView):
    def post(self, request, workspace_slug, pk):
        return _generate_excel(self, request, workspace_slug, pk, "budget")


class GenererCoutFixeView(AOAuthMixin, APIView):
    def post(self, request, workspace_slug, pk):
        return _generate_excel(self, request, workspace_slug, pk, "coutfixe")


class GenererToutView(AOAuthMixin, APIView):
    """Generate the 3 Excel + zip them."""

    def post(self, request, workspace_slug, pk):
        try:
            projet = ProjetAO.objects.get(id=pk, workspace__slug=workspace_slug)
        except ProjetAO.DoesNotExist:
            return Response({"error": "Projet introuvable"}, status=status.HTTP_404_NOT_FOUND)

        scenario_id = request.data.get("scenario_id")
        scenario = None
        if scenario_id:
            try:
                scenario = ScenarioAO.objects.get(id=scenario_id, projet_ao=projet)
            except ScenarioAO.DoesNotExist:
                pass

        from plane.configurateur.services.excel_generator import generate_dossier_zip
        try:
            zip_buf = generate_dossier_zip(projet, scenario)
        except Exception as e:
            logger.exception("ZIP generation failed for projet %s", pk)
            return Response(
                {"error": "Erreur generation ZIP: {}".format(str(e))},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        safe_name = projet.nom.replace("/", "_").replace(" ", "_")
        response = HttpResponse(zip_buf.getvalue(), content_type="application/zip")
        response["Content-Disposition"] = 'attachment; filename="Dossier_AO_{}.zip"'.format(safe_name)
        return response


def _generate_excel(view, request, workspace_slug, pk, kind):
    """Helper for the 3 single-Excel generators."""
    try:
        projet = ProjetAO.objects.get(id=pk, workspace__slug=workspace_slug)
    except ProjetAO.DoesNotExist:
        return Response({"error": "Projet introuvable"}, status=status.HTTP_404_NOT_FOUND)

    scenario_id = request.data.get("scenario_id")
    scenario = None
    if scenario_id:
        try:
            scenario = ScenarioAO.objects.get(id=scenario_id, projet_ao=projet)
        except ScenarioAO.DoesNotExist:
            pass

    from plane.configurateur.services.excel_generator import (
        BPUGenerator, BudgetGenerator, CoutFixeGenerator,
    )
    GENS = {"bpu": BPUGenerator, "budget": BudgetGenerator, "coutfixe": CoutFixeGenerator}
    NAMES = {"bpu": "BPU", "budget": "Budget", "coutfixe": "CoutFixe"}

    cls = GENS[kind]
    try:
        out = cls(projet, scenario).generate()
    except Exception as e:
        logger.exception("Excel %s generation failed for projet %s", kind, pk)
        return Response(
            {"error": "Erreur generation {}: {}".format(kind, str(e))},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    safe_client = projet.client.replace("/", "_").replace(" ", "_")
    suffix = scenario.nom.replace("/", "_").replace(" ", "_") if scenario else "Default"
    fname = "{}_{}_{}.xlsx".format(NAMES[kind], safe_client, suffix)

    response = HttpResponse(
        out.getvalue(),
        content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )
    response["Content-Disposition"] = 'attachment; filename="{}"'.format(fname)
    return response


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
