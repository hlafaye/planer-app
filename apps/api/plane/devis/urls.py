# Planer custom: Devis workspace-level URLs (fournisseurs)
from django.urls import path
from plane.devis.views import FournisseurViewSet

urlpatterns = [
    path("fournisseurs/", FournisseurViewSet.as_view({"get": "list", "post": "create"}), name="fournisseurs-list"),
    path("fournisseurs/<uuid:pk>/", FournisseurViewSet.as_view({"get": "retrieve", "patch": "partial_update", "delete": "destroy"}), name="fournisseur-detail"),
]
