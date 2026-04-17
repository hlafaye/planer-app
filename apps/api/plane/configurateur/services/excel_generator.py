"""
Generateurs Excel pour les 3 documents AO (BPU, Budget, CoutFixe).

Strategie : on charge les templates EMPREINTES depuis /code/plane/templates_excel/,
on ecrit dans les cellules d'INPUT (pas les formules), et on sauvegarde.
Excel recalcule automatiquement les formules a l'ouverture.
"""
import io
import logging
import zipfile
from decimal import Decimal

import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment

from .excel_mapping import (
    BUDGET_INPUT_CELLS, MOIS_COLS, write_input_cell,
)
from .simulation_engine import SimulationEngine
from .activity_calculator import D

logger = logging.getLogger("plane.configurateur.excel")

TEMPLATES_DIR = "/code/plane/templates_excel"
TEMPLATE_BPU = "{}/BPU_template.xlsx".format(TEMPLATES_DIR)
TEMPLATE_BUDGET = "{}/Budget_template.xlsx".format(TEMPLATES_DIR)
TEMPLATE_COUTFIXE = "{}/CoutFixe_template.xlsx".format(TEMPLATES_DIR)

# Charte EMPREINTES
EMPREINTES_TERRACOTTA = "BF5D48"
EMPREINTES_CHLOROPHYLE = "385835"
EMPREINTES_CREME = "FAF7F4"


class BaseGenerator:
    """Base pour les 3 generateurs Excel."""

    template_path = None

    def __init__(self, projet, scenario=None, simulation=None):
        self.projet = projet
        self.scenario = scenario
        # Si pas de scenario fourni, on lance une simulation depuis params scenario ou {}
        params = (scenario.parametres if scenario else {}) or {}
        self.simulation = simulation or SimulationEngine(projet, params).run()

    def generate(self):
        """Genere le fichier Excel et retourne BytesIO."""
        wb = openpyxl.load_workbook(self.template_path, data_only=False)
        self._fill(wb)
        self._add_footer(wb)
        out = io.BytesIO()
        wb.save(out)
        out.seek(0)
        return out

    def _fill(self, wb):
        raise NotImplementedError

    def _add_footer(self, wb):
        """Ajoute footer EMPREINTES sur chaque onglet."""
        for sheet in wb.sheetnames:
            ws = wb[sheet]
            ws.oddFooter.right.text = "EMPREINTES - AO {}".format(self.projet.client)
            ws.oddFooter.right.size = 9
            ws.oddFooter.right.color = EMPREINTES_TERRACOTTA


# ═══════════════════════════════════════════════════════════════════════════
# BUDGET — Budget Previsionnel (5 onglets)
# ═══════════════════════════════════════════════════════════════════════════

