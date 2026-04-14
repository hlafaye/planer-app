# Planer custom: Module Devis serializers
from rest_framework import serializers
from plane.devis.models import (
    Fournisseur, Devis, ValidationRule, ValidationAction,
    BonDeCommande, Facture,
)


class FournisseurSerializer(serializers.ModelSerializer):
    class Meta:
        model = Fournisseur
        fields = [
            "id", "nom", "siret", "contact_nom", "contact_email",
            "contact_tel", "categorie_principale", "notes", "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class ValidationActionSerializer(serializers.ModelSerializer):
    from_user_name = serializers.CharField(source="from_user.display_name", read_only=True)
    to_user_name = serializers.CharField(source="to_user.display_name", read_only=True, default="")

    class Meta:
        model = ValidationAction
        fields = [
            "id", "action", "from_user", "from_user_name",
            "to_user", "to_user_name", "comment", "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class DevisSerializer(serializers.ModelSerializer):
    fournisseur_nom = serializers.CharField(source="fournisseur.nom", read_only=True, default="")
    module_name = serializers.CharField(source="module.name", read_only=True, default="")
    actions = ValidationActionSerializer(many=True, read_only=True)
    statut_display = serializers.CharField(source="get_statut_display", read_only=True)
    type_display = serializers.CharField(source="get_type_devis_display", read_only=True)

    class Meta:
        model = Devis
        fields = [
            "id", "reference", "type_devis", "type_display",
            "nom", "description",
            "fournisseur", "fournisseur_nom",
            "module", "module_name",
            "poste_budget", "categorie",
            "montant_ht", "tva_taux", "tva_montant", "montant_ttc", "devise",
            "date_devis", "date_livraison_prevue", "date_livraison_reelle",
            "statut", "statut_display",
            "issue_liee", "pdf_original", "donnees_ocr",
            "actions",
            "created_at", "updated_at",
        ]
        read_only_fields = [
            "id", "reference", "tva_montant", "montant_ttc",
            "created_at", "updated_at",
        ]


class DevisListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for list views."""
    fournisseur_nom = serializers.CharField(source="fournisseur.nom", read_only=True, default="")
    statut_display = serializers.CharField(source="get_statut_display", read_only=True)

    class Meta:
        model = Devis
        fields = [
            "id", "reference", "type_devis", "nom",
            "fournisseur_nom", "montant_ht", "montant_ttc",
            "statut", "statut_display", "date_devis", "created_at",
        ]


class ValidationRuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = ValidationRule
        fields = ["id", "type_devis", "max_amount", "validators", "mode", "order"]
        read_only_fields = ["id"]


class BonDeCommandeSerializer(serializers.ModelSerializer):
    class Meta:
        model = BonDeCommande
        fields = ["id", "reference", "pdf_genere", "date_envoi_fournisseur", "created_at"]
        read_only_fields = ["id", "created_at"]


class FactureSerializer(serializers.ModelSerializer):
    class Meta:
        model = Facture
        fields = [
            "id", "reference_fournisseur", "montant_ht", "montant_ttc",
            "date_facture", "date_paiement", "pdf", "created_at",
        ]
        read_only_fields = ["id", "created_at"]
