"""Etape 4 du pipeline : Frais Generaux mensuels par poste."""
from decimal import Decimal
from .activity_calculator import D


# Postes FG standards EMPREINTES avec PU defaut (par couvert ou forfait mensuel)
FG_DEFAULTS = [
    # (poste, sous_poste, type_calcul, valeur_default)
    # type_calcul: 'par_couvert' | 'forfait_mensuel' | 'pct_ca'
    ("FES", "Produits a usage unique", "par_couvert", 0.12),
    ("FES", "Produit entretien et Lessiviels", "par_couvert", 0.18),
    ("FES", "Fournitures de bureau", "forfait_mensuel", 65.0),
    ("Fluide", "Eau", "forfait_mensuel", 250.0),
    ("Fluide", "Electricite/Gaz", "forfait_mensuel", 1500.0),
    ("Maintenance", "Bac a graisse", "forfait_mensuel", 90.0),
    ("Maintenance", "Contrat maintenance preventive/curative", "forfait_mensuel", 380.0),
    ("Maintenance", "Depenses maintenance", "forfait_mensuel", 200.0),
    ("Telecom", "Internet/Telephone", "forfait_mensuel", 80.0),
    ("Tenues", "Lavage tenues", "par_couvert", 0.05),
    ("Honoraires", "Honoraires gestion EMPREINTES", "pct_ca", 0.04),
]


class FraisGenCalculator:
    """Frais generaux : entretien, consommables, energie, etc."""

    def __init__(self, projet, params, activity):
        self.projet = projet
        self.params = params or {}
        self.activity = activity

    def compute(self):
        couverts = D(self.activity["couverts_mois"])
        ca = D(self.activity["ca_mensuel"])

        # Override scenario (params peut surcharger)
        custom_fg = self.params.get("fg_overrides", {})

        detail = []
        total = D(0)
        sous_totaux = {}

        for poste, sous_poste, type_calc, default_val in FG_DEFAULTS:
            key = "{}__{}".format(poste, sous_poste)
            val = D(custom_fg.get(key, default_val))

            if type_calc == "par_couvert":
                montant = val * couverts
            elif type_calc == "pct_ca":
                montant = val * ca
            else:  # forfait_mensuel
                montant = val

            detail.append({
                "poste": poste,
                "sous_poste": sous_poste,
                "type_calcul": type_calc,
                "valeur_unitaire": float(val),
                "montant_mensuel": float(montant),
            })
            total += montant
            sous_totaux[poste] = sous_totaux.get(poste, D(0)) + montant

        return {
            "fg_mensuel": float(total),
            "fg_annuel": float(total * 12),
            "fg_par_couvert": float(total / max(couverts, D(1))),
            "detail": detail,
            "sous_totaux": {k: float(v) for k, v in sous_totaux.items()},
        }
