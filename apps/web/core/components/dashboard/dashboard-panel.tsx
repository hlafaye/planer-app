// Planer custom: Dashboard panel with 5 views — polished UI
"use client";

import { useState, useEffect, useCallback } from "react";

type DashboardTab = "project" | "chat" | "budget" | "hr" | "executive";

const TABS: { key: DashboardTab; label: string; icon: string }[] = [
  { key: "project", label: "Projet", icon: "📊" },
  { key: "chat", label: "Chat", icon: "💬" },
  { key: "budget", label: "Budget", icon: "💰" },
  { key: "hr", label: "RH", icon: "👥" },
  { key: "executive", label: "Direction", icon: "📈" },
];

// ── Shared components ──

function KPICard({ icon, label, value, sub, color = "default" }: {
  icon?: string; label: string; value: string | number; sub?: string;
  color?: "default" | "red" | "green" | "orange";
}) {
  const borderColors = {
    default: "border-custom-border-200",
    red: "border-red-300",
    green: "border-emerald-300",
    orange: "border-orange-300",
  };
  return (
    <div className={`rounded-xl border ${borderColors[color]} bg-custom-background-100 p-4 shadow-sm`}>
      <div className="flex items-center gap-2 text-xs text-custom-text-400 uppercase tracking-wider">
        {icon && <span>{icon}</span>}
        {label}
      </div>
      <div className="text-2xl font-bold text-custom-text-100 mt-1">{value}</div>
      {sub && <div className="text-xs text-custom-text-400 mt-1">{sub}</div>}
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-custom-border-200 bg-custom-background-100 p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-custom-text-100 mb-4">{title}</h3>
      {children}
    </div>
  );
}

function ProgressBar({ label, pct, total, done }: { label: string; pct: number; total: number; done?: number }) {
  return (
    <div className="mb-3">
      <div className="flex justify-between text-xs mb-1.5">
        <span className="text-custom-text-200 font-medium">{label}</span>
        <span className="text-custom-text-400">{done !== undefined ? `${done}/${total}` : `${total}`} · {pct}%</span>
      </div>
      <div className="h-2.5 rounded-full bg-custom-background-90 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${Math.max(pct, 2)}%`,
            background: pct >= 50 ? "#4ade80" : pct >= 20 ? "#fb923c" : "#ef4444",
          }}
        />
      </div>
    </div>
  );
}

function Placeholder({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <span className="text-5xl mb-4">{icon}</span>
      <h3 className="text-lg font-semibold text-custom-text-100 mb-2">{title}</h3>
      <p className="text-sm text-custom-text-400 max-w-md">{description}</p>
    </div>
  );
}

function TrafficLight({ color }: { color: string }) {
  const bg = color === "green" ? "bg-emerald-400" : color === "orange" ? "bg-orange-400" : "bg-red-400";
  const glow = color === "green" ? "shadow-emerald-400/40" : color === "orange" ? "shadow-orange-400/40" : "shadow-red-400/40";
  return <div className={`w-3.5 h-3.5 rounded-full ${bg} shadow-md ${glow}`} />;
}

// ── Main panel ──

