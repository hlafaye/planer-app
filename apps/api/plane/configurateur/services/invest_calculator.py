"""Etape 5 du pipeline : Investissements + amortissements lineaires."""
from decimal import Decimal
from .refs_cache import RefsCache
from .activity_calculator import D


class InvestCalculator:
    """Plan d'investissement et amortissements lineaires."""

    def __init__(self, projet, params):
        self.projet = projet
        self.params = params or {}
        self.refs = RefsCache.get()

    def compute(self):
        # Coefficient d'investissement par PdV (depend de la tranche)
        # Si nature = ouverture, on inclut tous les equipements
        # Si reprise/renouvellement, on a un coef de renouvellement
        coef_repris = D(self.params.get(
            "coef_invest_renouvellement",
            0.4 if self.projet.nature == "reprise" else (0.6 if self.projet.nature == "renouvellement" else 1.0)
        ))

        invest_par_pdv = []
        invest_par_categ = {}
        invest_total = D(0)
        amort_mensuel = D(0)

        for pdv in self.projet.points_de_vente.all():
            equipements = self.refs.equipements_for(pdv.type_pdv)

            # Coefficient de tranche : equipement scale avec la frequentation
            coef_tranche = D("1.0") + (D(pdv.tranche_frequentation - 1) * D("0.15"))

            invest_pdv = D(0)
            for eq in equipements:
                cout = eq.prix_indicatif * coef_tranche * coef_repris
                duree = eq.categorie.duree_amortissement_annees or 5
                amort_eq = cout / D(duree) / D(12)

                cat_nom = eq.categorie.nom
                if cat_nom not in invest_par_categ:
                    invest_par_categ[cat_nom] = {
                        "categorie": cat_nom,
                        "duree_amort": duree,
                        "cout": D(0),
                        "amort_mensuel": D(0),
                    }
                invest_par_categ[cat_nom]["cout"] += cout
                invest_par_categ[cat_nom]["amort_mensuel"] += amort_eq

                invest_pdv += cout
                amort_mensuel += amort_eq

            # Si pas d'equipement reference, fallback : 50k€ par PdV par tranche
            if invest_pdv == 0:
                fallback = D(50000) * coef_tranche * coef_repris
                invest_pdv = fallback
                duree = 7
                amort_pdv = fallback / D(duree) / D(12)
                amort_mensuel += amort_pdv
                key = "Fallback {}".format(pdv.type_pdv)
                invest_par_categ[key] = {
                    "categorie": key,
                    "duree_amort": duree,
                    "cout": fallback,
                    "amort_mensuel": amort_pdv,
                }

            invest_par_pdv.append({
                "pdv_id": str(pdv.id),
                "nom": pdv.nom,
                "invest": float(invest_pdv),
            })
            invest_total += invest_pdv

        return {
            "invest_total": float(invest_total),
            "amortissement_mensuel": float(amort_mensuel),
            "amortissement_annuel": float(amort_mensuel * 12),
            "coef_renouvellement": float(coef_repris),
            "detail_par_pdv": invest_par_pdv,
            "detail_par_categorie": [
                {**v, "cout": float(v["cout"]), "amort_mensuel": float(v["amort_mensuel"])}
                for v in invest_par_categ.values()
            ],
        }
