"""
Mapping input cells pour les 3 templates Excel EMPREINTES.
Genere en Phase 0 du Sprint 2 apres inspection des templates reels.

Toute cellule listee ici est un INPUT (pas une formule) qu'on peut alimenter
sans casser les calculs Excel. Les formules existantes (=B3*B2, etc.) sont
preservees et recalculees automatiquement par Excel a l'ouverture.

Convention :
- BUDGET = Budget_template.xlsx (5 onglets, P&L mensuel annee 2026)
- BPU    = BPU_template.xlsx (25 onglets, prix unitaires alimentaires)
- CF     = CoutFixe_template.xlsx (20 onglets, multi-scenarios)

Mois dans le Budget : colonnes B (janvier) -> M (decembre), N = TOTAL annee
"""

# Index des mois (B=janvier ... M=decembre)
MOIS_COLS = ["B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M"]
MOIS_NOMS = ["janvier", "fevrier", "mars", "avril", "mai", "juin",
             "juillet", "aout", "septembre", "octobre", "novembre", "decembre"]


# ═══════════════════════════════════════════════════════════════════════════
# BUDGET_template.xlsx — Budget Previsionnel (5 onglets)
# ═══════════════════════════════════════════════════════════════════════════

BUDGET_INPUT_CELLS = {
    "Activité": {
        # ─── Annee 2026 (cible principale) ────────────────────────────────
        # Ligne 12 : Jours ouvres par mois
        "jours_ouvres_2026": {col: f"{col}12" for col in MOIS_COLS},

        # Ligne 13 : Couverts moyens par jour
        "couverts_jour_2026": {col: f"{col}13" for col in MOIS_COLS},

        # Ligne 15 : % repartition cvts REST ALT (default 0.3)
        "pct_rest_alt": {col: f"{col}15" for col in MOIS_COLS},

        # ─── Parametres CA alimentaire (zone 17-26) ───────────────────────
        # Ligne 19 : CA HT par couvert
        "ca_cvt_self": "B19",        # CA SELF €/cvt
        "ca_cvt_rest_alt": "E19",    # CA REST ALT/VAE €/cvt
        "pu_cafe_da": "H19",         # Prix unitaire Cafe/DA HT

        # Ligne 20 : Cout matiere par couvert
        "cout_mp_self": "B20",       # Cout MP SELF €/cvt
        "cout_mp_rest_alt": "E20",   # Cout MP REST ALT €/cvt
        "cout_cafe_da": "H20",       # Cout Cafe/DA

        # Ligne 21 : Ratio (B21 input, E21/H21 = formules)
        "ratio_self": "B21",

        # Ligne 22 : Taux de prise Cafe/DA
        "taux_prise_cafe_da": "H22",

        # ─── Prestations annexes (ligne 24 = CA, 26 = ratio cout/CA) ─────
        "prest_annexes_ca": {col: f"{col}24" for col in MOIS_COLS},
        "prest_annexes_ratio": {col: f"{col}26" for col in MOIS_COLS},

        # ─── CA Frais Fixes / Admission (ligne 30, 32, 35, 37) ───────────
        "admission_self": {col: f"{col}30" for col in MOIS_COLS},
        "masse_frais_self": {col: f"{col}32" for col in MOIS_COLS},
        "admission_rest_alt": {col: f"{col}35" for col in MOIS_COLS},
        "masse_frais_rest_alt": {col: f"{col}37" for col in MOIS_COLS},
    },

    "Synthèse": {
        # La synthese est essentiellement constituee de formules pointant
        # vers Activite. Tres peu d'inputs propres. Cellules a ne PAS toucher.
        # On ecrit eventuellement le nom du projet en A1.
        "titre_projet": "A1",
    },

    "Masse salariale": {
        # Colonne A : Qualification (label texte du poste)
        # Colonne B : Nom (libre)
        # Colonne C : Statut (Cadre / AM / Employe)
        # Colonne D : Nombre d'heures
        # Colonne E : Salaire de base brut (FORMULE existante, on la reecrit en VALEUR)
        # Colonne F : Prime anciennete
        # Postes references a partir de la ligne 3
        # ATTENTION : la cellule E contient une formule (=3300*13/12...). Pour overrider,
        # on ecrit directement la valeur (le garde-fou doit autoriser).
        "salaire_par_ligne": {
            # row -> label expected (pour matching avec PosteType.nom)
            3: "DIRECTEUR",
            4: "Chef de Cuisine",
            5: "SECOND",
            6: "CHEF DE PARTIE",
            7: "COMMIS",
            8: "PLONGEUR",
            9: "PLONGEUR t partiel",
            10: "EMPLOYE POLYVALENT COFFEE",
            11: "EMPLOYE POLYVALENT COFFEE",
        },
        # Colonnes input par poste :
        "col_nom": "B",
        "col_statut": "C",
        "col_heures": "D",
        "col_salaire_brut": "E",   # Override autorisee
        "col_anciennete": "F",
    },

    "Frais généraux": {
        # Colonne C : prix unitaire (P.U) -- INPUT
        # Colonnes D-O : valeurs mensuelles -- mostly FORMULA (=$C$X*Activité!Bxx)
        # Postes (col A/B) : FES, Fluide, Maintenance, etc.
        # Lignes a alimenter (P.U colonne C) :
        "pu_par_ligne": {
            3: "Produits a usage unique",
            4: "Produit entretien et Lessiviels",
            5: "Fournitures de bureau",
            7: "Eau",
            8: "Electricite/Gaz",
            10: "Bac a graisse",
            11: "Contrat maintenance preventive/curative",
            12: "Depenses maintenance",
        },
        "col_pu": "C",
    },

    "Amortissement": {
        # Petit onglet : simple liste investissement / duree / amort mensuel
        # Inputs en colonne B (montant) et colonne C (duree annees)
        "col_montant": "B",
        "col_duree_annees": "C",
    },
}


