# Planer custom: Configurateur AO URLs
from django.urls import path
from plane.configurateur.views import (
    ProjetAOViewSet, PointDeVenteViewSet, ScenarioAOViewSet,
    MercurialeViewSet, PosteTypeViewSet, AOStatsView,
    ChangeStatutView, DupliquerView,
)

urlpatterns = [
    # Projets AO
    path("projets/", ProjetAOViewSet.as_view({"get": "list", "post": "create"}), name="ao-projets"),
    path("projets/<uuid:pk>/", ProjetAOViewSet.as_view({"get": "retrieve", "patch": "partial_update", "delete": "destroy"}), name="ao-projet-detail"),
    # Actions
    path("projets/<uuid:pk>/change-statut/", ChangeStatutView.as_view(), name="ao-change-statut"),
    path("projets/<uuid:pk>/dupliquer/", DupliquerView.as_view(), name="ao-dupliquer"),
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
]
