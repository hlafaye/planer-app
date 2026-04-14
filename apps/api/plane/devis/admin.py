# Planer custom: Module Devis admin
from django.contrib import admin
from plane.devis.models import (
    Fournisseur, Devis, ValidationRule, ValidationAction,
    BonDeCommande, Facture,
)


@admin.register(Fournisseur)
class FournisseurAdmin(admin.ModelAdmin):
    list_display = ["nom", "categorie_principale", "contact_email", "contact_tel"]
    search_fields = ["nom", "categorie_principale"]


@admin.register(Devis)
class DevisAdmin(admin.ModelAdmin):
    list_display = ["reference", "nom", "type_devis", "montant_ttc", "statut", "fournisseur", "created_at"]
    list_filter = ["statut", "type_devis"]
    search_fields = ["reference", "nom", "fournisseur__nom"]


@admin.register(ValidationRule)
class ValidationRuleAdmin(admin.ModelAdmin):
    list_display = ["project", "type_devis", "max_amount", "mode", "order"]


@admin.register(ValidationAction)
class ValidationActionAdmin(admin.ModelAdmin):
    list_display = ["devis", "action", "from_user", "to_user", "created_at"]


@admin.register(BonDeCommande)
class BonDeCommandeAdmin(admin.ModelAdmin):
    list_display = ["reference", "devis", "date_envoi_fournisseur"]


@admin.register(Facture)
class FactureAdmin(admin.ModelAdmin):
    list_display = ["reference_fournisseur", "devis", "montant_ttc", "date_facture", "date_paiement"]
