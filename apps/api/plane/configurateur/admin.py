# Planer custom: Configurateur AO admin
from django.contrib import admin
from plane.configurateur.models import (
    Mercuriale, PosteType, MatriceStaffing, CategorieEquipement,
    EquipementType, Grammage, StructureOffreType,
    ProjetAO, PointDeVente, ScenarioAO,
)


@admin.register(Mercuriale)
class MercurialeAdmin(admin.ModelAdmin):
    list_display = ["categorie", "sous_categorie", "prix_eco", "prix_standard", "prix_premium", "unite"]
    search_fields = ["categorie", "sous_categorie"]
    list_filter = ["categorie"]


@admin.register(PosteType)
class PosteTypeAdmin(admin.ModelAdmin):
    list_display = ["nom", "qualification", "categorie", "salaire_brut_mensuel", "taux_charges"]
    list_filter = ["categorie"]


@admin.register(MatriceStaffing)
class MatriceStaffingAdmin(admin.ModelAdmin):
    list_display = ["type_pdv", "tranche", "poste", "nb_etp"]
    list_filter = ["type_pdv", "tranche"]


admin.site.register(CategorieEquipement)
admin.site.register(EquipementType)
admin.site.register(Grammage)
admin.site.register(StructureOffreType)


class PointDeVenteInline(admin.TabularInline):
    model = PointDeVente
    extra = 1


class ScenarioAOInline(admin.TabularInline):
    model = ScenarioAO
    extra = 0


@admin.register(ProjetAO)
class ProjetAOAdmin(admin.ModelAdmin):
    list_display = ["nom", "client", "nature", "mode_gestion", "statut", "date_remise"]
    list_filter = ["statut", "nature"]
    search_fields = ["nom", "client"]
    inlines = [PointDeVenteInline, ScenarioAOInline]
