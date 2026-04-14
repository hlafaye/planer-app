# Planer custom: Devis project-level URLs
from django.urls import path
from plane.devis.views import (
    DevisViewSet, DevisActionView, DevisStatsView, ValidationRuleViewSet,
)

urlpatterns = [
    path("", DevisViewSet.as_view({"get": "list", "post": "create"}), name="devis-list"),
    path("stats/", DevisStatsView.as_view(), name="devis-stats"),
    path("<uuid:pk>/", DevisViewSet.as_view({"get": "retrieve", "patch": "partial_update", "delete": "destroy"}), name="devis-detail"),
    path("<uuid:devis_id>/action/", DevisActionView.as_view(), name="devis-action"),
    path("validation-rules/", ValidationRuleViewSet.as_view({"get": "list", "post": "create"}), name="validation-rules"),
    path("validation-rules/<uuid:pk>/", ValidationRuleViewSet.as_view({"get": "retrieve", "patch": "partial_update", "delete": "destroy"}), name="validation-rule-detail"),
]