# ═══════════════════════════════════════════════════════════════════════════
# BPU_template.xlsx — Bordereau Prix Unitaires (25 onglets)
# ═══════════════════════════════════════════════════════════════════════════
# Strategie : pour le BPU on EXPORTE les donnees Mercuriale + StructureOffre +
# Grammage en respectant les cellules d'input deja en place dans le template.
# Onglets cles :
# - "Tranches de fréq. AO" : tableau de reference (table en lecture seule)
# - "Structure offre ATRIUM CAFE" : structure detaillee par composant
# - "REST Structure offre" : idem pour restaurant
# - "REST Grammages " : grammages des composants restaurant
# - "REST Prix Catégories" : prix par categorie produit
# - "Catégories Self" : catalogue self
# - "Prix Self" : prix unitaires self
# - "DFLab Prix" / "DFLab Structure offre" : Digital Food Lab
# - "Prix Brasserie" / "Prix Room service" / "Prix Club - VIP" / "Prix DA"

BPU_INPUT_CELLS = {
    # Mapping structurel : pour chaque onglet, quelles colonnes recevoir
    # les donnees Mercuriale/Grammage/Structure
    "Tranches de fréq. AO": {
        # Tableau de reference, NE PAS modifier
        "_readonly": True,
    },
    "REST Prix Catégories ": {
        # Colonne A : categorie, B : prix unitaire €/kg
        "col_categorie": "A",
        "col_prix": "B",
        "row_start": 2,
    },
    "REST Grammages ": {
        # Colonne A : composant, B : type_pdv ou tranche, C-I : grammage par...
        "col_composant": "A",
        "row_start": 2,
    },
    "Prix Self": {
        "col_categorie": "A",
        "col_produit": "B",
        "col_prix_unitaire": "C",
        "row_start": 2,
    },
}


# ═══════════════════════════════════════════════════════════════════════════
# CoutFixe_template.xlsx — Cout Fixe Multi-Scenarios (20 onglets)
# ═══════════════════════════════════════════════════════════════════════════
# 5 onglets repetes pour 3 scenarios (1&3, 2, X) :
#   - Programme ouverture
#   - Frais de personnel
#   - Frais Generaux
#   - Invest valorisation
#   - Synthese Couts fixes
# + 5 onglets transverses : ACTIVITES, FG FOOD, LANCEMENT, CE Flash_X, Invest lots_X

CF_INPUT_CELLS = {
    # Pour chaque scenario suffixe (1&3, 2, X) :
    "_scenarios": ["1&3", "2", "X"],

    # ACTIVITES : grand tableau de parametres d'activite par PdV
    "ACTIVITES": {
        # Lignes 1-57, colonnes A-EG (137 cols)
        # Inputs uniquement (formulas=0). On ecrit les couverts/jour, jours/mois
        # par PdV par scenario.
        "_doc": "Tableau parametres activite par PdV. Inputs purs.",
    },

    # FG FOOD : enorme onglet de FG par categorie (3491 inputs, 0 formules)
    "FG FOOD": {
        "_doc": "Frais generaux Food par categorie/scenario. Inputs purs.",
    },

    # Programme ouverture_X : planning ouverture + hypotheses
    "Programme ouverture_X": {
        "row_start": 2,
    },

    # Frais de personnel_X : grille staffing par poste/scenario
    "Frais de personnel_X": {
        "_doc": "Grille staffing detaillee. Inputs en col B-D (nb_etp, salaire), formules en col E+",
        "col_etp": "C",
        "col_salaire": "D",
        "row_start": 4,
    },

    # Synthese Couts fixes : tableau recap (input = parametres custom, formules = totaux)
    "Synthèse Coûts fixes_X": {
        "_doc": "Tableau de synthese P&L. Mostly formules.",
    },
}


# ═══════════════════════════════════════════════════════════════════════════
# GARDE-FOU
# ═══════════════════════════════════════════════════════════════════════════

def write_input_cell(ws, coord, value, allow_overwrite_formula=False):
    """
    Ecrit une valeur dans une cellule, en refusant par defaut d'ecraser une formule.

    Args:
        ws: openpyxl worksheet
        coord: coordonnee cellule (ex 'B12')
        value: valeur a ecrire
        allow_overwrite_formula: si True, autorise l'ecrasement d'une formule
            (a utiliser uniquement quand on remplace une formule template par une
            valeur calculee Planer, ex: salaires bruts).
    """
    current = ws[coord].value
    if isinstance(current, str) and current.startswith("=") and not allow_overwrite_formula:
        raise ValueError(
            "Tentative d'ecriture sur formule {}: {}".format(coord, current)
        )
    ws[coord] = value


def write_input_row(ws, cells_dict, values_by_month):
    """
    Ecrit une ligne mensuelle dans le Budget.

    Args:
        ws: worksheet
        cells_dict: dict {col_letter: cell_coord} (ex {"B": "B12", "C": "C12", ...})
        values_by_month: liste de 12 valeurs (janv-dec) ou dict {col: value}
    """
    if isinstance(values_by_month, list):
        values_by_month = dict(zip(MOIS_COLS, values_by_month))
    for col, value in values_by_month.items():
        if col in cells_dict:
            write_input_cell(ws, cells_dict[col], value)