class BudgetGenerator(BaseGenerator):
    template_path = TEMPLATE_BUDGET

    def _fill(self, wb):
        self._fill_activite(wb)
        self._fill_synthese(wb)
        self._fill_masse_salariale(wb)
        self._fill_frais_generaux(wb)

    def _fill_activite(self, wb):
        """Onglet 'Activité' : jours, couverts, parametres CA."""
        ws = wb["Activité"]
        sim = self.simulation
        cells = BUDGET_INPUT_CELLS["Activité"]

        # Jours ouvres et couverts/jour : on prend les valeurs PdV agregees
        # Pour la cible 2026 : on repartit l'annee selon les PdV
        couverts_mois = sim["activity"]["couverts_mois"]
        jours_total = max(int(sum(p["jours_ouvres_mois"] for p in sim["activity"]["pdv_details"]) / max(len(sim["activity"]["pdv_details"]), 1)), 20)
        cvts_jour = int(couverts_mois / jours_total) if jours_total else 0

        # On ecrit jours/cvts par mois (uniforme avec saisonnalite legere)
        # Pondere par un coefficient saison stylise (ete plus bas)
        coefs = [0, 0, 0.9, 1.0, 1.0, 1.05, 1.05, 0.6, 0.4, 1.1, 1.05, 0.95]
        # Janvier=0/Fevrier=0 si mode ouverture (debut activite)
        if self.projet.nature == "ouverture":
            coefs[0] = 0
            coefs[1] = 0
        else:
            coefs[0] = 1.0
            coefs[1] = 1.0

        for i, col in enumerate(MOIS_COLS):
            j = 0 if coefs[i] == 0 else jours_total
            c = 0 if coefs[i] == 0 else int(cvts_jour * coefs[i])
            write_input_cell(ws, cells["jours_ouvres_2026"][col], j)
            write_input_cell(ws, cells["couverts_jour_2026"][col], c)

        # Parametres CA
        params = sim.get("params_used", {})
        if "prix_admission" in params:
            write_input_cell(ws, cells["ca_cvt_self"], float(params["prix_admission"]), allow_overwrite_formula=True)
        else:
            write_input_cell(ws, cells["ca_cvt_self"], float(sim["pl"]["ca_convives"] / max(sim["activity"]["couverts_mois"], 1)), allow_overwrite_formula=True)

        cpc_matiere = sim["matiere"]["cout_par_couvert"]
        write_input_cell(ws, cells["cout_mp_self"], float(cpc_matiere), allow_overwrite_formula=True)

    def _fill_synthese(self, wb):
        """Onglet 'Synthèse' : juste le titre du projet."""
        ws = wb["Synthèse"]
        # A1 contient '2026' par defaut, on n'y touche pas
        # On ajoute le nom du projet en haut a droite
        try:
            ws["P1"] = "AO {} - {}".format(self.projet.client, self.projet.nom)
            ws["P1"].font = Font(bold=True, color=EMPREINTES_TERRACOTTA)
        except Exception:
            pass

    def _fill_masse_salariale(self, wb):
        """Onglet 'Masse salariale' : alimente les salaires depuis StaffingCalculator."""
        ws = wb["Masse salariale"]
        sim = self.simulation
        detail = sim["staffing"]["detail_postes"]

        # Mapping des postes Planer vers les lignes du template
        # Strategie : on parcourt le template ligne par ligne, on matche par nom de poste
        mapping = BUDGET_INPUT_CELLS["Masse salariale"]["salaire_par_ligne"]

        # Construction d'un index detail par nom normalise
        detail_by_name = {}
        for p in detail:
            key = p.get("nom", "").upper().strip()
            if key:
                detail_by_name[key] = p

        for row, expected_label in mapping.items():
            cell_label = ws.cell(row=row, column=1).value
            if not cell_label:
                continue
            # Match par debut de label (souple)
            cell_key = str(cell_label).upper().strip()
            matched = None
            for name, p in detail_by_name.items():
                if cell_key.startswith(name[:6]) or name.startswith(cell_key[:6]):
                    matched = p
                    break

            if matched:
                # Ecrit le salaire brut (override formule existante)
                col_sal = BUDGET_INPUT_CELLS["Masse salariale"]["col_salaire_brut"]
                coord = "{}{}".format(col_sal, row)
                write_input_cell(ws, coord, matched["salaire_brut_unitaire"], allow_overwrite_formula=True)

    def _fill_frais_generaux(self, wb):
        """Onglet 'Frais généraux' : alimente les P.U colonne C."""
        ws = wb["Frais généraux"]
        sim = self.simulation
        # Construction d'un dict {sous_poste: pu}
        pu_by_label = {}
        for fg in sim["fg"]["detail"]:
            label = fg["sous_poste"]
            pu_by_label[label.lower()] = fg["valeur_unitaire"]

        # Parcourir lignes connues du mapping et alimenter colonne C (P.U)
        mapping = BUDGET_INPUT_CELLS["Frais généraux"]["pu_par_ligne"]
        col_pu = BUDGET_INPUT_CELLS["Frais généraux"]["col_pu"]

        for row, label_expected in mapping.items():
            cell_label = ws.cell(row=row, column=2).value  # B = libelle
            if not cell_label:
                continue
            key = str(cell_label).lower().strip()
            # Matching souple
            for k, v in pu_by_label.items():
                if k.startswith(key[:8]) or key.startswith(k[:8]):
                    coord = "{}{}".format(col_pu, row)
                    write_input_cell(ws, coord, float(v))
                    break


# ═══════════════════════════════════════════════════════════════════════════
# BPU — Bordereau Prix Unitaires (25 onglets)
# ═══════════════════════════════════════════════════════════════════════════

