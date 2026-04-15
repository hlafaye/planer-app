# Planer custom: Devis validation engine
# Handles submit/approve/reject/request_modif/delegate with rights checking

import logging

from django.core.exceptions import PermissionDenied, ValidationError as DjangoValidationError

from plane.devis.models import Devis, ValidationRule, ValidationAction

logger = logging.getLogger("plane.devis.validation")


class ValidationEngine:
    """Moteur de validation — routage selon regles + chaine + droits."""

    @staticmethod
    def find_applicable_rule(devis):
        """Find the rule that applies to this devis based on amount + type."""
        rules = ValidationRule.objects.filter(
            project=devis.project,
            type_devis=devis.type_devis,
        ).order_by("order", "max_amount")

        for rule in rules:
            if rule.max_amount is not None and devis.montant_ht <= rule.max_amount:
                return rule
            if rule.max_amount is None:
                return rule
        return None

    @staticmethod
    def get_ordered_validators(rule):
        """Return validators in order."""
        return list(rule.validators.all().order_by("id"))

    @classmethod
    def submit(cls, devis, user):
        """Submit a draft devis for validation."""
        if devis.statut not in ("draft", "modif_requested", "rejected"):
            raise DjangoValidationError(
                "Impossible de soumettre un devis au statut {}".format(devis.statut)
            )

        rule = cls.find_applicable_rule(devis)
        if not rule:
            raise DjangoValidationError(
                "Aucune regle de validation ne couvre ce montant ({} EUR HT) "
                "pour le type '{}'. Configurez les regles dans Devis > Regles.".format(
                    devis.montant_ht, devis.type_devis
                )
            )

        devis.validation_rule = rule

        # Mode AUTO
        if rule.mode == "auto":
            devis.statut = "approved"
            devis.validation_step = 99
            devis.current_validators.clear()
            devis.save()
            ValidationAction.objects.create(
                devis=devis, action="submit", from_user=user,
                comment="Auto-valide (mode auto, seuil {})".format(rule.max_amount),
            )
            return devis

        validators = cls.get_ordered_validators(rule)
        if not validators:
            # Rule with no validators → auto-approve
            devis.statut = "approved"
            devis.save()
            ValidationAction.objects.create(
                devis=devis, action="submit", from_user=user,
                comment="Auto-approuve (regle sans validateurs)",
            )
            return devis

        devis.statut = "pending"
        devis.validation_step = 1

        if rule.mode == "chain":
            devis.save()
            devis.current_validators.set([validators[0]])
        else:
            # one, all → all validators in parallel
            devis.save()
            devis.current_validators.set(validators)

        ValidationAction.objects.create(
            devis=devis, action="submit", from_user=user,
            comment="Soumis a validation — {} validateur(s) — mode {}".format(
                len(validators), rule.mode
            ),
        )
        logger.info("Devis %s submitted, rule=%s, validators=%d", devis.reference, rule.mode, len(validators))
        return devis

    @classmethod
    def approve(cls, devis, user, comment=""):
        """Approve a devis. Checks rights and handles chain."""
        if devis.statut != "pending":
            raise DjangoValidationError("Impossible d'approuver au statut {}".format(devis.statut))

        if not devis.current_validators.filter(id=user.id).exists():
            raise PermissionDenied("Vous n'etes pas validateur de ce devis a cette etape.")

        rule = devis.validation_rule

        ValidationAction.objects.create(
            devis=devis, action="approve", from_user=user, comment=comment,
        )

        if rule and rule.mode == "chain":
            validators = cls.get_ordered_validators(rule)
            current_idx = next((i for i, v in enumerate(validators) if v.id == user.id), None)

            if current_idx is not None and current_idx + 1 < len(validators):
                # Next in chain
                next_v = validators[current_idx + 1]
                devis.current_validators.set([next_v])
                devis.validation_step += 1
                devis.save()
                ValidationAction.objects.create(
                    devis=devis, action="submit", from_user=user, to_user=next_v,
                    comment="Transmis a {}".format(next_v.display_name or next_v.email),
                )
                logger.info("Devis %s chain: %s approved, next=%s", devis.reference, user.email, next_v.email)
                return devis

        if rule and rule.mode == "all":
            devis.current_validators.remove(user)
            if devis.current_validators.exists():
                devis.save()
                return devis

        # Final approval
        devis.statut = "approved"
        devis.current_validators.clear()
        devis.save()
        logger.info("Devis %s fully approved", devis.reference)
        return devis

    @classmethod
    def reject(cls, devis, user, comment=""):
        """Reject a devis."""
        if devis.statut != "pending":
            raise DjangoValidationError("Impossible de rejeter au statut {}".format(devis.statut))
        if not devis.current_validators.filter(id=user.id).exists():
            raise PermissionDenied("Vous n'etes pas validateur de ce devis.")
        if not comment.strip():
            raise DjangoValidationError("Un motif de rejet est obligatoire.")

        devis.statut = "rejected"
        devis.current_validators.clear()
        devis.save()
        ValidationAction.objects.create(
            devis=devis, action="reject", from_user=user, comment=comment,
        )
        return devis

    @classmethod
    def request_modification(cls, devis, user, comment=""):
        """Request modification — devis goes back to creator."""
        if devis.statut != "pending":
            raise DjangoValidationError("Impossible au statut {}".format(devis.statut))
        if not devis.current_validators.filter(id=user.id).exists():
            raise PermissionDenied("Vous n'etes pas validateur de ce devis.")
        if not comment.strip():
            raise DjangoValidationError("Un commentaire est obligatoire.")

        devis.statut = "modif_requested"
        devis.current_validators.clear()
        devis.save()
        ValidationAction.objects.create(
            devis=devis, action="request_modif", from_user=user, comment=comment,
        )
        return devis
