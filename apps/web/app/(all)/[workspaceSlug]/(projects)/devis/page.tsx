// Planer custom: Devis list page — full UI
"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useCallback, useMemo } from "react";

type DevisItem = {
  id: string;
  reference: string;
  type_devis: string;
  nom: string;
  fournisseur_nom: string;
  montant_ht: number;
  montant_ttc: number;
  statut: string;
  statut_display: string;
  date_devis: string;
};

type Stats = {
  total: number;
  by_statut: Record<string, { label: string; count: number }>;
  total_approuve_ht: number;
  total_approuve_ttc: number;
};

const STATUT_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  draft: { bg: "bg-gray-500/10", text: "text-gray-400", dot: "bg-gray-400" },
  pending: { bg: "bg-orange-500/10", text: "text-orange-400", dot: "bg-orange-400" },
  approved: { bg: "bg-emerald-500/10", text: "text-emerald-400", dot: "bg-emerald-400" },
  rejected: { bg: "bg-red-500/10", text: "text-red-400", dot: "bg-red-400" },
  modif_requested: { bg: "bg-yellow-500/10", text: "text-yellow-400", dot: "bg-yellow-400" },
  ordered: { bg: "bg-blue-500/10", text: "text-blue-400", dot: "bg-blue-400" },
  delivered: { bg: "bg-emerald-500/10", text: "text-emerald-400", dot: "bg-emerald-400" },
  invoiced: { bg: "bg-purple-500/10", text: "text-purple-400", dot: "bg-purple-400" },
  archived: { bg: "bg-gray-500/10", text: "text-gray-500", dot: "bg-gray-500" },
};

const TYPE_ICONS: Record<string, string> = {
  fournisseur: "📦",
  sous_traitant: "🔧",
  personnel: "👥",
  client: "💼",
};

const TABS = [
  { key: "all", label: "Tous" },
  { key: "pending", label: "À valider" },
  { key: "approved", label: "Approuvés" },
  { key: "ordered", label: "Commandés" },
  { key: "rejected", label: "Rejetés" },
  { key: "draft", label: "Brouillons" },
];

function StatusChip({ statut, label }: { statut: string; label: string }) {
  const s = STATUT_STYLES[statut] || STATUT_STYLES.draft;
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full ${s.bg} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {label}
    </span>
  );
}