class BPUGenerator(BaseGenerator):
    """BPU : template enrichi avec contexte projet + suppression onglets non pertinents."""
    template_path = TEMPLATE_BPU

    # Mapping type_pdv -> onglets a garder
    TYPE_PDV_SHEETS = {
        "self": ["Catégories Self", "Prix Self", "Analyse Self service", "Analyse PLATEAU MOYEN",
                 "MENU ECO ", "REST  PRIX COMMUNS", "REST Structure offre ", "REST Gradation de prix",
                 "REST Prix Catégories ", "REST Grammages "],
        "cafeteria": ["Structure offre ATRIUM CAFE", "Prix Boissons ATRIUM CAFE", "Analyse Caféteria"],
        "dflab": [" DFLab PRIX COMMUNS ", "DFLab Prix ", "DFLab Structure offre", "DFLab Prix formules"],
        "room_service": ["Prix Room service"],
        "club_vip": ["Prix Club - VIP"],
        "brasserie": ["Prix Brasserie"],
        "da": ["Prix DA"],
    }
    ALWAYS_KEEP = ["Tranches de fréq. AO", "Analyse 10 menus types", "Analyse RR", "Prix Boulangerie"]

    def _fill(self, wb):
        # 1. Context projet sur page de garde
        if "Tranches de fréq. AO" in wb.sheetnames:
            ws = wb["Tranches de fréq. AO"]
            ws["L1"] = "AO {} - {}".format(self.projet.client, self.projet.nom)
            ws["L1"].font = Font(bold=True, color=EMPREINTES_TERRACOTTA)

            # Fill tranches from DB
            from plane.configurateur.models import TrancheFrequentation
            tranches = TrancheFrequentation.objects.all().order_by("numero")
            for i, t in enumerate(tranches):
                row = 4 + i  # starting row for tranches
                if row <= ws.max_row:
                    ws.cell(row=row, column=1, value="Tranche {}".format(t.numero))
                    ws.cell(row=row, column=2, value=t.borne_min)
                    ws.cell(row=row, column=3, value=t.borne_max)
                    ws.cell(row=row, column=4, value=t.mediane)

        # 2. Supprimer onglets non pertinents (garder que PdV du projet)
        pdv_types = set(p.type_pdv for p in self.projet.points_de_vente.all())
        sheets_to_keep = set(self.ALWAYS_KEEP)
        for ptype in pdv_types:
            sheets_to_keep.update(self.TYPE_PDV_SHEETS.get(ptype, []))

        for sname in list(wb.sheetnames):
            if sname not in sheets_to_keep:
                try:
                    del wb[sname]
                except Exception:
                    pass

        # 3. Fill produits from DB if "Prix Self" exists
        if "Prix Self" in wb.sheetnames:
            self._fill_prix_self(wb["Prix Self"])

    def _fill_prix_self(self, ws):
        """Fill prix from ProduitAlimentaire or ProjetAOPrix overrides."""
        from plane.configurateur.models import ProduitAlimentaire, ProjetAOPrix

        produits = ProduitAlimentaire.objects.filter(actif=True, types_pdv__contains=["self"]).order_by("famille", "designation")
        overrides = {}
        try:
            overrides = {po.produit_id: po.prix_ht for po in ProjetAOPrix.objects.filter(projet_ao=self.projet)}
        except Exception:
            pass

        # Don't overwrite existing template rows — just fill empty prix_ht cells
        for r in range(7, ws.max_row + 1):
            designation_cell = ws.cell(r, 1).value
            if not designation_cell:
                continue
            # Check if prix_ht (col D) is empty
            prix_cell = ws.cell(r, 4)
            if prix_cell.value is not None:
                continue
            # Try to match a product by designation
            desig = str(designation_cell).strip().lower()
            for p in produits:
                if p.designation.lower() == desig:
                    prix = float(overrides.get(p.id, p.prix_ht_reference or 0))
                    if prix > 0:
                        prix_cell.value = prix
                    break


# ═══════════════════════════════════════════════════════════════════════════
# COUT FIXE — Cout Fixe Multi-Scenarios (20 onglets)
# ═══════════════════════════════════════════════════════════════════════════

