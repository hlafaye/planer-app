"""
Sprint 2.5 : Import des referentiels EMPREINTES depuis les Excel de reference.
Sources : CHANEL BPU (produits, grammages, prix) + CHANEL CoutFixe (postes, FG, invest, taux charges).

Usage:
    python manage.py import_referentiels_v2

Les fichiers doivent etre dans /code/plane/templates_excel/references/
"""
import logging
from decimal import Decimal, InvalidOperation

from django.core.management.base import BaseCommand

logger = logging.getLogger("plane.configurateur.import")

REFS_DIR = "/code/plane/templates_excel/references"


def safe_decimal(val, default=None):
    if val is None:
        return default
    try:
        return Decimal(str(val))
    except (InvalidOperation, ValueError):
        return default


class Command(BaseCommand):
    help = "Import referentiels EMPREINTES depuis les Excel de reference"

    def handle(self, *args, **options):
        self.stdout.write("=== Import referentiels v2 ===")
        self._import_postes()
        self._import_taux_charges()
        self._import_frais_generaux()
        self._import_investissements()
        self._import_produits_bpu()
        self._import_tranches()
        self.stdout.write(self.style.SUCCESS("Import termine."))

    def _import_postes(self):
        """Import/update PosteType depuis CHANEL CoutFixe 'Frais de personnel_1&2'."""
        import openpyxl
        from plane.configurateur.models import PosteType

        path = "{}/CHANEL_CoutFixe.xlsx".format(REFS_DIR)
        wb = openpyxl.load_workbook(path, data_only=True)
        ws = wb["Frais de personnel_1&2"]

        # Mapping exact : (row, label_excel, section, est_mi_temps, categorie)
        POSTES = [
            (20, "Directeur / Responsable de restaurant", "Direction", False, "encadrement"),
            (21, "Adjoint(e) de direction / Responsable de caisse", "Direction", False, "encadrement"),
            (23, "Chef de cuisine / chef de production", "Cuisine et distribution", False, "cuisine"),
            (24, "Chef gerant", "Cuisine et distribution", False, "cuisine"),
            (25, "Second de cuisine / Chef de partie", "Cuisine et distribution", False, "cuisine"),
            (26, "Cuisinier", "Cuisine et distribution", False, "cuisine"),
            (27, "Commis de cuisine / Aide de cuisine", "Cuisine et distribution", False, "cuisine"),
            (28, "Patissier / Chef Patissier", "Cuisine et distribution", False, "cuisine"),
            (30, "Chef de groupe", "Preparations froides", False, "cuisine"),
            (31, "EDR / Hote / Hotesse de caisse", "Preparations froides", False, "salle"),
            (32, "EDR / Hote / Hotesse de caisse 1/2 temps", "Preparations froides", True, "salle"),
            (34, "Chef Plongeur", "Plonge", False, "support"),
            (35, "Plongeur", "Plonge", False, "support"),
            (36, "Plongeur 1/2 temps", "Plonge", True, "support"),
            (37, "Magasinier / Econome", "Plonge", False, "support"),
            (44, "Responsable Coffee/Alt", "Restauration Alternative", False, "salle"),
            (45, "Hote / Hotesse / Serveur / Serveuse", "Restauration Alternative", False, "salle"),
            (46, "Hote / Hotesse / Serveur(se) 1/2 temps", "Restauration Alternative", True, "salle"),
        ]

        count = 0
        for row, label, section, mi_temps, cat in POSTES:
            salaire = safe_decimal(ws.cell(row, 3).value)  # col C
            heures = 104 if mi_temps else 152

            obj, created = PosteType.objects.update_or_create(
                label_excel=label,
                defaults={
                    "nom": label.split("/")[0].strip() if "/" in label else label,
                    "qualification": section,
                    "categorie": cat,
                    "section_excel": section,
                    "ordre_excel": row,
                    "heures_mois": heures,
                    "est_mi_temps": mi_temps,
                    "salaire_brut_mensuel": salaire or Decimal("2000"),
                    "actif": True,
                },
            )
            count += 1
            if created:
                logger.info("Created PosteType: %s (row %d, salaire=%s)", label, row, salaire)

        self.stdout.write("  PosteType: {} imported/updated".format(count))

    def _import_taux_charges(self):
        """Import taux charges sociales par tranche depuis CHANEL CoutFixe."""
        from plane.configurateur.models import TauxChargesSociales

        # Extracted from row 59 cols J,M,P,S,V
        TAUX = [
            (1, Decimal("0.7180")),
            (2, Decimal("0.7010")),
            (3, Decimal("0.6460")),
            (4, Decimal("0.6478")),
            (5, Decimal("0.6499")),
        ]

        for tranche, taux in TAUX:
            TauxChargesSociales.objects.update_or_create(
                tranche=tranche,
                defaults={"taux": taux},
            )

        self.stdout.write("  TauxChargesSociales: {} imported".format(len(TAUX)))

    def _import_frais_generaux(self):
        """Import FG types depuis CHANEL CoutFixe 'Frais Generaux_1&2'."""
        from plane.configurateur.models import FraisGenerauxType

        # Extracted from the real CHANEL CoutFixe sheet
        FG_DATA = [
            ("fluides_chauffage", "FLUIDES", "Chauffage - Climatisation - Refrigeration", "ratio_couvert", 8),
            ("fluides_eau", "FLUIDES", "Eau (abonnement et consommations)", "ratio_couvert", 9),
            ("fluides_electricite", "FLUIDES", "Electricite (abonnement et consommations)", "ratio_couvert", 10),
            ("maint_batiment_go", "MAINTENANCE", "Entretien / Maintenance Batiments gros oeuvre", "forfait", 12),
            ("maint_batiment_so", "MAINTENANCE", "Entretien / Maintenance Batiments second oeuvre", "forfait", 13),
            ("maint_relamping", "MAINTENANCE", "Relamping", "forfait", 14),
            ("maint_reseaux", "MAINTENANCE", "Entretien / Maintenance Reseaux / equipements", "forfait", 15),
            ("maint_controles", "MAINTENANCE", "Controles reglementaires", "forfait", 16),
            ("maint_degradations", "MAINTENANCE", "Maintenance degradations prestataire", "forfait", 17),
            ("maint_divers", "MAINTENANCE", "Maintenance divers (controle acces, interphonie)", "forfait", 18),
            ("maint_preventive", "MAINTENANCE", "Contrat Maintenance PREVENTIVE equipements", "forfait", 19),
            ("maint_curative", "MAINTENANCE", "Contrat Maintenance CURATIVE equipements", "forfait", 20),
            ("maint_gros_equip", "MAINTENANCE", "Renouvellement gros equipements", "forfait", 21),
            ("maint_deratisation", "MAINTENANCE", "Deratisation / Desinfection / Desinsectisation", "forfait", 22),
            ("maint_sels", "MAINTENANCE", "Renouvellement Sels adoucisseurs", "forfait", 23),
            ("maint_cartouche", "MAINTENANCE", "Renouvellement Cartouche filtrante fontaine", "forfait", 24),
            ("maint_gaz", "MAINTENANCE", "Renouvellement Bonbonne de gaz", "forfait", 25),
            ("maint_hottes_vert", "MAINTENANCE", "Nettoyage hottes (gaines verticales et tourelles)", "forfait", 26),
            ("maint_hottes_horiz", "MAINTENANCE", "Nettoyage hottes (gaines horizontales + filtres)", "forfait", 27),
            ("maint_bac_graisse", "MAINTENANCE", "Bac a graisse (vidange et entretien)", "forfait", 28),
            ("nett_baies_int", "NETTOYAGE", "Nettoyage des baies vitrees interieures", "ratio_couvert", 30),
            ("nett_baies_ext", "NETTOYAGE", "Nettoyage des baies vitrees exterieures", "ratio_couvert", 31),
            ("nett_sols_production", "NETTOYAGE", "Nettoyage des sols zones PRODUCTION", "ratio_couvert", 32),
            ("nett_plafonds_production", "NETTOYAGE", "Nettoyage des plafonds zones PRODUCTION", "ratio_couvert", 33),
            ("nett_sols_back", "NETTOYAGE", "Nettoyage des sols BACK OFFICE", "ratio_couvert", 34),
            ("nett_murs_back_1", "NETTOYAGE", "Nettoyage des murs BACK OFFICE (1)", "ratio_couvert", 35),
            ("nett_murs_back_2", "NETTOYAGE", "Nettoyage des murs BACK OFFICE (2)", "ratio_couvert", 36),
            ("nett_murs_back_3", "NETTOYAGE", "Nettoyage des murs BACK OFFICE (3)", "ratio_couvert", 37),
            ("nett_plafonds_back", "NETTOYAGE", "Nettoyage des plafonds BACK OFFICE", "ratio_couvert", 38),
            ("nett_sols_distrib", "NETTOYAGE", "Nettoyage des sols DISTRIBUTION", "ratio_couvert", 39),
            ("nett_murs_distrib_1", "NETTOYAGE", "Nettoyage des murs DISTRIBUTION (1)", "ratio_couvert", 40),
            ("nett_murs_distrib_2", "NETTOYAGE", "Nettoyage des murs DISTRIBUTION (2)", "ratio_couvert", 41),
            ("nett_murs_distrib_3", "NETTOYAGE", "Nettoyage des murs DISTRIBUTION (3)", "ratio_couvert", 42),
            ("nett_plafonds_distrib", "NETTOYAGE", "Nettoyage des plafonds DISTRIBUTION", "ratio_couvert", 43),
            ("nett_sols_salle", "NETTOYAGE", "Nettoyage des sols SALLE", "ratio_couvert", 44),
            ("nett_murs_salle_1", "NETTOYAGE", "Nettoyage des murs SALLE (1)", "ratio_couvert", 45),
            ("nett_murs_salle_2", "NETTOYAGE", "Nettoyage des murs SALLE (2)", "ratio_couvert", 46),
            ("nett_murs_salle_3", "NETTOYAGE", "Nettoyage des murs SALLE (3)", "ratio_couvert", 47),
            ("nett_plafonds_salle", "NETTOYAGE", "Nettoyage des plafonds SALLE", "ratio_couvert", 48),
            ("nett_veille", "NETTOYAGE", "Nettoyage veille proprete", "ratio_couvert", 49),
            ("nett_tables", "NETTOYAGE", "Nettoyage des tables et chaises", "ratio_couvert", 50),
            ("lessiviels", "LESSIVIELS", "Produits lessiviels et d'entretien eco-labellises", "ratio_couvert", 52),
            ("telephone", "TELEPHONE", "Telephone + Bornes CB + E-recharge", "ratio_couvert", 54),
            ("monetique_maint", "MONETIQUE", "Entretien / Maintenance systeme monetique", "forfait", 56),
            ("signaletique_maint", "MONETIQUE", "Entretien / Maintenance signaletique", "forfait", 57),
            ("web_maint", "MONETIQUE", "Entretien / Maintenance site WEB / Intranet", "forfait", 58),
            ("loc_caisse_assistee", "MONETIQUE", "Location financiere caisse assistee", "forfait", 59),
            ("loc_caisse_ls", "MONETIQUE", "Location financiere caisse en libre-service", "forfait", 60),
            ("loc_borne", "MONETIQUE", "Location financiere borne de commande", "forfait", 61),
            ("monetique_logiciel", "MONETIQUE", "Logiciel de fluidite (droit d'exploitation)", "forfait", 62),
            ("linge", "LINGE", "Blanchissage vetements professionnels / Chaussures / Linge / EPI", "ratio_effectif", 65),
            ("dechets_tri", "DECHETS", "Tri des dechets + Enlevement des dechets", "ratio_couvert", 67),
            ("dechets_personnel", "DECHETS", "Enlevements dechets par personnel", "ratio_couvert", 68),
            ("conso_non_alim", "CONSOMMABLES", "Consommables non alimentaires", "ratio_couvert", 70),
            ("conso_vae", "CONSOMMABLES", "Consommables VAE biodegradable", "ratio_couvert", 71),
            ("fournitures_bureau", "CONSOMMABLES", "Perissables informatiques / Fournitures bureau", "forfait", 72),
            ("loc_collecteur_consigne", "CONSIGNES", "Location collecteur de consigne", "forfait", 74),
            ("renouvellement_consigne", "CONSIGNES", "Renouvellement dotation vaisselle consigne", "ratio_couvert", 75),
            ("renouvellement_vv", "RENOUVELLEMENT VV", "Renouvellement batterie de cuisine / verrerie / vaisselle", "ratio_couvert", 77),
            ("loc_machines_boissons", "LOCATION MATERIEL", "Location machines a boissons chaudes", "forfait", 79),
            ("loc_fontaines", "LOCATION MATERIEL", "Location fontaines a eau", "forfait", 80),
            ("loc_divers", "LOCATION MATERIEL", "Location materiel d'exploitation divers", "forfait", 81),
            ("animations", "AUTRES", "Animations", "forfait", 83),
            ("evenements", "AUTRES", "Evenements ponctuels (chef invite...)", "forfait", 84),
            ("enquete_satisfaction", "AUTRES", "Enquete de satisfaction", "forfait", 85),
            ("courrier", "AUTRES", "Affranchissement / Recuperation courrier", "forfait", 86),
            ("controle_sanitaire", "AUTRES", "Controle sanitaires et bacteriologiques", "forfait", 87),
            ("medecine_travail", "AUTRES", "Medecine du travail / Produits pharmaceutiques", "forfait", 88),
            ("externalisation", "EXTERNALISATION", "Couts de production externalisee", "ratio_couvert", 90),
            ("redevance_franchise", "EXTERNALISATION", "Redevance / licence de marque", "ratio_couvert", 91),
            ("cotisation_snrc", "ASSURANCES", "Cotisation SNRC", "forfait", 93),
            ("assurance_rc", "ASSURANCES", "Assurance RC", "forfait", 94),
            ("taxe_eco", "ASSURANCES", "Taxe eco-territoriale", "forfait", 95),
        ]

        import openpyxl
        wb = openpyxl.load_workbook("{}/CHANEL_CoutFixe.xlsx".format(REFS_DIR), data_only=True)
        ws = wb["Frais Généraux_1&2"]

        count = 0
        for code, section, libelle, mode, row_ref in FG_DATA:
            # Try to read the montant from col G (Tranche 1)
            montant = safe_decimal(ws.cell(row_ref, 7).value, Decimal("0"))

            obj, created = FraisGenerauxType.objects.update_or_create(
                code=code,
                defaults={
                    "libelle": libelle,
                    "section": section,
                    "mode_calcul": mode,
                    "montant_reference": montant,
                    "ordre": row_ref,
                },
            )
            count += 1

        self.stdout.write("  FraisGenerauxType: {} imported".format(count))

    def _import_investissements(self):
        """Import investissement types depuis CHANEL CoutFixe 'Invest, valorisation_1&2'."""
        from plane.configurateur.models import InvestissementType

        INVEST_DATA = [
            ("info_site_web", "INFORMATIQUE", "Site web / intranet", 0, 1, 9),
            ("monetique_caisse", "MONETIQUE", "Monetique (caisse + lecteurs)", 4894, 1, 12),
            ("signaletique", "SIGNALETIQUE", "Signaletique", 0, 1, 18),
            ("verrerie_vaisselle", "VERRERIE", "Verrerie, vaisselle, plateaux, couverts", 1795, 1, 25),
        ]

        count = 0
        for code, section, libelle, montant_def, qte, row_ref in INVEST_DATA:
            InvestissementType.objects.update_or_create(
                code=code,
                defaults={
                    "libelle": libelle,
                    "section": section,
                    "montant_unitaire": Decimal(str(montant_def)),
                    "quantite_defaut": qte,
                    "ordre": row_ref,
                },
            )
            count += 1

        self.stdout.write("  InvestissementType: {} imported".format(count))

    def _import_produits_bpu(self):
        """Import produits alimentaires depuis CHANEL BPU 'Prix Self'."""
        import openpyxl
        from plane.configurateur.models import ProduitAlimentaire

        path = "{}/CHANEL_BPU.xlsx".format(REFS_DIR)
        try:
            wb = openpyxl.load_workbook(path, data_only=True)
        except Exception as e:
            self.stdout.write(self.style.WARNING("  BPU not found: {}".format(e)))
            return

        # Find the "Prix Self" or similar sheet
        prix_sheet = None
        for name in wb.sheetnames:
            if "prix" in name.lower() and "self" in name.lower():
                prix_sheet = name
                break
        if not prix_sheet:
            self.stdout.write(self.style.WARNING("  No 'Prix Self' sheet found"))
            return

        ws = wb[prix_sheet]
        count = 0

        for r in range(2, ws.max_row + 1):
            designation = ws.cell(r, 1).value
            if not designation or not isinstance(designation, str):
                continue
            designation = designation.strip()
            if not designation or len(designation) < 2:
                continue

            # Skip headers and section labels
            if designation.upper() == designation and len(designation) > 30:
                continue

            prix_ht = safe_decimal(ws.cell(r, 4).value) or safe_decimal(ws.cell(r, 3).value)

            ProduitAlimentaire.objects.update_or_create(
                designation=designation[:255],
                defaults={
                    "types_pdv": ["self"],
                    "prix_ht_reference": prix_ht,
                    "actif": True,
                },
            )
            count += 1

        self.stdout.write("  ProduitAlimentaire: {} imported from {}".format(count, prix_sheet))

    def _import_tranches(self):
        """Import tranches de frequentation standards."""
        from plane.configurateur.models import TrancheFrequentation

        # Tranches standards EMPREINTES (a affiner avec le template reel)
        TRANCHES = [
            (0, 0, 99, 50),
            (1, 100, 399, 200),
            (2, 400, 799, 600),
            (3, 800, 1199, 1000),
            (4, 1200, 1599, 1400),
            (5, 1600, 2499, 2000),
            (6, 2500, 3499, 3000),
            (7, 3500, 4999, 4000),
            (8, 5000, 6999, 6000),
            (9, 7000, 9999, 8000),
            (10, 10000, 99999, 15000),
        ]

        for num, bmin, bmax, med in TRANCHES:
            TrancheFrequentation.objects.update_or_create(
                numero=num,
                defaults={"borne_min": bmin, "borne_max": bmax, "mediane": med},
            )

        self.stdout.write("  TrancheFrequentation: {} imported".format(len(TRANCHES)))
