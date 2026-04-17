# Planer custom: Configurateur AO — models
# Référentiels EMPREINTES + Projets AO + Scénarios

from django.db import models
from plane.db.models.base import BaseModel

TYPES_PDV = [
    ("self", "Self-Service"),
    ("cafeteria", "Cafétéria"),
    ("brasserie", "Brasserie"),
    ("room_service", "Room Service"),
    ("club_vip", "Club VIP"),
    ("da", "Distributeur Auto"),
    ("dflab", "Digital Food Lab"),
]


# ============ RÉFÉRENTIELS EMPREINTES ============


class Mercuriale(models.Model):
    """Base des catégories de produits alimentaires avec 4 niveaux de prix."""
    categorie = models.CharField(max_length=100)
    sous_categorie = models.CharField(max_length=100, blank=True, default="")
    prix_eco = models.DecimalField(max_digits=8, decimal_places=3, null=True, blank=True)
    prix_standard = models.DecimalField(max_digits=8, decimal_places=3, null=True, blank=True)
    prix_premium = models.DecimalField(max_digits=8, decimal_places=3, null=True, blank=True)
    prix_luxe = models.DecimalField(max_digits=8, decimal_places=3, null=True, blank=True)
    unite = models.CharField(max_length=20, default="kg")
    saisonnalite = models.CharField(max_length=50, blank=True, default="")
    date_maj = models.DateField(auto_now=True)

    class Meta:
        db_table = "ao_mercuriale"
        unique_together = [("categorie", "sous_categorie")]
        ordering = ["categorie", "sous_categorie"]

    def __str__(self):
        s = self.categorie
        if self.sous_categorie:
            s += " - " + self.sous_categorie
        return s


class PosteType(models.Model):
    """Grille des postes standards avec salaires et charges."""
    nom = models.CharField(max_length=100)
    qualification = models.CharField(max_length=50, blank=True, default="")
    niveau = models.CharField(max_length=20, blank=True, default="")
    salaire_brut_mensuel = models.DecimalField(max_digits=10, decimal_places=2)
    taux_charges = models.DecimalField(max_digits=5, decimal_places=2, default=45)
    CATEGORIES = [
        ("cuisine", "Cuisine"),
        ("salle", "Salle"),
        ("encadrement", "Encadrement"),
        ("support", "Support"),
    ]
    categorie = models.CharField(max_length=50, choices=CATEGORIES, default="cuisine")

    # Sprint 2.5 : enrichissement pour mapping Excel exact
    heures_mois = models.IntegerField(default=152)  # 152h temps plein, 104h mi-temps
    label_excel = models.CharField(max_length=255, blank=True, default="")
    section_excel = models.CharField(max_length=100, blank=True, default="")
    ordre_excel = models.IntegerField(default=0)
    est_mi_temps = models.BooleanField(default=False)
    actif = models.BooleanField(default=True)

    class Meta:
        db_table = "ao_postes_types"

    def __str__(self):
        return "{} ({})".format(self.nom, self.qualification)


class MatriceStaffing(models.Model):
    """ETP par poste par tranche de fréquentation."""
    type_pdv = models.CharField(max_length=50, choices=TYPES_PDV)
    tranche = models.IntegerField()
    poste = models.ForeignKey(PosteType, on_delete=models.CASCADE)
    nb_etp = models.DecimalField(max_digits=4, decimal_places=2)

    class Meta:
        db_table = "ao_matrice_staffing"
        unique_together = [("type_pdv", "tranche", "poste")]


class CategorieEquipement(models.Model):
    """Catégories d'équipements avec durée d'amortissement."""
    nom = models.CharField(max_length=100)
    duree_amortissement_annees = models.IntegerField(default=5)

    class Meta:
        db_table = "ao_categories_equipement"

    def __str__(self):
        return "{} ({} ans)".format(self.nom, self.duree_amortissement_annees)


class EquipementType(models.Model):
    """Équipements standards par type de PdV."""
    nom = models.CharField(max_length=255)
    categorie = models.ForeignKey(CategorieEquipement, on_delete=models.CASCADE)
    prix_indicatif = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    type_pdv_applicable = models.JSONField(default=list)

    class Meta:
        db_table = "ao_equipements_types"

    def __str__(self):
        return self.nom


class Grammage(models.Model):
    """Poids par composant selon type de PdV."""
    type_pdv = models.CharField(max_length=50, choices=TYPES_PDV)
    composant = models.CharField(max_length=100)
    grammage_grammes = models.IntegerField()

    class Meta:
        db_table = "ao_grammages"