class CoutFixeGenerator(BaseGenerator):
    template_path = TEMPLATE_COUTFIXE

    # Columns for each tranche (1-5) in the personnel sheet
    TRANCHE_COLS_PERSONNEL = [
        (1, "G"), (2, "J"), (3, "M"), (4, "P"), (5, "S"),
        (6, "V"), (7, "Y"), (8, "AB"), (9, "AE"), (10, "AH"),
    ]

    def _fill(self, wb):
        sim = self.simulation

        # Fill all _X sheets
        self._fill_personnel_x(wb, sim)
        self._fill_fg_x(wb, sim)
        self._fill_invest_x(wb, sim)
        self._fill_ce_flash_x(wb, sim)
        self._fill_titre_sheets(wb)

    def _fill_titre_sheets(self, wb):
        """Add project title to key sheets."""
        title = "AO {} - {}".format(self.projet.client, self.projet.nom)
        title_font = Font(bold=True, color=EMPREINTES_TERRACOTTA)

        for sname in ["Synthèse Coûts fixes_X", "ACTIVITES", "Programme ouverture_X"]:
            if sname in wb.sheetnames:
                ws = wb[sname]
                ws["A3"] = title if sname == "ACTIVITES" else title
                ws.cell(row=3, column=1).font = title_font

    def _fill_personnel_x(self, wb, sim):
        """Fill 'Frais de personnel_X' with postes from DB."""
        sname = "Frais de personnel_X"
        if sname not in wb.sheetnames:
            return
        ws = wb[sname]

        from plane.configurateur.models import PosteType, TauxChargesSociales, MatriceStaffing

        # Write client name
        ws["A3"] = self.projet.client
        ws["A3"].font = Font(bold=True, color=EMPREINTES_TERRACOTTA)

        # Write postes : each PosteType has an ordre_excel = row number in this sheet
        postes = PosteType.objects.filter(actif=True).order_by("ordre_excel")
        for poste in postes:
            row = poste.ordre_excel
            if row < 7 or row > 55:
                continue

            # Col A = label
            ws.cell(row=row, column=1, value=poste.label_excel or poste.nom)
            # Col C = salaire de base
            ws.cell(row=row, column=3, value=float(poste.salaire_brut_mensuel))

            # Fill nb ETP by tranche from MatriceStaffing
            pdv_types = [p.type_pdv for p in self.projet.points_de_vente.all()]
            for tranche_num, col_letter in self.TRANCHE_COLS_PERSONNEL[:5]:
                total_etp = Decimal("0")
                for ms in MatriceStaffing.objects.filter(
                    poste=poste, tranche=tranche_num, type_pdv__in=pdv_types
                ):
                    total_etp += ms.nb_etp

                if total_etp > 0:
                    from openpyxl.utils import column_index_from_string
                    col_idx = column_index_from_string(col_letter)
                    ws.cell(row=row, column=col_idx, value=float(total_etp))

        # Write taux de charges (row 59)
        for tc in TauxChargesSociales.objects.all():
            for t_num, col_letter in self.TRANCHE_COLS_PERSONNEL:
                if t_num == tc.tranche:
                    from openpyxl.utils import column_index_from_string
                    col_idx = column_index_from_string(col_letter)
                    ws.cell(row=59, column=col_idx, value=float(tc.taux))

    def _fill_fg_x(self, wb, sim):
        """Fill 'Frais Généraux_X' with FG types from DB."""
        sname = "Frais Généraux_X"
        if sname not in wb.sheetnames:
            return
        ws = wb[sname]

        from plane.configurateur.models import FraisGenerauxType, FraisGenerauxBareme, ProjetAOFG

        ws["A3"] = self.projet.client
        ws["A3"].font = Font(bold=True, color=EMPREINTES_TERRACOTTA)

        # nb tranches
        ws["A2"] = 5

        # Build overrides lookup
        overrides = {}
        try:
            for o in ProjetAOFG.objects.filter(projet_ao=self.projet):
                overrides[(o.fg_type_id, o.tranche)] = o.montant
        except Exception:
            pass

        # Each FG type has an ordre = row in the sheet
        fg_types = FraisGenerauxType.objects.all().order_by("ordre")
        for fg in fg_types:
            row = fg.ordre
            if row < 7 or row > 95:
                continue

            # Write montant for tranche 1 in col G (column 7)
            montant = float(fg.montant_reference)

            # Check for override
            override = overrides.get((fg.id, 1))
            if override is not None:
                montant = float(override)

            if montant > 0:
                ws.cell(row=row, column=7, value=montant)

            # Also fill baremes for other tranches
            for bareme in FraisGenerauxBareme.objects.filter(fg_type=fg):
                t_col = 7 + bareme.tranche  # col H=T2, I=T3, J=T4, K=T5
                ov = overrides.get((fg.id, bareme.tranche))
                ws.cell(row=row, column=t_col, value=float(ov or bareme.montant))

    def _fill_invest_x(self, wb, sim):
        """Fill 'Invest, valorisation_X' with invest types from DB."""
        sname = "Invest, valorisation_X"
        if sname not in wb.sheetnames:
            return
        ws = wb[sname]

        from plane.configurateur.models import InvestissementType

        ws["B3"] = self.projet.client
        ws["B3"].font = Font(bold=True, color=EMPREINTES_TERRACOTTA)

        for inv in InvestissementType.objects.all().order_by("ordre"):
            row = inv.ordre
            if row < 7 or row > 60:
                continue
            # Col B = label
            ws.cell(row=row, column=2, value=inv.libelle)
            # Col E = quantite
            ws.cell(row=row, column=5, value=inv.quantite_defaut)
            # Col G = montant tranche 1
            montant = float(inv.montant_unitaire * inv.quantite_defaut)
            if montant > 0:
                ws.cell(row=row, column=7, value=montant)

    def _fill_ce_flash_x(self, wb, sim):
        """Fill 'CE Flash_X' with KPIs from SimulationEngine."""
        sname = "CE Flash_X"
        if sname not in wb.sheetnames:
            return
        ws = wb[sname]

        couverts = max(sim["activity"]["couverts_mois"], 1)
        ca_total = sim["pl"]["ca_total"]
        masse_sal = sim["staffing"]["masse_chargee_mensuelle"]
        fg = sim["fg"]["fg_mensuel"]
        matiere = sim["matiere"]["cout_matiere_mensuel"]

        # Site name
        ws["C2"] = self.projet.client
        ws["C2"].font = Font(bold=True, color=EMPREINTES_TERRACOTTA)

        # Frequentation
        max_cvts = max((p.couverts_jour_cible for p in self.projet.points_de_vente.all()), default=0)
        ws["C6"] = max_cvts  # freq max
        ws["C7"] = int(couverts / 21)  # freq moyenne jour
        ws["C8"] = couverts  # freq mois
        ws["C9"] = couverts * 12  # freq annuelle

        # CA par couvert
        ca_par_cvt = ca_total / couverts if couverts else 0
        ws["C12"] = round(ca_par_cvt, 2)  # prestation alimentaire / couvert

        # Frais per couvert
        ws["C16"] = round(masse_sal / couverts, 2) if couverts else 0  # frais personnel / cvt
        ws["C17"] = round(fg / couverts, 2) if couverts else 0  # FG / cvt

        # Ratios
        if ca_total > 0:
            ws["C20"] = round(matiere / ca_total, 2)  # % alimentaire Self

        # Frais de siege
        ws["C33"] = float(self.projet.pct_frais_siege) / 100
        # Produits sur achats
        ws["D28"] = float(self.projet.pct_produits_achats) / 100

        # Investissements
        ws["H25"] = self.projet.duree_contrat_annees
        ws["H27"] = sim["invest"]["invest_total"]
        ws["H28"] = 0.7  # impact admission par defaut


# ═══════════════════════════════════════════════════════════════════════════
# ZIP DES 3 EXCEL
# ═══════════════════════════════════════════════════════════════════════════

def generate_dossier_zip(projet, scenario=None):
    """Genere un ZIP contenant les 3 Excel."""
    sim = SimulationEngine(projet, (scenario.parametres if scenario else {}) or {}).run()

    bpu = BPUGenerator(projet, scenario, simulation=sim).generate()
    budget = BudgetGenerator(projet, scenario, simulation=sim).generate()
    cf = CoutFixeGenerator(projet, scenario, simulation=sim).generate()

    suffix = scenario.nom if scenario else "Default"
    safe_client = projet.client.replace("/", "_").replace(" ", "_")

    zip_buf = io.BytesIO()
    with zipfile.ZipFile(zip_buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("BPU_{}_{}.xlsx".format(safe_client, suffix), bpu.read())
        zf.writestr("Budget_{}_{}.xlsx".format(safe_client, suffix), budget.read())
        zf.writestr("CoutFixe_{}_{}.xlsx".format(safe_client, suffix), cf.read())
    zip_buf.seek(0)
    return zip_buf
