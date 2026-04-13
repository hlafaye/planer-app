// Planer custom: Dashboard panel with 5 views
"use client";

import { useState, useEffect, useCallback } from "react";
import { API_BASE_URL } from "@plane/constants";

type DashboardTab = "project" | "chat" | "budget" | "hr" | "executive";

const TABS: { key: DashboardTab; label: string; icon: string }[] = [
  { key: "project", label: "Projet", icon: "📊" },
  { key: "chat", label: "Chat", icon: "💬" },
  { key: "budget", label: "Budget", icon: "💰" },
  { key: "hr", label: "RH", icon: "👥" },
  { key: "executive", label: "Direction", icon: "📈" },
];

function KPICard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-lg border border-custom-border-200 bg-custom-background-100 p-4">
      <div className="text-xs text-custom-text-400 uppercase tracking-wider">{label}</div>
      <div className="text-2xl font-bold text-custom-text-100 mt-1">{value}</div>
      {sub && <div className="text-xs text-custom-text-400 mt-1">{sub}</div>}
    </div>
  );
}

function ProgressBar({ label, pct, total }: { label: string; pct: number; total: number }) {
  const color = pct >= 50 ? "bg-[#385835]" : pct >= 20 ? "bg-[#D68A79]" : "bg-[#BF5D48]";
  return (
    <div className="mb-3">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-custom-text-200">{label}</span>
        <span className="text-custom-text-400">{total} tâches · {pct}%</span>
      </div>
      <div className="h-2 rounded-full bg-custom-background-90">
        <div className={`h-2 rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function OverdueItem({ item }: { item: any }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-custom-border-100 last:border-0">
      <div>
        <span className="text-sm font-medium text-custom-text-100">#{item.sequence_id}</span>
        <span className="text-sm text-custom-text-200 ml-2">{item.name}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-red-500 font-medium">{item.days_overdue}j</span>
        <span className="text-xs text-custom-text-400">{item.assignee}</span>
      </div>
    </div>
  );
}

function ModuleHealth({ mod }: { mod: any }) {
  const colors: Record<string, string> = {
    green: "bg-[#385835]",
    orange: "bg-[#D68A79]",
    red: "bg-[#BF5D48]",
  };
  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className={`w-3 h-3 rounded-full ${colors[mod.color] || "bg-gray-400"}`} />
      <span className="text-sm text-custom-text-200 flex-1">{mod.name}</span>
      <span className="text-xs text-custom-text-400">{mod.pct}%</span>
      {mod.overdue > 0 && <span className="text-xs text-red-500">{mod.overdue} retard</span>}
    </div>
  );
}

export function DashboardPanel({ workspaceSlug, projectId }: { workspaceSlug: string; projectId: string }) {
  const [activeTab, setActiveTab] = useState<DashboardTab>("project");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await fetch(
        `${API_BASE_URL}/api/v1/workspaces/${workspaceSlug}/projects/${projectId}/dashboard/${activeTab}/`,
        { credentials: "include" }
      );
      if (resp.ok) setData(await resp.json());
    } catch (err) {
      console.error("Dashboard fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [workspaceSlug, projectId, activeTab]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  return (
    <div className="h-full flex flex-col">
      {/* Tab bar */}
      <div className="flex items-center gap-1 px-4 py-3 border-b border-custom-border-200 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === tab.key
                ? "bg-[#BF5D48]/10 text-[#BF5D48]"
                : "text-custom-text-300 hover:bg-custom-background-90"
            }`}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-full text-custom-text-400">Chargement...</div>
        ) : !data ? (
          <div className="flex items-center justify-center h-full text-custom-text-400">Aucune donnée</div>
        ) : activeTab === "project" ? (
          <ProjectView data={data} />
        ) : activeTab === "chat" ? (
          <ChatView data={data} />
        ) : activeTab === "budget" ? (
          <BudgetView data={data} />
        ) : activeTab === "hr" ? (
          <HRView data={data} />
        ) : activeTab === "executive" ? (
          <ExecutiveView data={data} />
        ) : null}
      </div>
    </div>
  );
}

