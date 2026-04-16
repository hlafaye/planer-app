"""Etape 1 du pipeline : Activite mensuelle, repartition, CA."""
from decimal import Decimal


def D(v):
    """Cast vers Decimal en supportant str/int/float/Decimal."""
    if isinstance(v, Decimal):
        return v
    return Decimal(str(v))


class ActivityCalculator:
    """Calcule l'activite mensuelle : couverts, repartition, CA."""

    def __init__(self, projet, params):
        self.projet = projet
        self.params = params or {}

    def compute(self):
        total_couverts = D(0)
        pdv_details = []

        saisonnalite = D(self.params.get("saisonnalite", 1.0))
        penetration = D(self.params.get("penetration", 1.0))

        for pdv in self.projet.points_de_vente.all():
            cvts = D(pdv.couverts_jour_cible) * D(pdv.jours_ouvres_mois)
            cvts = cvts * saisonnalite * penetration

            pdv_details.append({
                "pdv_id": str(pdv.id),
                "nom": pdv.nom,
                "type": pdv.type_pdv,
                "tranche": pdv.tranche_frequentation,
                "couverts_mois": int(cvts),
                "jours_ouvres_mois": pdv.jours_ouvres_mois,
                "couverts_jour": pdv.couverts_jour_cible,
            })
            total_couverts += cvts

        ca_mensuel = self._compute_ca(total_couverts, pdv_details)

        return {
            "couverts_mois": int(total_couverts),
            "couverts_annuel": int(total_couverts * 12),
            "ca_mensuel": float(ca_mensuel),
            "ca_annuel": float(ca_mensuel * 12),
            "pdv_details": pdv_details,
            "saisonnalite": float(saisonnalite),
            "penetration": float(penetration),
        }

    def _compute_ca(self, couverts, pdv_details):
        """CA mensuel selon mode de gestion."""
        mode = self.projet.mode_gestion

        if mode == "admission":
            prix = D(self.params.get("prix_admission", 6.50))
            return couverts * prix

        elif mode == "masse_frais":
            # Convives paient au BPU ; le CA "operateur" depend de la masse frais facturee client
            # Ici on calcule le CA convives uniquement (l'autre se calcule dans PL aggregator)
            prix_bpu = D(self.params.get("prix_vente_bpu", 6.00))
            return couverts * prix_bpu

        elif mode == "mixte":
            prix_int = D(self.params.get("prix_admission", 6.50))
            prix_ext = D(self.params.get("prix_admission_ext", 8.00))
            pct_ext = D(self.params.get("pct_externes", 0.20))
            return couverts * (D(1) - pct_ext) * prix_int + couverts * pct_ext * prix_ext

        elif mode == "ticket":
            prix = D(self.params.get("prix_plateau_moyen", 8.50))
            return couverts * prix

        # Default
        return couverts * D(self.params.get("prix_plateau_moyen", 7.00))
