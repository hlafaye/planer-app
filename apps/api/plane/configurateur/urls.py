# Planer custom: Configurateur AO URLs
from django.urls import path
from plane.configurateur.views import (
    ProjetAOViewSet, PointDeVenteViewSet, ScenarioAOViewSet,
    MercurialeViewSet, PosteTypeViewSet, AOStatsView,
    ChangeStatutView, DupliquerView,
    SimulerView, GenererBPUView, GenererBudgetView, GenererCoutFixeView, GenererToutView,
    FraisGenerauxTypeViewSet, InvestissementTypeViewSet,
    TauxChargesViewSet, TrancheFreqViewSet, ProduitAlimentaireViewSet,
)

urlpatterns = [
    # Projets AO
    path("projets/", ProjetAOViewSet.as_view({"get": "list", "post": "create"}), name="ao-projets"),
    path("projets/<uuid:pk>/", ProjetAOViewSet.as_view({"get": "retrieve", "patch": "partial_update", "delete": "destroy"}), name="ao-projet-detail"),
    # Actions
    path("projets/<uuid:pk>/change-statut/", ChangeStatutView.as_view(), name="ao-change-statut"),
    path("projets/<uuid:pk>/dupliquer/", DupliquerView.as_view(), name="ao-dupliquer"),
    # Sprint 2 : simulation + generation Excel
    path("projets/<uuid:pk>/simuler/", SimulerView.as_view(), name="ao-simuler"),
    path("projets/<uuid:pk>/generer-bpu/", GenererBPUView.as_view(), name="ao-gen-bpu"),
    path("projets/<uuid:pk>/generer-budget/", GenererBudgetView.as_view(), name="ao-gen-budget"),
    path("projets/<uuid:pk>/generer-cout-fixe/", GenererCoutFixeView.as_view(), name="ao-gen-cf"),
    path("projets/<uuid:pk>/generer-tout/", GenererToutView.as_view(), name="ao-gen-tout"),
    # Points de vente
    path("projets/<uuid:projet_id>/pdv/", PointDeVenteViewSet.as_view({"get": "list", "post": "create"}), name="ao-pdv"),
    path("projets/<uuid:projet_id>/pdv/<uuid:pk>/", PointDeVenteViewSet.as_view({"get": "retrieve", "patch": "partial_update", "delete": "destroy"}), name="ao-pdv-detail"),
    # Scénarios
    path("projets/<uuid:projet_id>/scenarios/", ScenarioAOViewSet.as_view({"get": "list", "post": "create"}), name="ao-scenarios"),
    path("projets/<uuid:projet_id>/scenarios/<uuid:pk>/", ScenarioAOViewSet.as_view({"get": "retrieve", "patch": "partial_update", "delete": "destroy"}), name="ao-scenario-detail"),
    # Référentiels
    path("mercuriale/", MercurialeViewSet.as_view({"get": "list"}), name="ao-mercuriale"),
    path("postes-types/", PosteTypeViewSet.as_view({"get": "list"}), name="ao-postes"),
    # Stats
    path("stats/", AOStatsView.as_view(), name="ao-stats"),
    # Sprint 2.5 : Referentiels — full CRUD (list, create, retrieve, update, delete)
    path("referentiels/postes/", PosteTypeViewSet.as_view({"get": "list", "post": "create"}), name="ao-ref-postes"),
    path("referentiels/postes/<int:pk>/", PosteTypeViewSet.as_view({"get": "retrieve", "patch": "partial_update", "delete": "destroy"}), name="ao-ref-postes-detail"),
    path("referentiels/frais-generaux/", FraisGenerauxTypeViewSet.as_view({"get": "list", "post": "create"}), name="ao-ref-fg"),
    path("referentiels/frais-generaux/<int:pk>/", FraisGenerauxTypeViewSet.as_view({"get": "retrieve", "patch": "partial_update", "delete": "destroy"}), name="ao-ref-fg-detail"),
    path("referentiels/investissements/", InvestissementTypeViewSet.as_view({"get": "list", "post": "create"}), name="ao-ref-invest"),
    path("referentiels/investissements/<int:pk>/", InvestissementTypeViewSet.as_view({"get": "retrieve", "patch": "partial_update", "delete": "destroy"}), name="ao-ref-invest-detail"),
    path("referentiels/taux-charges/", TauxChargesViewSet.as_view({"get": "list", "post": "create"}), name="ao-ref-taux"),
    path("referentiels/taux-charges/<int:pk>/", TauxChargesViewSet.as_view({"get": "retrieve", "patch": "partial_update", "delete": "destroy"}), name="ao-ref-taux-detail"),
    path("referentiels/tranches/", TrancheFreqViewSet.as_view({"get": "list", "post": "create"}), name="ao-ref-tranches"),
    path("referentiels/tranches/<int:pk>/", TrancheFreqViewSet.as_view({"get": "retrieve", "patch": "partial_update", "delete": "destroy"}), name="ao-ref-tranches-detail"),
    path("referentiels/produits/", ProduitAlimentaireViewSet.as_view({"get": "list", "post": "create"}), name="ao-ref-produits"),
    path("referentiels/produits/<int:pk>/", ProduitAlimentaireViewSet.as_view({"get": "retrieve", "patch": "partial_update", "delete": "destroy"}), name="ao-ref-produits-detail"),
]