function ProjectView({ data }: { data: any }) {
  const { kpis, modules, overdue, activity } = data;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard label="Tâches" value={kpis.total} sub={`${kpis.done} terminées (${kpis.pct_done}%)`} />
        <KPICard label="En cours / Retard" value={`${kpis.in_progress} / ${kpis.overdue_count}`} />
        <KPICard label="Modules" value={`${kpis.modules_active}`} sub="actifs" />
        <KPICard label="Prochaine échéance" value={kpis.next_deadline?.name || "—"} sub={kpis.next_deadline?.date || ""} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-lg border border-custom-border-200 p-4">
          <h3 className="text-sm font-semibold text-custom-text-100 mb-4">Progression par module</h3>
          {modules.map((m: any) => (
            <ProgressBar key={m.id} label={m.name} pct={m.pct} total={m.total} />
          ))}
        </div>

        <div className="rounded-lg border border-custom-border-200 p-4">
          <h3 className="text-sm font-semibold text-custom-text-100 mb-4">
            Tâches en retard ({overdue.length})
          </h3>
          {overdue.length === 0 ? (
            <div className="text-sm text-custom-text-400">Aucune tâche en retard</div>
          ) : (
            overdue.map((item: any) => <OverdueItem key={item.id} item={item} />)
          )}
        </div>
      </div>

      <div className="rounded-lg border border-custom-border-200 p-4">
        <h3 className="text-sm font-semibold text-custom-text-100 mb-4">Activité récente</h3>
        {activity.map((a: any, i: number) => (
          <div key={i} className="flex items-center gap-3 py-1.5 text-sm">
            <span className="text-custom-text-400 text-xs w-20">{new Date(a.updated_at).toLocaleDateString("fr-FR")}</span>
            <span className="text-custom-text-200">{a.actor}</span>
            <span className="text-custom-text-400">→</span>
            <span className="font-medium text-custom-text-100">#{a.sequence_id}</span>
            <span className="text-custom-text-200 truncate">{a.name}</span>
            <span className="ml-auto text-xs px-2 py-0.5 rounded bg-custom-background-90">{a.state}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChatView({ data }: { data: any }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <KPICard label="Messages aujourd'hui" value={data.kpis.messages_today} />
        <KPICard label="Messages cette semaine" value={data.kpis.messages_week} />
        <KPICard label="Channels actifs" value={data.kpis.active_channels} />
      </div>
      <div className="rounded-lg border border-custom-border-200 p-4">
        <h3 className="text-sm font-semibold text-custom-text-100 mb-4">Activité par channel</h3>
        {data.channels.map((ch: any) => (
          <div key={ch.id} className="flex items-center justify-between py-2 border-b border-custom-border-100 last:border-0">
            <span className="text-sm text-custom-text-200">#{ch.name}</span>
            <span className="text-xs text-custom-text-400">{ch.messages_week} msgs</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BudgetView({ data }: { data: any }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <KPICard label="Devis" value={data.kpis.total_devis} />
        <KPICard label="Commandes" value={data.kpis.total_commandes} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-lg border border-custom-border-200 p-4">
          <h3 className="text-sm font-semibold text-custom-text-100 mb-4">Pipeline devis</h3>
          {Object.entries(data.devis).map(([state, count]) => (
            <div key={state} className="flex justify-between py-1.5 text-sm">
              <span className="text-custom-text-200">{state}</span>
              <span className="font-medium text-custom-text-100">{count as number}</span>
            </div>
          ))}
        </div>
        <div className="rounded-lg border border-custom-border-200 p-4">
          <h3 className="text-sm font-semibold text-custom-text-100 mb-4">Fournisseurs</h3>
          {data.suppliers.map((s: any) => (
            <div key={s.name} className="flex items-center justify-between py-1.5 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color }} />
                <span className="text-custom-text-200">{s.name}</span>
              </div>
              <span className="text-xs text-custom-text-400">{s.done}/{s.total}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function HRView({ data }: { data: any }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <KPICard label="Équipe" value={data.kpis.team_size} sub="membres" />
        <KPICard label="Formations" value={`${data.kpis.formations_done}/${data.kpis.formations_total}`} />
        <KPICard label="Taux" value={`${data.kpis.formations_total > 0 ? Math.round(data.kpis.formations_done / data.kpis.formations_total * 100) : 0}%`} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-lg border border-custom-border-200 p-4">
          <h3 className="text-sm font-semibold text-custom-text-100 mb-4">Équipe</h3>
          {data.team.map((m: any) => (
            <div key={m.email} className="flex items-center justify-between py-2 border-b border-custom-border-100 last:border-0">
              <div>
                <div className="text-sm font-medium text-custom-text-100">{m.name}</div>
                <div className="text-xs text-custom-text-400">{m.email}</div>
              </div>
              <div className="text-xs text-custom-text-400">{m.done}/{m.assigned} tâches</div>
            </div>
          ))}
        </div>
        <div className="rounded-lg border border-custom-border-200 p-4">
          <h3 className="text-sm font-semibold text-custom-text-100 mb-4">Formations</h3>
          {data.formations.map((f: any, i: number) => (
            <div key={i} className="flex items-center justify-between py-1.5 text-sm">
              <span className="text-custom-text-200 truncate">{f.name}</span>
              <span className={`text-xs px-2 py-0.5 rounded ${f.done ? "bg-[#385835]/20 text-[#385835]" : "bg-custom-background-90 text-custom-text-400"}`}>
                {f.done ? "✓" : f.state}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ExecutiveView({ data }: { data: any }) {
  const healthColor = data.health_score >= 80 ? "text-[#385835]" : data.health_score >= 50 ? "text-[#D68A79]" : "text-[#BF5D48]";
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-lg border border-custom-border-200 bg-custom-background-100 p-4 col-span-2">
          <div className="text-xs text-custom-text-400 uppercase">Score santé projet</div>
          <div className={`text-4xl font-bold mt-1 ${healthColor}`}>{data.health_score}/100</div>
          <div className="text-xs text-custom-text-400 mt-1">Risque: {data.risk_level}</div>
        </div>
        <KPICard label="Avancement" value={`${data.kpis.pct_done}%`} sub={`${data.kpis.done}/${data.kpis.total}`} />
        <KPICard label="En retard" value={data.kpis.overdue} sub="tâches" />
      </div>

      <div className="rounded-lg border border-custom-border-200 p-4">
        <h3 className="text-sm font-semibold text-custom-text-100 mb-4">Santé par module</h3>
        {data.modules.map((mod: any) => (
          <ModuleHealth key={mod.name} mod={mod} />
        ))}
      </div>
    </div>
  );
}