class StructureOffreType(models.Model):
    """Nombre de choix par composant par tranche."""
    type_pdv = models.CharField(max_length=50, choices=TYPES_PDV)
    tranche = models.IntegerField()
    composant = models.CharField(max_length=100)
    nb_choix = models.IntegerField()

    class Meta:
        db_table = "ao_structure_offre"


# ============ PROJET AO ============


class ProjetAO(BaseModel):
    """Un projet d'appel d'offres en cours de configuration."""
    workspace = models.ForeignKey(
        "db.Workspace", on_delete=models.CASCADE, related_name="projets_ao"
    )

    nom = models.CharField(max_length=255)
    client = models.CharField(max_length=255)
    localisation = models.CharField(max_length=255, blank=True, default="")
    date_remise = models.DateField(null=True, blank=True)
    date_ouverture_visee = models.DateField(null=True, blank=True)

    # Sprint 2.5 : parametres projet supplementaires
    duree_contrat_annees = models.IntegerField(default=5)
    pct_frais_siege = models.DecimalField(max_digits=4, decimal_places=2, default=6.5)
    pct_produits_achats = models.DecimalField(max_digits=4, decimal_places=2, default=25)
    remise_commerciale_pct = models.DecimalField(max_digits=4, decimal_places=2, default=0)
    semaines_par_an = models.IntegerField(default=45)

    NATURES = [
        ("ouverture", "Ouverture"),
        ("reprise", "Reprise"),
        ("renouvellement", "Renouvellement"),
    ]
    nature = models.CharField(max_length=20, choices=NATURES, default="ouverture")

    PERIMETRES = [
        ("mono", "Mono-PdV"),
        ("multi", "Multi-PdV"),
        ("multisites", "Multi-sites"),
    ]
    perimetre = models.CharField(max_length=20, choices=PERIMETRES, default="mono")

    MODES_GESTION = [
        ("masse_frais", "Masse de frais"),
        ("admission", "Admission / Subvention"),
        ("mixte", "Mixte"),
        ("ticket", "Tout sur le ticket"),
        ("custom", "Autre / Custom"),
    ]
    mode_gestion = models.CharField(max_length=20, choices=MODES_GESTION, default="mixte")

    HORAIRES = [
        ("midi", "Midi"),
        ("midi_soir", "Midi + Soir"),
        ("continu", "Continu"),
        ("pdj_midi", "Petit-déj + Midi"),
    ]
    horaires_service = models.CharField(max_length=50, choices=HORAIRES, default="midi")

    scoring_concept_pct = models.IntegerField(default=20)
    scoring_rh_pct = models.IntegerField(default=15)
    scoring_qualite_pct = models.IntegerField(default=10)
    scoring_rse_pct = models.IntegerField(default=15)
    scoring_prix_pct = models.IntegerField(default=40)

    cctp_pdf = models.FileField(upload_to="ao/cctp/", null=True, blank=True)

    projet_planer = models.ForeignKey(
        "db.Project", null=True, blank=True, on_delete=models.SET_NULL, related_name="source_ao"
    )

    STATUTS = [
        ("draft", "Brouillon"),
        ("en_cours", "En cours de configuration"),
        ("fige", "Configuration figée"),
        ("remis", "Remis au client"),
        ("gagne", "Gagné"),
        ("perdu", "Perdu"),
    ]
    statut = models.CharField(max_length=20, choices=STATUTS, default="draft")

    class Meta:
        db_table = "ao_projets"
        ordering = ["-updated_at"]

    def __str__(self):
        return "{} - {}".format(self.nom, self.client)


class PointDeVente(BaseModel):
    """Un PdV dans un projet AO."""
    projet_ao = models.ForeignKey(ProjetAO, related_name="points_de_vente", on_delete=models.CASCADE)
    type_pdv = models.CharField(max_length=50, choices=TYPES_PDV)
    nom = models.CharField(max_length=255)
    tranche_frequentation = models.IntegerField(default=1)
    couverts_jour_cible = models.IntegerField(default=0)
    jours_ouvres_mois = models.IntegerField(default=20)

    # Sprint 2.5
    nb_tranches = models.IntegerField(default=5)
    jours_basse_frequentation = models.IntegerField(default=0)
    horaires_ouverture = models.CharField(max_length=100, blank=True, default="")
    taux_tva = models.DecimalField(max_digits=4, decimal_places=2, default=10.0)

    class Meta:
        db_table = "ao_points_de_vente"

    def __str__(self):
        return "{} ({})".format(self.nom, self.get_type_pdv_display())


