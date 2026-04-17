# Planer custom: Configurateur AO serializers
from rest_framework import serializers
from plane.configurateur.models import (
    Mercuriale, PosteType, ProjetAO, PointDeVente, ScenarioAO,
    FraisGenerauxType, InvestissementType, TauxChargesSociales,
    TrancheFrequentation, ProduitAlimentaire,
)


class MercurialeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Mercuriale
        fields = "__all__"


class PosteTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = PosteType
        fields = "__all__"


class PointDeVenteSerializer(serializers.ModelSerializer):
    type_pdv_display = serializers.CharField(source="get_type_pdv_display", read_only=True)

    class Meta:
        model = PointDeVente
        fields = [
            "id", "type_pdv", "type_pdv_display", "nom",
            "tranche_frequentation", "couverts_jour_cible", "jours_ouvres_mois",
        ]
        read_only_fields = ["id"]


class ScenarioAOSerializer(serializers.ModelSerializer):
    class Meta:
        model = ScenarioAO
        fields = ["id", "nom", "description", "parametres", "resultats", "created_at"]
        read_only_fields = ["id", "created_at"]


class ProjetAOListSerializer(serializers.ModelSerializer):
    pdv_count = serializers.SerializerMethodField()
    statut_display = serializers.CharField(source="get_statut_display", read_only=True)
    nature_display = serializers.CharField(source="get_nature_display", read_only=True)

    class Meta:
        model = ProjetAO
        fields = [
            "id", "nom", "client", "nature", "nature_display",
            "mode_gestion", "statut", "statut_display",
            "date_remise", "pdv_count", "created_at", "updated_at",
        ]

    def get_pdv_count(self, obj):
        return obj.points_de_vente.count()


class ProjetAOSerializer(serializers.ModelSerializer):
    points_de_vente = PointDeVenteSerializer(many=True, read_only=True)
    scenarios = ScenarioAOSerializer(many=True, read_only=True)
    statut_display = serializers.CharField(source="get_statut_display", read_only=True)

    class Meta:
        model = ProjetAO
        fields = "__all__"
        read_only_fields = ["id", "workspace", "created_by", "updated_by", "created_at", "updated_at"]


# Sprint 2.5 : Referentiels serializers

class FraisGenerauxTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = FraisGenerauxType
        fields = "__all__"


class InvestissementTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = InvestissementType
        fields = "__all__"


class TauxChargesSocialesSerializer(serializers.ModelSerializer):
    class Meta:
        model = TauxChargesSociales
        fields = "__all__"


class TrancheFreqSerializer(serializers.ModelSerializer):
    class Meta:
        model = TrancheFrequentation
        fields = "__all__"


class ProduitAlimentaireSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProduitAlimentaire
        fields = ["id", "designation", "famille", "gamme", "categorie",
                  "grammage_net_min", "grammage_net_max", "prix_ht_reference",
                  "types_pdv", "actif"]