function KPICard({ icon, label, value, sub, accentColor }: {
  icon: string; label: string; value: string; sub?: string; accentColor: string;
}) {
  return (
    <div className="rounded-xl bg-custom-background-100 border border-custom-border-200 p-4 shadow-sm flex items-start gap-3">
      <div className="w-1 h-12 rounded-full flex-shrink-0" style={{ backgroundColor: accentColor }} />
      <div>
        <div className="text-[10px] uppercase tracking-wider text-custom-text-400 flex items-center gap-1">
          <span>{icon}</span> {label}
        </div>
        <div className="text-xl font-bold text-custom-text-100 mt-0.5">{value}</div>
        {sub && <div className="text-[11px] text-custom-text-400 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

export default function DevisPage() {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const [devisList, setDevisList] = useState<DevisItem[]>([]);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats | null>(null);
  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [showNewForm, setShowNewForm] = useState(false);

  // New devis form state
  const [newDevis, setNewDevis] = useState({
    nom: "", type_devis: "fournisseur", montant_ht: "", date_devis: new Date().toISOString().split("T")[0],
    description: "",
  });

  useEffect(() => {
    async function fetchProject() {
      const resp = await fetch(`/api/workspaces/${workspaceSlug}/projects/`, { credentials: "include" });
      if (resp.ok) {
        const data = await resp.json();
        const projects = data.results || data;
        if (Array.isArray(projects) && projects.length > 0) setProjectId(projects[0].id);
        else {
          for (const val of Object.values(data)) {
            if (Array.isArray(val) && (val as any[]).length > 0) { setProjectId((val as any[])[0].id); break; }
          }
        }
      }
    }
    fetchProject();
  }, [workspaceSlug]);

  const fetchDevis = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const [listResp, statsResp] = await Promise.all([
        fetch(`/api/v1/workspaces/${workspaceSlug}/projects/${projectId}/devis/`, { credentials: "include" }),
        fetch(`/api/v1/workspaces/${workspaceSlug}/projects/${projectId}/devis/stats/`, { credentials: "include" }),
      ]);
      if (listResp.ok) {
        const data = await listResp.json();
        setDevisList(Array.isArray(data) ? data : data.results || []);
      }
      if (statsResp.ok) setStats(await statsResp.json());
    } catch (err) {
      console.error("Failed to fetch devis:", err);
    } finally {
      setLoading(false);
    }
  }, [workspaceSlug, projectId]);

  useEffect(() => { fetchDevis(); }, [fetchDevis]);

  // Filtered devis
  const filteredDevis = useMemo(() => {
    let list = devisList;
    if (activeTab !== "all") list = list.filter((d) => d.statut === activeTab);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((d) => d.nom.toLowerCase().includes(q) || d.reference.toLowerCase().includes(q) || d.fournisseur_nom.toLowerCase().includes(q));
    }
    if (typeFilter) list = list.filter((d) => d.type_devis === typeFilter);
    return list;
  }, [devisList, activeTab, search, typeFilter]);

  const formatMoney = (n: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);

  const handleCreateDevis = async () => {
    if (!projectId || !newDevis.nom || !newDevis.montant_ht) return;
    try {
      const resp = await fetch(`/api/v1/workspaces/${workspaceSlug}/projects/${projectId}/devis/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...newDevis,
          montant_ht: parseFloat(newDevis.montant_ht),
        }),
      });
      if (resp.ok) {
        setShowNewForm(false);
        setNewDevis({ nom: "", type_devis: "fournisseur", montant_ht: "", date_devis: new Date().toISOString().split("T")[0], description: "" });
        fetchDevis();
      }
    } catch (err) {
      console.error("Failed to create devis:", err);
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-lg font-bold text-custom-text-100">📄 Devis & Validation</h1>
            <p className="text-xs text-custom-text-400 mt-0.5">Suivi des devis, validation et commandes</p>
          </div>
          <div className="flex items-center gap-2">
            <a href={`/${workspaceSlug}/devis/regles`} className="px-3 py-2 rounded-lg border border-custom-border-200 text-xs text-custom-text-300 hover:bg-custom-background-90 no-underline">
              ⚙️ Règles
            </a>
            <a
              href={`/${workspaceSlug}/devis/nouveau`}
              className="px-4 py-2 rounded-lg bg-[#BF5D48] text-white text-sm font-medium hover:bg-[#a84d3b] transition-colors shadow-sm no-underline"
            >
              + Nouveau devis
            </a>
          </div>
        </div>

        {/* New devis form (collapsible) */}
        {showNewForm && (
          <div className="rounded-xl border border-[#BF5D48]/30 bg-custom-background-100 p-5 mb-6 shadow-sm">
            <h3 className="text-sm font-semibold text-custom-text-100 mb-4">Nouveau devis</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Type selection */}
              <div className="md:col-span-2">
                <label className="text-xs text-custom-text-400 mb-1.5 block">Type</label>
                <div className="flex gap-2">
                  {(["fournisseur", "sous_traitant", "personnel", "client"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setNewDevis({ ...newDevis, type_devis: t })}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border transition-colors ${
                        newDevis.type_devis === t
                          ? "border-[#BF5D48] bg-[#BF5D48]/10 text-[#BF5D48]"
                          : "border-custom-border-200 text-custom-text-300 hover:border-custom-border-300"
                      }`}
                    >
                      <span>{TYPE_ICONS[t]}</span>
                      {t.replace("_", "-")}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-custom-text-400 mb-1.5 block">Nom du devis *</label>
                <input
                  value={newDevis.nom}
                  onChange={(e) => setNewDevis({ ...newDevis, nom: e.target.value })}
                  placeholder="Ex: Four mixte Rational 20 niveaux"
                  className="w-full rounded-lg border border-custom-border-200 bg-custom-background-100 px-3 py-2 text-sm text-custom-text-100 placeholder:text-custom-text-400 focus:border-[#BF5D48] focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-custom-text-400 mb-1.5 block">Montant HT (EUR) *</label>
                <input
                  type="number"
                  step="0.01"
                  value={newDevis.montant_ht}
                  onChange={(e) => setNewDevis({ ...newDevis, montant_ht: e.target.value })}
                  placeholder="18450.00"
                  className="w-full rounded-lg border border-custom-border-200 bg-custom-background-100 px-3 py-2 text-sm text-custom-text-100 placeholder:text-custom-text-400 focus:border-[#BF5D48] focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-custom-text-400 mb-1.5 block">Date du devis</label>
                <input
                  type="date"
                  value={newDevis.date_devis}
                  onChange={(e) => setNewDevis({ ...newDevis, date_devis: e.target.value })}
                  className="w-full rounded-lg border border-custom-border-200 bg-custom-background-100 px-3 py-2 text-sm text-custom-text-100 focus:border-[#BF5D48] focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-custom-text-400 mb-1.5 block">Description</label>
                <input
                  value={newDevis.description}
                  onChange={(e) => setNewDevis({ ...newDevis, description: e.target.value })}
                  placeholder="Description optionnelle"
                  className="w-full rounded-lg border border-custom-border-200 bg-custom-background-100 px-3 py-2 text-sm text-custom-text-100 placeholder:text-custom-text-400 focus:border-[#BF5D48] focus:outline-none"
                />
              </div>
            </div>

            {/* Preview TVA/TTC */}
            {newDevis.montant_ht && (
              <div className="mt-3 flex items-center gap-4 text-xs text-custom-text-400">
                <span>TVA 20% : {formatMoney(parseFloat(newDevis.montant_ht) * 0.2)}</span>
                <span>TTC : <strong className="text-custom-text-100">{formatMoney(parseFloat(newDevis.montant_ht) * 1.2)}</strong></span>
              </div>
            )}

            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setShowNewForm(false)}
                className="px-4 py-2 rounded-lg text-sm text-custom-text-300 hover:bg-custom-background-90"
              >
                Annuler
              </button>
              <button
                onClick={handleCreateDevis}
                disabled={!newDevis.nom || !newDevis.montant_ht}
                className="px-4 py-2 rounded-lg bg-[#BF5D48] text-white text-sm font-medium hover:bg-[#a84d3b] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Créer le devis
              </button>
            </div>
          </div>
        )}

        {/* KPI cards */}
        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
            <KPICard icon="📋" label="Total" value={String(stats.total)} accentColor="#6b6560" />
            <KPICard icon="⏳" label="En attente" value={String(stats.by_statut?.pending?.count || 0)} accentColor="#fb923c" />
            <KPICard icon="✅" label="Approuvés" value={String((stats.by_statut?.approved?.count || 0) + (stats.by_statut?.ordered?.count || 0))} accentColor="#4ade80" />
            <KPICard icon="💰" label="Engagement HT" value={formatMoney(stats.total_approuve_ht)} sub="approuvés + commandés" accentColor="#BF5D48" />
            <KPICard icon="❌" label="Rejetés" value={String(stats.by_statut?.rejected?.count || 0)} accentColor="#ef4444" />
          </div>
        )}

        {/* Sub-tabs */}
        <div className="flex items-center gap-1 mb-4 border-b border-custom-border-200 pb-2">
          {TABS.map((tab) => {
            const count = tab.key === "all" ? devisList.length : devisList.filter((d) => d.statut === tab.key).length;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  activeTab === tab.key
                    ? "bg-[#BF5D48]/10 text-[#BF5D48]"
                    : "text-custom-text-400 hover:text-custom-text-200 hover:bg-custom-background-90"
                }`}
              >
                {tab.label} {count > 0 && <span className="ml-1 opacity-60">({count})</span>}
              </button>
            );
          })}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 mb-4">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍 Rechercher un devis..."
            className="flex-1 max-w-xs rounded-lg border border-custom-border-200 bg-custom-background-100 px-3 py-1.5 text-sm text-custom-text-100 placeholder:text-custom-text-400 focus:border-[#BF5D48] focus:outline-none"
          />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-lg border border-custom-border-200 bg-custom-background-100 px-3 py-1.5 text-sm text-custom-text-200 focus:outline-none"
          >
            <option value="">Tous les types</option>
            <option value="fournisseur">📦 Fournisseur</option>
            <option value="sous_traitant">🔧 Sous-traitant</option>
            <option value="personnel">👥 Personnel</option>
            <option value="client">💼 Client</option>
          </select>
        </div>

        {/* Table */}
        <div className="rounded-xl border border-custom-border-200 bg-custom-background-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-custom-border-200" style={{ backgroundColor: "rgba(90,85,82,0.1)" }}>
                <th className="text-left px-4 py-3 text-[10px] font-semibold text-custom-text-400 uppercase tracking-wider">Réf.</th>
                <th className="text-left px-4 py-3 text-[10px] font-semibold text-custom-text-400 uppercase tracking-wider">Devis</th>
                <th className="text-left px-4 py-3 text-[10px] font-semibold text-custom-text-400 uppercase tracking-wider">Type</th>
                <th className="text-left px-4 py-3 text-[10px] font-semibold text-custom-text-400 uppercase tracking-wider">Fournisseur</th>
                <th className="text-right px-4 py-3 text-[10px] font-semibold text-custom-text-400 uppercase tracking-wider">Montant HT</th>
                <th className="text-left px-4 py-3 text-[10px] font-semibold text-custom-text-400 uppercase tracking-wider">Statut</th>
                <th className="text-left px-4 py-3 text-[10px] font-semibold text-custom-text-400 uppercase tracking-wider">Date</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-custom-text-400 text-sm">Chargement...</td></tr>
              ) : filteredDevis.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center">
                  <div className="text-custom-text-400">
                    <span className="text-3xl block mb-2">📄</span>
                    <p className="text-sm">{activeTab === "all" ? "Aucun devis" : `Aucun devis ${TABS.find(t => t.key === activeTab)?.label.toLowerCase()}`}</p>
                    <p className="text-xs mt-1">Cliquez "Nouveau devis" pour en créer un</p>
                  </div>
                </td></tr>
              ) : (
                filteredDevis.map((d) => (
                  <tr key={d.id} className="border-b border-custom-border-100 hover:bg-custom-background-90/30 cursor-pointer transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-[#BF5D48] font-medium">{d.reference}</td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-custom-text-100 font-medium">{d.nom}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs">{TYPE_ICONS[d.type_devis] || ""} {d.type_devis}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-custom-text-300">{d.fournisseur_nom || "—"}</td>
                    <td className="px-4 py-3 text-right font-mono text-sm font-medium text-custom-text-100">{formatMoney(d.montant_ht)}</td>
                    <td className="px-4 py-3">
                      <StatusChip statut={d.statut} label={d.statut_display} />
                    </td>
                    <td className="px-4 py-3 text-xs text-custom-text-400">
                      {d.date_devis ? new Date(d.date_devis).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer stats */}
        {filteredDevis.length > 0 && (
          <div className="flex items-center justify-between mt-3 text-xs text-custom-text-400">
            <span>{filteredDevis.length} devis affichés</span>
            <span>Total HT : <strong className="text-custom-text-100">{formatMoney(filteredDevis.reduce((s, d) => s + d.montant_ht, 0))}</strong></span>
          </div>
        )}
      </div>
    </div>
  );
}