class ScenarioAO(BaseModel):
    """Un scénario de configuration."""
    projet_ao = models.ForeignKey(ProjetAO, related_name="scenarios", on_delete=models.CASCADE)
    nom = models.CharField(max_length=100)
    description = models.TextField(blank=True, default="")
    parametres = models.JSONField(default=dict, blank=True)
    resultats = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = "ao_scenarios"

    def __str__(self):
        return self.nom


class CalculSnapshot(BaseModel):
    """Snapshot des calculs à un instant T."""
    scenario = models.ForeignKey(ScenarioAO, related_name="snapshots", on_delete=models.CASCADE)
    ca_mensuel = models.DecimalField(max_digits=12, decimal_places=2, null=True)
    cout_matiere = models.DecimalField(max_digits=12, decimal_places=2, null=True)
    masse_salariale = models.DecimalField(max_digits=12, decimal_places=2, null=True)
    frais_generaux = models.DecimalField(max_digits=12, decimal_places=2, null=True)
    amortissements = models.DecimalField(max_digits=12, decimal_places=2, null=True)
    resultat = models.DecimalField(max_digits=12, decimal_places=2, null=True)
    marge_pct = models.DecimalField(max_digits=5, decimal_places=2, null=True)
    cout_par_couvert = models.DecimalField(max_digits=8, decimal_places=2, null=True)
    score_estime = models.IntegerField(null=True)
    details = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = "ao_calcul_snapshots"
        ordering = ["-created_at"]


# ============ SPRINT 2.5 : REFERENTIELS NIVEAU 1 (catalogue EMPREINTES) ============


class TrancheFrequentation(models.Model):
    """Bornes standards des tranches de frequentation (0 a 10)."""
    numero = models.IntegerField(unique=True)
    borne_min = models.IntegerField(default=0)
    borne_max = models.IntegerField(default=0)
    mediane = models.IntegerField(default=0)

    class Meta:
        db_table = "ao_tranches_frequentation"
        ordering = ["numero"]

    def __str__(self):
        return "T{} ({}-{})".format(self.numero, self.borne_min, self.borne_max)


class ProduitAlimentaire(models.Model):
    """Catalogue des produits alimentaires EMPREINTES (BPU)."""
    designation = models.CharField(max_length=255)
    famille = models.CharField(max_length=100, blank=True, default="")
    gamme = models.CharField(max_length=50, blank=True, default="")  # Frais, ambiant, surgele...
    categorie = models.CharField(max_length=80, blank=True, default="")
    grammage_net_min = models.DecimalField(max_digits=6, decimal_places=3, null=True, blank=True)
    grammage_net_max = models.DecimalField(max_digits=6, decimal_places=3, null=True, blank=True)
    perte_pct = models.DecimalField(max_digits=4, decimal_places=2, default=0)
    prix_ht_reference = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    types_pdv = models.JSONField(default=list, blank=True)
    actif = models.BooleanField(default=True)
    date_maj = models.DateField(auto_now=True)

    class Meta:
        db_table = "ao_produits_alimentaires"
        ordering = ["famille", "designation"]

    def __str__(self):
        return self.designation


class GradationPrix(models.Model):
    """Fourchettes de prix par gamme par categorie."""
    categorie_produit = models.CharField(max_length=100)
    gamme_numero = models.IntegerField()
    prix_ttc_min = models.DecimalField(max_digits=6, decimal_places=2)
    prix_ttc_max = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)

    class Meta:
        db_table = "ao_gradation_prix"
        unique_together = [("categorie_produit", "gamme_numero")]


class FraisGenerauxType(models.Model):
    """Les ~50 postes de frais generaux standards EMPREINTES."""
    code = models.CharField(max_length=50, unique=True)
    libelle = models.CharField(max_length=255)
    section = models.CharField(max_length=100)
    MODE_CALCUL = [
        ("forfait", "Forfait fixe mensuel"),
        ("ratio_couvert", "Ratio au couvert"),
        ("ratio_effectif", "Ratio a l'effectif"),
        ("pct_ca", "% du CA"),
    ]
    mode_calcul = models.CharField(max_length=20, choices=MODE_CALCUL, default="forfait")
    montant_reference = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    varie_par_tranche = models.BooleanField(default=False)
    ordre = models.IntegerField(default=0)

    class Meta:
        db_table = "ao_frais_generaux_types"
        ordering = ["ordre"]

    def __str__(self):
        return "{} ({})".format(self.libelle, self.section)


