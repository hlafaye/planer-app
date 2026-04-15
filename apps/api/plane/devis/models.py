# Planer custom: Module Devis — models
# Fournisseurs, Devis, Validation, BdC, Factures

from django.db import models
from plane.db.models.base import BaseModel


class Fournisseur(BaseModel):
    """Fournisseur référencé dans le workspace."""
    workspace = models.ForeignKey(
        "db.Workspace", on_delete=models.CASCADE, related_name="fournisseurs"
    )
    nom = models.CharField(max_length=255)
    siret = models.CharField(max_length=14, blank=True, default="")
    contact_nom = models.CharField(max_length=255, blank=True, default="")
    contact_email = models.EmailField(blank=True, default="")
    contact_tel = models.CharField(max_length=20, blank=True, default="")
    categorie_principale = models.CharField(max_length=100, blank=True, default="")
    notes = models.TextField(blank=True, default="")

    class Meta:
        db_table = "devis_fournisseurs"
        unique_together = [("workspace", "nom")]

    def __str__(self):
        return self.nom


class Devis(BaseModel):
    """Devis fournisseur ou client lié à un projet."""

    TYPE_CHOICES = [
        ("fournisseur", "Fournisseur"),
        ("sous_traitant", "Sous-traitant"),
        ("personnel", "Personnel"),
        ("client", "Client"),
    ]
    STATUT_CHOICES = [
        ("draft", "Brouillon"),
        ("pending", "En attente de validation"),
        ("approved", "Approuvé"),
        ("rejected", "Rejeté"),
        ("modif_requested", "Modification demandée"),
        ("ordered", "Commandé"),
        ("delivered", "Livré"),
        ("invoiced", "Facturé"),
        ("archived", "Archivé"),
    ]

    project = models.ForeignKey(
        "db.Project", on_delete=models.CASCADE, related_name="devis"
    )
    workspace = models.ForeignKey(
        "db.Workspace", on_delete=models.CASCADE, related_name="devis"
    )
    reference = models.CharField(max_length=50, unique=True)
    type_devis = models.CharField(max_length=20, choices=TYPE_CHOICES)

    nom = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    fournisseur = models.ForeignKey(
        Fournisseur, null=True, blank=True, on_delete=models.SET_NULL,
        related_name="devis",
    )
    module = models.ForeignKey(
        "db.Module", null=True, blank=True, on_delete=models.SET_NULL
    )
    poste_budget = models.CharField(max_length=100, blank=True, default="")
    categorie = models.CharField(max_length=100, blank=True, default="")

    montant_ht = models.DecimalField(max_digits=12, decimal_places=2)
    tva_taux = models.DecimalField(max_digits=5, decimal_places=2, default=20.00)
    tva_montant = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    montant_ttc = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    devise = models.CharField(max_length=3, default="EUR")

    date_devis = models.DateField()
    date_livraison_prevue = models.DateField(null=True, blank=True)
    date_livraison_reelle = models.DateField(null=True, blank=True)

    statut = models.CharField(max_length=20, choices=STATUT_CHOICES, default="draft")

    # Linked Plane entities
    issue_liee = models.OneToOneField(
        "db.Issue", null=True, blank=True, on_delete=models.SET_NULL
    )

    # Files
    pdf_original = models.FileField(upload_to="devis/", null=True, blank=True)
    donnees_ocr = models.JSONField(default=dict, blank=True)

    # Validation state
    validation_rule = models.ForeignKey(
        "ValidationRule", null=True, blank=True, on_delete=models.SET_NULL,
        related_name="devis_en_validation",
    )
    validation_step = models.IntegerField(default=0)
    current_validators = models.ManyToManyField(
        "db.User", blank=True, related_name="devis_a_valider",
    )

    class Meta:
        db_table = "devis_devis"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["project", "statut"]),
            models.Index(fields=["fournisseur"]),
        ]

    def __str__(self):
        return "{} — {} ({})".format(self.reference, self.nom, self.get_statut_display())

    def save(self, *args, **kwargs):
        # Auto-calculate TVA and TTC
        if self.montant_ht:
            self.tva_montant = self.montant_ht * self.tva_taux / 100
            self.montant_ttc = self.montant_ht + self.tva_montant
        # Auto-generate reference
        if not self.reference:
            from django.utils import timezone
            year = timezone.now().year
            count = Devis.objects.filter(
                project=self.project,
                created_at__year=year,
            ).count() + 1
            identifier = self.project.identifier if self.project else "DEV"
            self.reference = "DEV-{}-{}-{:04d}".format(identifier, year, count)
        super().save(*args, **kwargs)


class ValidationRule(BaseModel):
    """Règle de validation par seuil de montant."""
    MODE_CHOICES = [
        ("auto", "Auto-approuvé"),
        ("one", "Un validateur"),
        ("chain", "Chaîne de validation"),
        ("all", "Tous les validateurs"),
    ]

    project = models.ForeignKey(
        "db.Project", on_delete=models.CASCADE, related_name="devis_validation_rules"
    )
    type_devis = models.CharField(max_length=20, choices=Devis.TYPE_CHOICES)
    max_amount = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True
    )
    validators = models.ManyToManyField(
        "db.User", related_name="devis_validation_rules", blank=True
    )
    mode = models.CharField(max_length=20, choices=MODE_CHOICES, default="one")
    order = models.IntegerField(default=0)

    class Meta:
        db_table = "devis_validation_rules"
        ordering = ["project", "type_devis", "order"]


class ValidationAction(BaseModel):
    """Historique des actions de validation sur un devis."""
    ACTION_CHOICES = [
        ("submit", "Soumis"),
        ("approve", "Approuvé"),
        ("reject", "Rejeté"),
        ("request_modif", "Modification demandée"),
        ("delegate", "Délégué"),
        ("resubmit", "Resoumis"),
    ]

    devis = models.ForeignKey(
        Devis, on_delete=models.CASCADE, related_name="actions"
    )
    action = models.CharField(max_length=20, choices=ACTION_CHOICES)
    from_user = models.ForeignKey(
        "db.User", on_delete=models.CASCADE, related_name="devis_actions_faites"
    )
    to_user = models.ForeignKey(
        "db.User", null=True, blank=True, on_delete=models.SET_NULL,
        related_name="devis_actions_recues",
    )
    comment = models.TextField(blank=True, default="")

    class Meta:
        db_table = "devis_validation_actions"
        ordering = ["-created_at"]


class BonDeCommande(BaseModel):
    """Bon de commande généré après approbation d'un devis."""
    devis = models.OneToOneField(
        Devis, on_delete=models.CASCADE, related_name="bon_de_commande"
    )
    reference = models.CharField(max_length=50, unique=True)
    pdf_genere = models.FileField(upload_to="bc/", null=True, blank=True)
    date_envoi_fournisseur = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "devis_bons_commande"

    def __str__(self):
        return self.reference


class Facture(BaseModel):
    """Facture reçue du fournisseur."""
    devis = models.ForeignKey(
        Devis, on_delete=models.CASCADE, related_name="factures"
    )
    reference_fournisseur = models.CharField(max_length=100)
    montant_ht = models.DecimalField(max_digits=12, decimal_places=2)
    montant_ttc = models.DecimalField(max_digits=12, decimal_places=2)
    date_facture = models.DateField()
    date_paiement = models.DateField(null=True, blank=True)
    pdf = models.FileField(upload_to="factures/", null=True, blank=True)

    class Meta:
        db_table = "devis_factures"
        ordering = ["-date_facture"]

    def __str__(self):
        return "{} — {}".format(self.reference_fournisseur, self.montant_ttc)
