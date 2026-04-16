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
    """BPU : on prend le template tel quel, on n'ajuste que les references projet."""
    template_path = TEMPLATE_BPU

    def _fill(self, wb):
        # Le template BPU contient deja toutes les structures/grammages/prix.
        # On le copie tel quel (template = catalogue de reference EMPREINTES).
        # On ajoute uniquement le contexte projet sur l'onglet "Tranches de fréq. AO"
        # (qui sert d'index, en haut A1).
        if "Tranches de fréq. AO" in wb.sheetnames:
            ws = wb["Tranches de fréq. AO"]
            try:
                ws["L1"] = "AO {} - {}".format(self.projet.client, self.projet.nom)
                ws["L1"].font = Font(bold=True, color=EMPREINTES_TERRACOTTA)
            except Exception:
                pass


# ═══════════════════════════════════════════════════════════════════════════
# COUT FIXE — Cout Fixe Multi-Scenarios (20 onglets)
# ═══════════════════════════════════════════════════════════════════════════

class CoutFixeGenerator(BaseGenerator):
    template_path = TEMPLATE_COUTFIXE

    def _fill(self, wb):
        # Le template contient 3 jeux de scenarios (suffixes _1&3, _2, _X)
        # Pour le MVP : on alimente les 5 onglets "X" (scenario libre) avec les data Planer
        sim = self.simulation
        masse_chargee = sim["staffing"]["masse_chargee_mensuelle"]
        nb_etp = sim["staffing"]["etp_total"]
        invest_total = sim["invest"]["invest_total"]
        ca_mens = sim["pl"]["ca_total"]
        resultat_mens = sim["pl"]["resultat"]

        # Onglet "Synthèse Coûts fixes_X" : ecrit les inputs principaux dans les cellules libres
        if "Synthèse Coûts fixes_X" in wb.sheetnames:
            ws = wb["Synthèse Coûts fixes_X"]
            # On ecrit le titre du projet (cellule libre supposee O1 ou similaire)
            try:
                ws["A1"] = "Synthese Couts Fixes - {} - {}".format(self.projet.client, self.scenario.nom if self.scenario else "Scenario")
                ws["A1"].font = Font(bold=True, size=14, color=EMPREINTES_TERRACOTTA)
            except Exception:
                pass

        # Onglet "ACTIVITES" : on ecrit le nom du projet dans une cellule libre
        if "ACTIVITES" in wb.sheetnames:
            ws = wb["ACTIVITES"]
            try:
                ws["A1"] = "AO {} - PROJET {}".format(self.projet.client, self.projet.nom)
            except Exception:
                pass

        # Onglet "CE Flash_X" : compte d'exploitation flash
        if "CE Flash_X" in wb.sheetnames:
            ws = wb["CE Flash_X"]
            try:
                ws["A1"] = "CE Flash - {}".format(self.projet.client)
                ws["A1"].font = Font(bold=True, size=12, color=EMPREINTES_TERRACOTTA)
                # Inputs cles dans la zone libre
                ws["B3"] = "Nb ETP"
                ws["C3"] = nb_etp
                ws["B4"] = "Masse salariale mensuelle"
                ws["C4"] = masse_chargee
                ws["B5"] = "CA mensuel"
                ws["C5"] = ca_mens
                ws["B6"] = "Resultat mensuel"
                ws["C6"] = resultat_mens
                ws["B7"] = "Invest total"
                ws["C7"] = invest_total
            except Exception as e:
                logger.warning("CE Flash fill failed: %s", e)


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
