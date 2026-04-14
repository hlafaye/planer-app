// Planer custom: Devis list page
"use client";

import { useParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";

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

const STATUT_COLORS: Record<string, string> = {
  draft: "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
  pending: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  modif_requested: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  ordered: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  delivered: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  invoiced: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
};

export default function DevisPage() {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const [devisList, setDevisList] = useState<DevisItem[]>([]);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);

  // Fetch project first
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

  // Fetch devis list + stats
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

  const formatMoney = (n: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-lg font-bold text-custom-text-100">Devis & Commandes</h1>
            <p className="text-xs text-custom-text-400">Suivi des devis fournisseurs et validations</p>
          </div>
        </div>

        {/* Stats KPIs */}
        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="rounded-xl border border-custom-border-200 bg-custom-background-100 p-4 shadow-sm">
              <div className="text-xs text-custom-text-400 uppercase">Total devis</div>
              <div className="text-2xl font-bold text-custom-text-100 mt-1">{stats.total}</div>
            </div>
            <div className="rounded-xl border border-custom-border-200 bg-custom-background-100 p-4 shadow-sm">
              <div className="text-xs text-custom-text-400 uppercase">Approuvés HT</div>
              <div className="text-2xl font-bold text-emerald-500 mt-1">{formatMoney(stats.total_approuve_ht)}</div>
            </div>
            <div className="rounded-xl border border-custom-border-200 bg-custom-background-100 p-4 shadow-sm">
              <div className="text-xs text-custom-text-400 uppercase">Approuvés TTC</div>
              <div className="text-2xl font-bold text-custom-text-100 mt-1">{formatMoney(stats.total_approuve_ttc)}</div>
            </div>
            <div className="rounded-xl border border-custom-border-200 bg-custom-background-100 p-4 shadow-sm">
              <div className="text-xs text-custom-text-400 uppercase">En attente</div>
              <div className="text-2xl font-bold text-orange-500 mt-1">{stats.by_statut?.pending?.count || 0}</div>
            </div>
          </div>
        )}

        {/* Devis table */}
        <div className="rounded-xl border border-custom-border-200 bg-custom-background-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-custom-border-200 bg-custom-background-90/50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-custom-text-400 uppercase">Référence</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-custom-text-400 uppercase">Nom</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-custom-text-400 uppercase">Fournisseur</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-custom-text-400 uppercase">Montant TTC</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-custom-text-400 uppercase">Statut</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-custom-text-400 uppercase">Date</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-custom-text-400">Chargement...</td></tr>
              ) : devisList.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-custom-text-400">
                  Aucun devis. Les devis seront créés ici.
                </td></tr>
              ) : (
                devisList.map((d) => (
                  <tr key={d.id} className="border-b border-custom-border-100 hover:bg-custom-background-90/30 cursor-pointer">
                    <td className="px-4 py-3 font-mono text-xs text-[#BF5D48]">{d.reference}</td>
                    <td className="px-4 py-3 text-custom-text-200">{d.nom}</td>
                    <td className="px-4 py-3 text-custom-text-300">{d.fournisseur_nom || "—"}</td>
                    <td className="px-4 py-3 text-right font-medium text-custom-text-100">{formatMoney(d.montant_ttc)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUT_COLORS[d.statut] || ""}`}>
                        {d.statut_display}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-custom-text-400">
                      {d.date_devis ? new Date(d.date_devis).toLocaleDateString("fr-FR") : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
