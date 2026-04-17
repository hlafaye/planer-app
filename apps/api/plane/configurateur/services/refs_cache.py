"""
In-memory cache des referentiels EMPREINTES.
Charge une fois au premier acces, partage entre toutes les simulations.
Recharge automatique si les donnees DB changent (TTL 60 secondes).
"""
import time
from threading import RLock


class RefsCache:
    _instance = None
    _lock = RLock()
    TTL = 60  # secondes

    def __init__(self):
        self._loaded_at = 0
        self._mercuriale = None
        self._postes = None
        self._matrice = None
        self._grammages = None
        self._structures = None
        self._categ_equip = None
        self._equip_types = None

    @classmethod
    def get(cls):
        with cls._lock:
            if cls._instance is None:
                cls._instance = cls()
            return cls._instance

    def _refresh_if_needed(self):
        now = time.time()
        if (now - self._loaded_at) < self.TTL and self._mercuriale is not None:
            return
        # Lazy import pour eviter probleme d'init Django
        from plane.configurateur.models import (
            Mercuriale, PosteType, MatriceStaffing, Grammage,
            StructureOffreType, CategorieEquipement, EquipementType,
        )
        self._mercuriale = list(Mercuriale.objects.all())
        self._postes = {p.nom.upper(): p for p in PosteType.objects.filter(actif=True)}
        self._matrice = list(MatriceStaffing.objects.select_related("poste").all())
        self._grammages = list(Grammage.objects.all())
        self._structures = list(StructureOffreType.objects.all())
        self._categ_equip = {c.nom: c for c in CategorieEquipement.objects.all()}
        self._equip_types = list(EquipementType.objects.select_related("categorie").all())
        self._loaded_at = now

    @property
    def mercuriale(self):
        self._refresh_if_needed()
        return self._mercuriale

    @property
    def postes(self):
        self._refresh_if_needed()
        return self._postes

    @property
    def matrice(self):
        self._refresh_if_needed()
        return self._matrice

    @property
    def grammages(self):
        self._refresh_if_needed()
        return self._grammages

    @property
    def structures(self):
        self._refresh_if_needed()
        return self._structures

    @property
    def equipements(self):
        self._refresh_if_needed()
        return self._equip_types

    # ─── Helpers d'acces filtre ────────────────────────────────────────────

    def matrice_for(self, type_pdv, tranche):
        """Retourne les MatriceStaffing applicables a ce PdV+tranche."""
        return [m for m in self.matrice if m.type_pdv == type_pdv and m.tranche == tranche]

    def grammage_for(self, type_pdv, composant):
        """Retourne le Grammage pour ce composant ou None."""
        for g in self.grammages:
            if g.type_pdv == type_pdv and g.composant == composant:
                return g
        return None

    def structures_for(self, type_pdv, tranche):
        """Retourne les StructureOffreType applicables."""
        return [s for s in self.structures if s.type_pdv == type_pdv and s.tranche == tranche]

    def mercuriale_avg_price(self, categorie, niveau="prix_standard"):
        """Prix moyen d'une categorie a un niveau donne (eco/standard/premium/luxe)."""
        from decimal import Decimal
        prices = []
        for m in self.mercuriale:
            if m.categorie.lower() == categorie.lower():
                p = getattr(m, niveau, None)
                if p is not None:
                    prices.append(p)
        if not prices:
            return Decimal("10.0")  # fallback
        return sum(prices) / len(prices)

    def equipements_for(self, type_pdv):
        """Retourne les EquipementType applicables a ce type_pdv."""
        result = []
        for e in self.equipements:
            applicable = e.type_pdv_applicable or []
            if not applicable or type_pdv in applicable:
                result.append(e)
        return result
