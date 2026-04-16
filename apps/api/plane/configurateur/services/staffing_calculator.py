"""Etape 2 du pipeline : Staffing ETP + masse salariale chargee."""
from decimal import Decimal
from .refs_cache import RefsCache
from .activity_calculator import D


class StaffingCalculator:
    """Calcule le staffing ETP + masse salariale chargee selon la matrice EMPREINTES."""

    def __init__(self, projet, params, activity):
        self.projet = projet
        self.params = params or {}
        self.activity = activity
        self.refs = RefsCache.get()

    def compute(self):
        if "nb_etp_override" in self.params:
            return self._compute_manual()
        return self._compute_from_matrix()

    def _compute_from_matrix(self):
        """Staffing calcule depuis la matrice EMPREINTES selon tranche par PdV."""
        postes_totaux = {}  # poste.id -> dict

        for pdv in self.projet.points_de_vente.all():
            entries = self.refs.matrice_for(pdv.type_pdv, pdv.tranche_frequentation)
            for m in entries:
                pid = m.poste.id
                if pid not in postes_totaux:
                    postes_totaux[pid] = {
                        "poste": m.poste,
                        "nb_etp": D(0),
                    }
                postes_totaux[pid]["nb_etp"] += m.nb_etp

        # Mutualisation multi-PdV
        postes_totaux = self._apply_mutualisation(postes_totaux)

        total_etp = D(0)
        total_brut = D(0)
        total_charge = D(0)
        detail = []

        for data in postes_totaux.values():
            poste = data["poste"]
            nb_etp = data["nb_etp"]
            brut = nb_etp * poste.salaire_brut_mensuel
            charge = brut * (D(1) + poste.taux_charges / D(100))

            total_etp += nb_etp
            total_brut += brut
            total_charge += charge

            detail.append({
                "poste_id": poste.id,
                "nom": poste.nom,
                "qualification": poste.qualification,
                "categorie": poste.categorie,
                "nb_etp": float(nb_etp),
                "salaire_brut_unitaire": float(poste.salaire_brut_mensuel),
                "masse_brute": float(brut),
                "taux_charges": float(poste.taux_charges),
                "masse_chargee": float(charge),
            })

        # Si pas de matrice trouvee, fallback : 1 ETP par PdV par tranche / 2
        if total_etp == 0:
            for pdv in self.projet.points_de_vente.all():
                fallback_etp = D(pdv.tranche_frequentation) / D(2)
                fallback_salaire = D(2400)
                fallback_charges = D(45)
                brut = fallback_etp * fallback_salaire
                charge = brut * (D(1) + fallback_charges / D(100))
                total_etp += fallback_etp
                total_brut += brut
                total_charge += charge
                detail.append({
                    "poste_id": None,
                    "nom": "Fallback {}".format(pdv.nom),
                    "qualification": "estimation",
                    "categorie": "fallback",
                    "nb_etp": float(fallback_etp),
                    "salaire_brut_unitaire": float(fallback_salaire),
                    "masse_brute": float(brut),
                    "taux_charges": float(fallback_charges),
                    "masse_chargee": float(charge),
                })

        return {
            "etp_total": float(total_etp),
            "masse_brute_mensuelle": float(total_brut),
            "masse_chargee_mensuelle": float(total_charge),
            "masse_chargee_annuelle": float(total_charge * 12),
            "detail_postes": detail,
            "mode": "matrix",
        }

    def _apply_mutualisation(self, postes):
        scenario = self.params.get("mutualisation", "none")
        if scenario == "none" or len(self.projet.points_de_vente.all()) <= 1:
            return postes

        if scenario == "scenario_1_3":
            for data in postes.values():
                if data["poste"].categorie in ("encadrement", "support"):
                    data["nb_etp"] = data["nb_etp"] * D("0.7")
        elif scenario == "scenario_2":
            for data in postes.values():
                if data["poste"].categorie == "encadrement":
                    data["nb_etp"] = data["nb_etp"] * D("0.5")

        return postes

    def _compute_manual(self):
        """Override : utilisateur a fixe le nombre d'ETP."""
        nb_etp = D(self.params["nb_etp_override"])
        salaire_moyen = D(self.params.get("salaire_moyen", 2400))
        taux_charges = D(self.params.get("taux_charges_moyen", 45))

        brut = nb_etp * salaire_moyen
        charge = brut * (D(1) + taux_charges / D(100))

        return {
            "etp_total": float(nb_etp),
            "masse_brute_mensuelle": float(brut),
            "masse_chargee_mensuelle": float(charge),
            "masse_chargee_annuelle": float(charge * 12),
            "detail_postes": [{
                "poste_id": None,
                "nom": "Effectif global (override)",
                "qualification": "manual",
                "categorie": "override",
                "nb_etp": float(nb_etp),
                "masse_brute": float(brut),
                "masse_chargee": float(charge),
            }],
            "mode": "manual",
        }
