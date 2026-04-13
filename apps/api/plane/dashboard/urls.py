# Planer custom: Dashboard URL routing
from django.urls import path
from plane.dashboard.views import (
    ProjectDashboardView,
    ChatDashboardView,
    BudgetDashboardView,
    HRDashboardView,
    ExecutiveDashboardView,
)

# Prefixed with /api/v1/workspaces/<workspace_slug>/projects/<project_id>/dashboard/

urlpatterns = [
    path("project/", ProjectDashboardView.as_view(), name="dashboard-project"),
    path("chat/", ChatDashboardView.as_view(), name="dashboard-chat"),
    path("budget/", BudgetDashboardView.as_view(), name="dashboard-budget"),
    path("hr/", HRDashboardView.as_view(), name="dashboard-hr"),
    path("executive/", ExecutiveDashboardView.as_view(), name="dashboard-executive"),
]
