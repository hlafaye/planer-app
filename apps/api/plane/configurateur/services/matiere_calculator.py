"""Etape 3 du pipeline : Cout matiere = grammage * prix * couverts * nb_choix."""
from decimal import Decimal
from .refs_cache import RefsCache
from .activity_calculator import D


# Mapping composant -> categorie mercuriale (a affiner avec data reelle)
COMPOSANT_CATEG = {
    "Entrée": "entrees",
    "Entree": "entrees",
    "Plat": "plats",
    "Plat principal": "plats",
    "Garniture": "legumes",
    "Légume": "legumes",
    "Legume": "legumes",
    "Dessert": "desserts",
    "Fromage": "fromages",
    "Pain": "boulangerie",
    "Boisson": "boissons",
    "Sandwich": "snacking",
    "Salade": "snacking",
}


class MatiereCalculator:
    """Cout matiere = somme des grammages × prix mercuriale × couverts × nb_choix."""

    def __init__(self, projet, params, activity):
        self.projet = projet
        self.params = params or {}
        self.activity = activity
        self.refs = RefsCache.get()

    def compute(self):
        niveau = self.params.get("niveau_prix", "prix_standard")

        cout_total = D(0)
        cout_par_pdv = []

        for pdv_d in self.activity["pdv_details"]:
            cout = self._compute_pdv(pdv_d, niveau)
            cvts = max(pdv_d["couverts_mois"], 1)
            cout_par_pdv.append({
                "pdv_id": pdv_d["pdv_id"],
                "nom": pdv_d["nom"],
                "cout_mensuel": float(cout),
                "cout_par_couvert": float(cout / D(cvts)),
            })
            cout_total += cout

        couverts_total = max(self.activity["couverts_mois"], 1)

        return {
            "cout_matiere_mensuel": float(cout_total),
            "cout_matiere_annuel": float(cout_total * 12),
            "cout_par_couvert": float(cout_total / D(couverts_total)),
            "niveau_prix": niveau,
            "detail_par_pdv": cout_par_pdv,
        }

    def _compute_pdv(self, pdv_d, niveau):
        type_pdv = pdv_d["type"]
        tranche = pdv_d["tranche"]
        couverts = D(pdv_d["couverts_mois"])

        cout = D(0)
        structures = self.refs.structures_for(type_pdv, tranche)

        # Si pas de structure d'offre, fallback : ratio cout matiere typique
        if not structures:
            # Cout matiere standard ~33% du prix de vente moyen
            ca_pdv = couverts * D(self.params.get("prix_plateau_moyen", 7.0))
            return ca_pdv * D(self.params.get("ratio_matiere_fallback", 0.33))

        for structure in structures:
            composant = structure.composant
            nb_choix = max(structure.nb_choix, 1)

            # Grammage du composant pour ce type de PdV
            gramm = self.refs.grammage_for(type_pdv, composant)
            gramm_g = D(gramm.grammage_grammes) if gramm else D(150)
            gramm_kg = gramm_g / D(1000)

            # Prix moyen au kg de la categorie
            categ = COMPOSANT_CATEG.get(composant, "autre")
            prix_kg = self.refs.mercuriale_avg_price(categ, niveau)
            if prix_kg is None:
                prix_kg = D(8)

            # Cout : grammage_kg × prix_kg × couverts (le nb_choix divise pas le total
            # car chaque convive ne mange qu'un choix, mais on commande pour assurer la diversite)
            # On ajoute un coefficient de gachis lie au nb_choix
            coef_diversite = D(1) + (D(nb_choix - 1) * D("0.05"))  # +5% par choix supplementaire
            cout_composant = gramm_kg * D(prix_kg) * couverts * coef_diversite
            cout += cout_composant

        return cout
