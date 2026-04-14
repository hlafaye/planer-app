# Planer custom: Dashboard API views
# Serves pre-computed dashboard data for 5 views:
# operational, chat, budget, hr, executive

from datetime import timedelta

from django.db.models import Count, Q
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from plane.authentication.session import BaseSessionAuthentication
from plane.chat.models import Channel, Message
from plane.db.models import (
    Issue,
    Module,
    Project,
    State,
    User,
    Workspace,
    WorkspaceMember,
    Label,
)


class DashboardAuthMixin:
    authentication_classes = [BaseSessionAuthentication]
    permission_classes = [IsAuthenticated]


class ProjectDashboardView(DashboardAuthMixin, APIView):
    """Vue Projet — tasks, progress, timeline, overdue, activity."""

    def get(self, request, workspace_slug, project_id):
        project = Project.objects.get(id=project_id, workspace__slug=workspace_slug)
        now = timezone.now()

        # Total issues
        issues = Issue.objects.filter(project=project)
        total = issues.count()

        # By state group
        done = issues.filter(state__group="completed").count()
        in_progress = issues.filter(state__group="started").count()
        backlog = total - done - in_progress

        # Overdue
        overdue_qs = issues.filter(
            target_date__lt=now.date(),
        ).exclude(state__group="completed").select_related("state").prefetch_related("assignees")[:10]
        overdue = []
        for i in overdue_qs:
            days = (now.date() - i.target_date).days if i.target_date else 0
            assignees = ", ".join([a.display_name for a in i.assignees.all()]) if hasattr(i, "assignees") else ""
            overdue.append({
                "id": str(i.id),
                "sequence_id": i.sequence_id,
                "name": i.name,
                "days_overdue": days,
                "assignee": assignees or "Non assigne",
            })

        # Module progress
        modules_data = []
        for mod in Module.objects.filter(project=project):
            mod_issues = issues.filter(issue_module__module=mod)
            mod_total = mod_issues.count()
            mod_done = mod_issues.filter(state__group="completed").count()
            pct = round(mod_done / mod_total * 100) if mod_total else 0
            modules_data.append({
                "id": str(mod.id),
                "name": mod.name,
                "total": mod_total,
                "done": mod_done,
                "pct": pct,
            })
        modules_data.sort(key=lambda m: m["total"], reverse=True)

        # Recent activity (last 10 issues updated)
        recent = issues.order_by("-updated_at")[:10]
        activity = []
        for i in recent:
            state_name = i.state.name if i.state else "?"
            actor = i.updated_by.display_name if i.updated_by else "?"
            activity.append({
                "sequence_id": i.sequence_id,
                "name": i.name,
                "state": state_name,
                "actor": actor,
                "updated_at": i.updated_at.isoformat(),
            })

        # Next deadline
        next_deadline = issues.filter(
            target_date__gte=now.date()
        ).exclude(state__group="completed").order_by("target_date").first()

        return Response({
            "project": {"id": str(project.id), "name": project.name},
            "kpis": {
                "total": total,
                "done": done,
                "in_progress": in_progress,
                "backlog": backlog,
                "pct_done": round(done / total * 100) if total else 0,
                "overdue_count": len(overdue),
                "modules_active": len(modules_data),
                "next_deadline": {
                    "name": next_deadline.name if next_deadline else None,
                    "date": next_deadline.target_date.isoformat() if next_deadline and next_deadline.target_date else None,
                } if next_deadline else None,
            },
            "modules": modules_data,
            "overdue": overdue,
            "activity": activity,
        })


class ChatDashboardView(DashboardAuthMixin, APIView):
    """Vue Chat — message stats, channel activity."""

    def get(self, request, workspace_slug, project_id):
        project = Project.objects.get(id=project_id, workspace__slug=workspace_slug)
        now = timezone.now()
        today = now.replace(hour=0, minute=0, second=0)
        week_ago = now - timedelta(days=7)

        channels = Channel.objects.filter(
            Q(project=project) | Q(workspace__slug=workspace_slug, project__isnull=True)
        )

        # Messages today
        msgs_today = Message.objects.filter(
            channel__in=channels, created_at__gte=today
        ).count()

        # Messages this week
        msgs_week = Message.objects.filter(
            channel__in=channels, created_at__gte=week_ago
        ).count()

        # Per channel stats
        channel_stats = []
        for ch in channels:
            msg_count = ch.messages.filter(created_at__gte=week_ago).count()
            last_msg = ch.messages.order_by("-created_at").first()
            channel_stats.append({
                "id": str(ch.id),
                "name": ch.name,
                "type": ch.channel_type,
                "messages_week": msg_count,
                "last_activity": last_msg.created_at.isoformat() if last_msg else None,
            })
        channel_stats.sort(key=lambda c: c["messages_week"], reverse=True)

        return Response({
            "kpis": {
                "messages_today": msgs_today,
                "messages_week": msgs_week,
                "active_channels": sum(1 for c in channel_stats if c["messages_week"] > 0),
            },
            "channels": channel_stats,
        })