class FraisGenerauxBareme(models.Model):
    """Montant de reference par type de FG par tranche."""
    fg_type = models.ForeignKey(FraisGenerauxType, related_name="baremes", on_delete=models.CASCADE)
    tranche = models.IntegerField()
    montant = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        db_table = "ao_frais_generaux_baremes"
        unique_together = [("fg_type", "tranche")]


class InvestissementType(models.Model):
    """Types d'investissements avec parametrage par defaut."""
    code = models.CharField(max_length=50, unique=True)
    libelle = models.CharField(max_length=255)
    section = models.CharField(max_length=100)
    montant_unitaire = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    quantite_defaut = models.IntegerField(default=1)
    FINANCEUR = [
        ("prestataire_repercute", "Prestataire repercute"),
        ("prestataire_non_repercute", "Prestataire non repercute"),
        ("client", "Client"),
    ]
    financeur = models.CharField(max_length=30, choices=FINANCEUR, default="prestataire_repercute")
    duree_amortissement = models.IntegerField(default=5)
    pct_frais_financiers = models.DecimalField(max_digits=4, decimal_places=2, default=0)
    varie_par_tranche = models.BooleanField(default=False)
    ordre = models.IntegerField(default=0)

    class Meta:
        db_table = "ao_investissements_types"
        ordering = ["ordre"]

    def __str__(self):
        return "{} ({})".format(self.libelle, self.section)


class InvestissementBareme(models.Model):
    """Montant d'investissement par tranche."""
    invest_type = models.ForeignKey(InvestissementType, related_name="baremes", on_delete=models.CASCADE)
    tranche = models.IntegerField()
    montant = models.DecimalField(max_digits=10, decimal_places=2)
    quantite = models.IntegerField(default=1)

    class Meta:
        db_table = "ao_investissements_baremes"
        unique_together = [("invest_type", "tranche")]


class TauxChargesSociales(models.Model):
    """Taux de charges sociales par tranche."""
    tranche = models.IntegerField(unique=True)
    taux = models.DecimalField(max_digits=5, decimal_places=4)

    class Meta:
        db_table = "ao_taux_charges_sociales"

    def __str__(self):
        return "T{}: {}".format(self.tranche, self.taux)


# ============ SPRINT 2.5 : NIVEAU 2 — PARAMETRES PAR PROJET AO ============


class ProgrammeOuverture(models.Model):
    """Programme d'ouverture par PdV par tranche pour un projet AO."""
    projet_ao = models.ForeignKey(ProjetAO, related_name="programmes_ouverture", on_delete=models.CASCADE)
    point_de_vente = models.ForeignKey(PointDeVente, related_name="programmes", on_delete=models.CASCADE)
    tranche = models.IntegerField()
    est_ouvert = models.BooleanField(default=True)
    horaires = models.CharField(max_length=100, blank=True, default="")
    mode_service = models.CharField(max_length=100, blank=True, default="")
    nb_comptoirs_chauds_assiste = models.IntegerField(default=0)
    nb_comptoirs_chauds_ls = models.IntegerField(default=0)

    class Meta:
        db_table = "ao_programmes_ouverture"
        unique_together = [("projet_ao", "point_de_vente", "tranche")]


class ProjetAOFG(models.Model):
    """Surcharge des FG pour un projet AO specifique."""
    projet_ao = models.ForeignKey(ProjetAO, related_name="fg_overrides", on_delete=models.CASCADE)
    fg_type = models.ForeignKey(FraisGenerauxType, on_delete=models.CASCADE)
    tranche = models.IntegerField()
    montant = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        db_table = "ao_projet_fg"
        unique_together = [("projet_ao", "fg_type", "tranche")]


class ProjetAOInvest(models.Model):
    """Surcharge des investissements pour un projet AO specifique."""
    projet_ao = models.ForeignKey(ProjetAO, related_name="invest_overrides", on_delete=models.CASCADE)
    invest_type = models.ForeignKey(InvestissementType, on_delete=models.CASCADE)
    tranche = models.IntegerField()
    montant = models.DecimalField(max_digits=10, decimal_places=2)
    quantite = models.IntegerField(default=1)

    class Meta:
        db_table = "ao_projet_invest"
        unique_together = [("projet_ao", "invest_type", "tranche")]


class ProjetAOPrix(models.Model):
    """Prix HT par produit pour un projet AO."""
    projet_ao = models.ForeignKey(ProjetAO, related_name="prix_overrides", on_delete=models.CASCADE)
    produit = models.ForeignKey(ProduitAlimentaire, on_delete=models.CASCADE)
    prix_ht = models.DecimalField(max_digits=8, decimal_places=2)

    class Meta:
        db_table = "ao_projet_prix"
        unique_together = [("projet_ao", "produit")]
