"""Etape 6 du pipeline : Agregation P&L final + KPIs."""
from decimal import Decimal
from .activity_calculator import D


class PLAggregator:
    """Agrege toutes les etapes en un P&L mensuel + annuel + KPIs."""

    def __init__(self, activity, staffing, matiere, fg, invest, mode_gestion, params=None):
        self.activity = activity
        self.staffing = staffing
        self.matiere = matiere
        self.fg = fg
        self.invest = invest
        self.mode = mode_gestion
        self.params = params or {}

    def compute(self):
        ca_convives = D(self.activity["ca_mensuel"])
        cout_matiere = D(self.matiere["cout_matiere_mensuel"])
        masse_sal = D(self.staffing["masse_chargee_mensuelle"])
        fg_mens = D(self.fg["fg_mensuel"])
        amort = D(self.invest["amortissement_mensuel"])

        # Honoraires gestion EMPREINTES (deja dans FG via sous_total Honoraires)
        # Eviter double compte : on utilise le total FG tel quel
        honoraires = D(0)

        # CA total selon mode
        ca_total = self._compute_ca_total(ca_convives, cout_matiere, masse_sal, fg_mens, amort)

        total_charges = cout_matiere + masse_sal + fg_mens + amort + honoraires
        resultat = ca_total - total_charges
        marge_pct = (resultat / ca_total * D(100)) if ca_total > 0 else D(0)

        couverts = max(D(self.activity["couverts_mois"]), D(1))

        return {
            "mode_gestion": self.mode,
            "ca_total": float(ca_total),
            "ca_convives": float(ca_convives),
            "ca_total_annuel": float(ca_total * 12),
            "cout_matiere": float(cout_matiere),
            "masse_salariale": float(masse_sal),
            "frais_generaux": float(fg_mens),
            "amortissements": float(amort),
            "honoraires_gestion": float(honoraires),
            "total_charges": float(total_charges),
            "resultat": float(resultat),
            "resultat_annuel": float(resultat * 12),
            "marge_pct": float(marge_pct),
            "marge_par_couvert": float(resultat / couverts),
            "ratio_matiere_pct": float(cout_matiere / ca_total * D(100)) if ca_total > 0 else 0.0,
            "ratio_personnel_pct": float(masse_sal / ca_total * D(100)) if ca_total > 0 else 0.0,
            "ratio_fg_pct": float(fg_mens / ca_total * D(100)) if ca_total > 0 else 0.0,
        }

    def _compute_ca_total(self, ca_convives, cout_matiere, masse_sal, fg_mens, amort):
        """CA total = CA convives + facturation client (selon mode de gestion)."""
        if self.mode == "ticket":
            return ca_convives  # Tout sur le ticket : 100% paye par convives

        if self.mode == "admission":
            # Admission : convives paient prix admission, client paie le complement
            # Complement = couts - subvention employeur (forfait)
            subvention_pct = D(self.params.get("subvention_employeur_pct", 0.40))
            return ca_convives + (cout_matiere + masse_sal + fg_mens + amort) * subvention_pct

        if self.mode == "masse_frais":
            # Masse de frais : client paie integralite charges + marge gestion
            # Convives paient au BPU (recette deja dans ca_convives)
            marge_gestion_pct = D(self.params.get("marge_gestion_pct", 0.06))
            charges_facturees = (masse_sal + fg_mens + amort) * (D(1) + marge_gestion_pct)
            return ca_convives + charges_facturees

        if self.mode == "mixte":
            # Mixte : masse frais sur partie internes + admissions externes
            pct_internes = D(1) - D(self.params.get("pct_externes", 0.20))
            charges_internes = (masse_sal + fg_mens + amort) * pct_internes
            marge_gestion = D(self.params.get("marge_gestion_pct", 0.06))
            return ca_convives + charges_internes * (D(1) + marge_gestion)

        # custom : par defaut on prend juste ca convives
        return ca_convives
