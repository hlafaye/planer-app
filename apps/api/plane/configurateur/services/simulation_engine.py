"""Orchestrateur du pipeline complet de simulation."""
from .activity_calculator import ActivityCalculator, D
from .staffing_calculator import StaffingCalculator
from .matiere_calculator import MatiereCalculator
from .frais_gen_calculator import FraisGenCalculator
from .invest_calculator import InvestCalculator
from .pl_aggregator import PLAggregator


class SimulationEngine:
    """Orchestre les 6 etapes du pipeline et retourne un dict complet."""

    def __init__(self, projet_ao, scenario_params=None):
        self.projet = projet_ao
        self.params = scenario_params or {}

    def run(self):
        # Etape 1 : Activite
        activity = ActivityCalculator(self.projet, self.params).compute()

        # Etape 2 : Staffing
        staffing = StaffingCalculator(self.projet, self.params, activity).compute()

        # Etape 3 : Matiere
        matiere = MatiereCalculator(self.projet, self.params, activity).compute()

        # Etape 4 : Frais Generaux
        fg = FraisGenCalculator(self.projet, self.params, activity).compute()

        # Etape 5 : Invest
        invest = InvestCalculator(self.projet, self.params).compute()

        # Etape 6 : Aggregation P&L
        pl = PLAggregator(
            activity=activity, staffing=staffing, matiere=matiere,
            fg=fg, invest=invest, mode_gestion=self.projet.mode_gestion,
            params=self.params,
        ).compute()

        kpis = self._compute_kpis(activity, pl, staffing, matiere)
        score = self._estimate_score(pl, staffing, matiere, kpis)

        return {
            "activity": activity,
            "staffing": staffing,
            "matiere": matiere,
            "fg": fg,
            "invest": invest,
            "pl": pl,
            "kpis": kpis,
            "score_estime": score,
            "params_used": self.params,
        }

    def _compute_kpis(self, activity, pl, staffing, matiere):
        couverts = max(activity["couverts_mois"], 1)
        ca = max(pl["ca_total"], 1)

        # Seuil de rentabilite : couverts/mois pour avoir resultat=0
        marge_unitaire = pl["marge_par_couvert"]
        cout_fixe = pl["masse_salariale"] + pl["frais_generaux"] + pl["amortissements"]
        if marge_unitaire > 0:
            breakeven = int(cout_fixe / marge_unitaire) if marge_unitaire else 0
        else:
            breakeven = 0

        return {
            "cout_par_couvert": float(pl["total_charges"]) / couverts,
            "prix_moyen_plateau": float(activity["ca_mensuel"]) / couverts,
            "marge_pct": pl["marge_pct"],
            "resultat_mensuel": pl["resultat"],
            "resultat_annuel": pl["resultat_annuel"],
            "seuil_rentabilite_couverts": breakeven,
            "etp_par_100_couverts": float(staffing["etp_total"]) / max(couverts / 1000.0, 1) if couverts > 0 else 0,
            "ratio_matiere_pct": pl["ratio_matiere_pct"],
            "ratio_personnel_pct": pl["ratio_personnel_pct"],
        }

    def _estimate_score(self, pl, staffing, matiere, kpis):
        """Score estime /100 selon ponderations EMPREINTES.

        Formule simplifiee :
        - Prix : meilleur si cout/cvt bas (40 points max)
        - Concept : forfait selon mode (20 max)
        - RH : meilleur si ratio etp eleve = qualite (15 max)
        - RSE : forfait (15 max)
        - Qualite : meilleur si niveau prix premium+ (10 max)
        """
        # Prix : norme sur cout/cvt (cible 12€, cap 8€=40, 18€=10)
        cpc = kpis["cout_par_couvert"]
        if cpc <= 8:
            score_prix = 40
        elif cpc >= 18:
            score_prix = 10
        else:
            score_prix = int(40 - ((cpc - 8) / 10) * 30)

        # Concept : 15 si mode complexe (mixte/custom), 12 sinon
        score_concept = 15 if self.projet.mode_gestion in ("mixte", "custom") else 12

        # RH : ratio masse_sal/CA - mieux si entre 35-45%
        ratio_rh = pl["ratio_personnel_pct"]
        if 35 <= ratio_rh <= 45:
            score_rh = 15
        elif 30 <= ratio_rh < 35 or 45 < ratio_rh <= 50:
            score_rh = 12
        else:
            score_rh = 8

        # RSE : forfait 12
        score_rse = 12

        # Qualite : niveau prix matiere
        niveau = matiere.get("niveau_prix", "prix_standard")
        score_qualite = {"prix_eco": 5, "prix_standard": 8, "prix_premium": 10, "prix_luxe": 10}.get(niveau, 8)

        total = score_prix + score_concept + score_rh + score_rse + score_qualite

        return {
            "total": total,
            "prix": score_prix,
            "concept": score_concept,
            "rh": score_rh,
            "rse": score_rse,
            "qualite": score_qualite,
        }