class BudgetDashboardView(DashboardAuthMixin, APIView):
    """Vue Budget — devis pipeline, label-based budget tracking."""

    def get(self, request, workspace_slug, project_id):
        project = Project.objects.get(id=project_id, workspace__slug=workspace_slug)
        issues = Issue.objects.filter(project=project)

        # Devis pipeline (by state)
        devis_label = Label.objects.filter(project=project, name__icontains="devis").first()
        commande_label = Label.objects.filter(project=project, name__icontains="commande").first()

        devis_issues = issues.filter(labels=devis_label) if devis_label else issues.none()
        commande_issues = issues.filter(labels=commande_label) if commande_label else issues.none()

        # Group by state
        devis_by_state = {}
        for i in devis_issues.select_related("state"):
            state = i.state.name if i.state else "Sans statut"
            devis_by_state.setdefault(state, 0)
            devis_by_state[state] += 1

        commande_by_state = {}
        for i in commande_issues.select_related("state"):
            state = i.state.name if i.state else "Sans statut"
            commande_by_state.setdefault(state, 0)
            commande_by_state[state] += 1

        # Supplier stats (labels matching supplier names)
        supplier_labels = Label.objects.filter(
            project=project
        ).exclude(
            name__in=["Urgent", "Devis", "Commande", "Livraison", "Installation",
                       "Test", "RH", "Marketing", "Juridique", "IT"]
        )
        suppliers = []
        for label in supplier_labels:
            count = issues.filter(labels=label).count()
            if count > 0:
                done = issues.filter(labels=label, state__group="completed").count()
                suppliers.append({
                    "name": label.name,
                    "total": count,
                    "done": done,
                    "color": label.color,
                })
        suppliers.sort(key=lambda s: s["total"], reverse=True)

        return Response({
            "devis": devis_by_state,
            "commandes": commande_by_state,
            "suppliers": suppliers[:15],
            "kpis": {
                "total_devis": devis_issues.count(),
                "total_commandes": commande_issues.count(),
            },
        })


class HRDashboardView(DashboardAuthMixin, APIView):
    """Vue RH — team, formations, staffing."""

    def get(self, request, workspace_slug, project_id):
        project = Project.objects.get(id=project_id, workspace__slug=workspace_slug)
        ws = Workspace.objects.get(slug=workspace_slug)
        issues = Issue.objects.filter(project=project)

        # Team members
        members = WorkspaceMember.objects.filter(workspace=ws).select_related("member")
        team = []
        for m in members:
            assigned = issues.filter(assignees=m.member).count()
            done = issues.filter(assignees=m.member, state__group="completed").count()
            team.append({
                "name": m.member.display_name,
                "email": m.member.email,
                "role": m.role,
                "assigned": assigned,
                "done": done,
            })

        # Formation tracking
        rh_label = Label.objects.filter(project=project, name__icontains="rh").first()
        formations = issues.filter(
            Q(name__icontains="formation") | Q(labels=rh_label) if rh_label else Q(name__icontains="formation")
        ).select_related("state")[:20]

        formation_list = []
        for f in formations:
            formation_list.append({
                "name": f.name,
                "state": f.state.name if f.state else "?",
                "done": f.state.group == "completed" if f.state else False,
            })

        return Response({
            "team": team,
            "formations": formation_list,
            "kpis": {
                "team_size": len(team),
                "formations_total": len(formation_list),
                "formations_done": sum(1 for f in formation_list if f["done"]),
            },
        })


class ExecutiveDashboardView(DashboardAuthMixin, APIView):
    """Vue Direction — health score, risks, multi-project summary."""

    def get(self, request, workspace_slug, project_id):
        project = Project.objects.get(id=project_id, workspace__slug=workspace_slug)
        issues = Issue.objects.filter(project=project)
        now = timezone.now()

        total = issues.count()
        done = issues.filter(state__group="completed").count()
        in_progress = issues.filter(state__group="started").count()
        overdue = issues.filter(
            target_date__lt=now.date()
        ).exclude(state__group="completed").count()

        pct_done = round(done / total * 100) if total else 0

        # Health score (simple heuristic)
        # 100 = perfect, deduct for overdue, low completion
        health = 100
        if total > 0:
            health -= min(30, overdue * 5)  # -5 per overdue, max -30
            if pct_done < 20:
                health -= 20
            elif pct_done < 50:
                health -= 10

        # Risk level
        if health >= 80:
            risk = "low"
        elif health >= 50:
            risk = "medium"
        else:
            risk = "high"

        # Module health (segmented bars + traffic lights)
        modules = []
        for mod in Module.objects.filter(project=project):
            mod_issues = issues.filter(issue_module__module=mod)
            mod_total = mod_issues.count()
            mod_done = mod_issues.filter(state__group="completed").count()
            mod_in_progress = mod_issues.filter(
                state__group="started"
            ).exclude(target_date__lt=now.date()).count()
            mod_overdue = mod_issues.filter(
                target_date__lt=now.date()
            ).exclude(state__group="completed").count()
            mod_backlog = mod_total - mod_done - mod_in_progress - mod_overdue

            pct = round(mod_done / mod_total * 100) if mod_total else 0

            # Traffic light logic
            if mod_overdue > 3 or (mod_overdue > 0 and mod_total > 0 and mod_backlog / mod_total > 0.8):
                color = "red"
            elif mod_overdue > 0 or pct < 30:
                color = "orange"
            else:
                color = "green"

            modules.append({
                "name": mod.name,
                "total": mod_total,
                "completed": mod_done,
                "in_progress": mod_in_progress,
                "overdue": mod_overdue,
                "backlog": max(0, mod_backlog),
                "pct": pct,
                "color": color,
            })
        modules.sort(key=lambda m: m["total"], reverse=True)

        return Response({
            "health_score": health,
            "risk_level": risk,
            "kpis": {
                "total": total,
                "done": done,
                "pct_done": pct_done,
                "in_progress": in_progress,
                "overdue": overdue,
            },
            "modules": modules,
        })