export function DashboardPanel({ workspaceSlug, projectId }: { workspaceSlug: string; projectId: string }) {
  const [activeTab, setActiveTab] = useState<DashboardTab>("project");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const switchTab = useCallback((tab: DashboardTab) => {
    setData(null); // Reset data when switching tabs
    setActiveTab(tab);
  }, []);

  const fetchDashboard = useCallback(async () => {
    // Skip fetch for placeholder tabs
    if (activeTab === "budget") return;
    setLoading(true);
    try {
      const resp = await fetch(
        `/api/v1/workspaces/${workspaceSlug}/projects/${projectId}/dashboard/${activeTab}/`,
        { credentials: "include" }
      );
      if (resp.ok) setData(await resp.json());
      else setData(null);
    } catch (err) {
      console.error("Dashboard fetch error:", err);
      setData(null);
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
      <div className="flex items-center gap-1 px-6 py-3 border-b border-custom-border-200 bg-custom-background-100">
        <h2 className="text-sm font-semibold text-custom-text-100 mr-4">Dashboard</h2>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => switchTab(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.key
                ? "bg-[#BF5D48] text-white shadow-sm"
                : "text-custom-text-300 hover:bg-custom-background-90"
            }`}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto bg-custom-background-90/50 p-6">
        {loading ? (
          <div className="flex items-center justify-center h-full text-custom-text-400">
            <span className="animate-pulse">Chargement...</span>
          </div>
        ) : activeTab === "project" ? (
          data ? <ProjectView data={data} /> : <Placeholder icon="📊" title="Données indisponibles" description="Impossible de charger les données du projet." />
        ) : activeTab === "chat" ? (
          data ? <ChatView data={data} /> : <Placeholder icon="💬" title="Données indisponibles" description="Impossible de charger les stats chat." />
        ) : activeTab === "budget" ? (
          <Placeholder icon="💰" title="Module Budget" description="Le suivi budgétaire sera alimenté par le Configurateur AO. En attendant, les données budget sont dans les fichiers Excel du projet." />
        ) : activeTab === "hr" ? (
          data ? <HRView data={data} /> : <Placeholder icon="👥" title="Module RH" description="Le suivi des effectifs et formations sera disponible prochainement." />
        ) : activeTab === "executive" ? (
          data ? <ExecutiveView data={data} /> : <Placeholder icon="📈" title="Données indisponibles" description="Impossible de charger la vue direction." />
        ) : null}
      </div>
    </div>
  );
}

// ── Vue Projet ──

function ProjectView({ data }: { data: any }) {
  const { kpis, modules, overdue, activity } = data;
  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard icon="📋" label="Tâches" value={kpis.total} sub={`${kpis.done} terminées (${kpis.pct_done}%)`} />
        <KPICard icon="⚠️" label="En retard" value={kpis.overdue_count} color={kpis.overdue_count > 0 ? "red" : "green"} sub={kpis.overdue_count > 0 ? "à traiter" : "aucune"} />
        <KPICard icon="📦" label="Modules" value={kpis.modules_active} color="green" sub="actifs" />
        <KPICard icon="📅" label="Prochaine échéance" value={kpis.next_deadline?.name?.substring(0, 20) || "—"} sub={kpis.next_deadline?.date || ""} color="orange" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Module progress */}
        <SectionCard title="📦 Progression par module">
          {modules.map((m: any) => (
            <ProgressBar key={m.id} label={m.name} pct={m.pct} total={m.total} done={m.done} />
          ))}
        </SectionCard>

        {/* Overdue tasks */}
        <SectionCard title={`⚠️ Tâches en retard (${overdue.length})`}>
          {overdue.length === 0 ? (
            <div className="text-sm text-emerald-500 flex items-center gap-2 py-4">
              <span>✅</span> Aucune tâche en retard
            </div>
          ) : (
            <div className="space-y-2">
              {overdue.map((item: any) => (
                <div key={item.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-red-50/50 dark:bg-red-950/10">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-mono text-red-500">#{item.sequence_id}</span>
                    <span className="text-sm text-custom-text-200 truncate">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-xs font-semibold text-red-500">{item.days_overdue}j</span>
                    <span className="text-xs text-custom-text-400">{item.assignee}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      {/* Activity */}
      <SectionCard title="🕐 Activité récente">
        <div className="space-y-1">
          {activity.map((a: any, i: number) => (
            <div key={i} className="flex items-center gap-3 py-2 text-sm hover:bg-custom-background-90/50 rounded-lg px-2">
              <span className="text-xs text-custom-text-400 w-20 flex-shrink-0">
                {new Date(a.updated_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
              </span>
              <span className="text-custom-text-200 font-medium w-24 truncate flex-shrink-0">{a.actor}</span>
              <span className="font-mono text-xs text-[#BF5D48]">#{a.sequence_id}</span>
              <span className="text-custom-text-300 truncate">{a.name}</span>
              <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-custom-background-90 text-custom-text-400 flex-shrink-0">{a.state}</span>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

// ── Vue Chat ──

function ChatView({ data }: { data: any }) {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="grid grid-cols-3 gap-4">
        <KPICard icon="💬" label="Messages aujourd'hui" value={data.kpis.messages_today} />
        <KPICard icon="📅" label="Cette semaine" value={data.kpis.messages_week} />
        <KPICard icon="📡" label="Channels actifs" value={data.kpis.active_channels} />
      </div>
      <SectionCard title="📡 Activité par channel">
        {data.channels.map((ch: any) => (
          <div key={ch.id} className="flex items-center justify-between py-2.5 border-b border-custom-border-100 last:border-0">
            <div className="flex items-center gap-2">
              <span className="text-xs">{ch.type === "general" ? "🏠" : ch.type === "project" ? "📁" : "📦"}</span>
              <span className="text-sm font-medium text-custom-text-200">#{ch.name}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-custom-text-400">{ch.messages_week} msgs</span>
              {ch.last_activity && (
                <span className="text-xs text-custom-text-400">
                  {new Date(ch.last_activity).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                </span>
              )}
            </div>
          </div>
        ))}
      </SectionCard>
    </div>
  );
}

// ── Vue RH ──

function HRView({ data }: { data: any }) {
  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="grid grid-cols-3 gap-4">
        <KPICard icon="👥" label="Équipe" value={data.kpis.team_size} sub="membres" />
        <KPICard icon="🎓" label="Formations" value={`${data.kpis.formations_done}/${data.kpis.formations_total}`} sub="complétées" color={data.kpis.formations_done === data.kpis.formations_total ? "green" : "orange"} />
        <KPICard icon="📊" label="Taux" value={`${data.kpis.formations_total > 0 ? Math.round(data.kpis.formations_done / data.kpis.formations_total * 100) : 0}%`} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title="👥 Équipe">
          {data.team.map((m: any) => (
            <div key={m.email} className="flex items-center justify-between py-2.5 border-b border-custom-border-100 last:border-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#BF5D48] flex items-center justify-center text-white text-xs font-bold uppercase">
                  {m.name[0]}
                </div>
                <div>
                  <div className="text-sm font-medium text-custom-text-100">{m.name}</div>
                  <div className="text-xs text-custom-text-400">{m.email}</div>
                </div>
              </div>
              <div className="text-xs text-custom-text-400">{m.done}/{m.assigned} tâches</div>
            </div>
          ))}
        </SectionCard>
        <SectionCard title="🎓 Formations">
          {data.formations.map((f: any, i: number) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-custom-border-100 last:border-0">
              <span className="text-sm text-custom-text-200 truncate pr-4">{f.name}</span>
              {f.done ? (
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 flex-shrink-0">✓ Fait</span>
              ) : (
                <span className="text-xs px-2 py-0.5 rounded-full bg-custom-background-90 text-custom-text-400 flex-shrink-0">{f.state}</span>
              )}
            </div>
          ))}
        </SectionCard>
      </div>
    </div>
  );
}

// ── Vue Direction ──

function ExecutiveView({ data }: { data: any }) {
  const healthColor = data.health_score >= 80 ? "text-emerald-500" : data.health_score >= 50 ? "text-orange-500" : "text-red-500";
  const healthBg = data.health_score >= 80 ? "from-emerald-500/10" : data.health_score >= 50 ? "from-orange-500/10" : "from-red-500/10";
  const riskLabel = data.risk_level === "low" ? "Faible" : data.risk_level === "medium" ? "Moyen" : "Élevé";

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Health score hero */}
      <div className={`rounded-xl bg-gradient-to-r ${healthBg} to-transparent border border-custom-border-200 p-6 flex items-center gap-8`}>
        <div className="text-center">
          <div className={`text-5xl font-black ${healthColor}`}>{data.health_score}</div>
          <div className="text-xs text-custom-text-400 mt-1">/ 100</div>
        </div>
        <div>
          <div className="text-lg font-semibold text-custom-text-100">Santé du projet</div>
          <div className="text-sm text-custom-text-400">
            Risque {riskLabel} — {data.kpis.overdue} tâche{data.kpis.overdue !== 1 ? "s" : ""} en retard
          </div>
        </div>
      </div>

      {/* KPIs macro */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard icon="📊" label="Avancement" value={`${data.kpis.pct_done}%`} sub={`${data.kpis.done}/${data.kpis.total} tâches`} color="green" />
        <KPICard icon="🔄" label="En cours" value={data.kpis.in_progress} />
        <KPICard icon="⚠️" label="En retard" value={data.kpis.overdue} color={data.kpis.overdue > 0 ? "red" : "green"} />
        <KPICard icon="📋" label="Backlog" value={data.kpis.total - data.kpis.done - data.kpis.in_progress} />
      </div>

      {/* Module health — traffic lights */}
      <SectionCard title="🚦 Santé par module">
        <div className="space-y-2">
          {data.modules.map((mod: any) => (
            <div key={mod.name} className="flex items-center gap-4 py-2.5 px-3 rounded-lg hover:bg-custom-background-90/50">
              <TrafficLight color={mod.color} />
              <span className="text-sm font-medium text-custom-text-200 flex-1">{mod.name}</span>
              <div className="w-32">
                <div className="h-2 rounded-full bg-custom-background-90 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.max(mod.pct, 3)}%`,
                      background: mod.color === "green" ? "#4ade80" : mod.color === "orange" ? "#fb923c" : "#ef4444",
                    }}
                  />
                </div>
              </div>
              <span className="text-xs text-custom-text-400 w-10 text-right">{mod.pct}%</span>
              {mod.overdue > 0 && (
                <span className="text-xs text-red-500 font-medium">{mod.overdue} retard{mod.overdue > 1 ? "s" : ""}</span>
              )}
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
