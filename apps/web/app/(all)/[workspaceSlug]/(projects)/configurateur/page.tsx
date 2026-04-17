// Planer custom: Configurateur AO — list page
"use client";

import { useParams } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { AppSidebarToggleButton } from "@/components/sidebar/sidebar-toggle-button";
import { useAppTheme } from "@/hooks/store/use-app-theme";

type ProjetAO = {
  id: string;
  nom: string;
  client: string;
  nature: string;
  nature_display: string;
  mode_gestion: string;
  statut: string;
  statut_display: string;
  date_remise: string | null;
  pdv_count: number;
  created_at: string;
};

const STATUT_COLORS: Record<string, string> = {
  draft: "bg-gray-500/10 text-gray-400",
  en_cours: "bg-blue-500/10 text-blue-400",
  fige: "bg-purple-500/10 text-purple-400",
  remis: "bg-orange-500/10 text-orange-400",
  gagne: "bg-emerald-500/10 text-emerald-400",
  perdu: "bg-red-500/10 text-red-400",
};

export default function ConfigurateurAOPage() {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const { sidebarCollapsed } = useAppTheme();
  const [projets, setProjets] = useState<ProjetAO[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [listResp, statsResp] = await Promise.all([
        fetch(`/api/v1/workspaces/${workspaceSlug}/configurateur/projets/`, { credentials: "include" }),
        fetch(`/api/v1/workspaces/${workspaceSlug}/configurateur/stats/`, { credentials: "include" }),
      ]);
      if (listResp.ok) {
        const data = await listResp.json();
        setProjets(Array.isArray(data) ? data : data.results || []);
      }
      if (statsResp.ok) setStats(await statsResp.json());
    } catch (err) {
      console.error("AO fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [workspaceSlug]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto p-6">
        {sidebarCollapsed && <div className="mb-3"><AppSidebarToggleButton /></div>}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-lg font-bold text-custom-text-100">🎯 Configurateur AO</h1>
            <p className="text-xs text-custom-text-400 mt-0.5">Création et gestion des appels d'offres</p>
          </div>
          <a
            href={`/${workspaceSlug}/configurateur/nouveau`}
            className="px-4 py-2 rounded-lg bg-[#BF5D48] text-white text-sm font-medium hover:bg-[#a84d3b] shadow-sm no-underline"
          >
            + Nouveau projet AO
          </a>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <div className="rounded-xl border border-custom-border-200 bg-custom-background-100 p-4 shadow-sm">
              <div className="text-xs text-custom-text-400 uppercase">En cours</div>
              <div className="text-2xl font-bold text-blue-400 mt-1">{stats.en_cours}</div>
            </div>
            <div className="rounded-xl border border-custom-border-200 bg-custom-background-100 p-4 shadow-sm">
              <div className="text-xs text-custom-text-400 uppercase">Remis</div>
              <div className="text-2xl font-bold text-orange-400 mt-1">{stats.remis}</div>
            </div>
            <div className="rounded-xl border border-custom-border-200 bg-custom-background-100 p-4 shadow-sm">
              <div className="text-xs text-custom-text-400 uppercase">Gagnés</div>
              <div className="text-2xl font-bold text-emerald-400 mt-1">{stats.gagnes}</div>
            </div>
            <div className="rounded-xl border border-custom-border-200 bg-custom-background-100 p-4 shadow-sm">
              <div className="text-xs text-custom-text-400 uppercase">Brouillons</div>
              <div className="text-2xl font-bold text-custom-text-200 mt-1">{stats.brouillons}</div>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="rounded-xl border border-custom-border-200 bg-custom-background-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-custom-border-200" style={{ backgroundColor: "rgba(90,85,82,0.1)" }}>
                <th className="text-left px-4 py-3 text-[10px] font-semibold text-custom-text-400 uppercase">Projet</th>
                <th className="text-left px-4 py-3 text-[10px] font-semibold text-custom-text-400 uppercase">Client</th>
                <th className="text-left px-4 py-3 text-[10px] font-semibold text-custom-text-400 uppercase">Nature</th>
                <th className="text-left px-4 py-3 text-[10px] font-semibold text-custom-text-400 uppercase">PdV</th>
                <th className="text-left px-4 py-3 text-[10px] font-semibold text-custom-text-400 uppercase">Statut</th>
                <th className="text-left px-4 py-3 text-[10px] font-semibold text-custom-text-400 uppercase">Date remise</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-custom-text-400">Chargement...</td></tr>
              ) : projets.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center">
                  <span className="text-3xl block mb-2">🎯</span>
                  <p className="text-sm text-custom-text-400">Aucun projet AO</p>
                  <p className="text-xs text-custom-text-400 mt-1">Créez votre premier appel d'offres</p>
                </td></tr>
              ) : (
                projets.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-custom-border-100 hover:bg-custom-background-90/30 cursor-pointer"
                    onClick={() => window.location.assign(`/${workspaceSlug}/configurateur/${p.id}`)}
                  >
                    <td className="px-4 py-3 font-medium text-custom-text-100">{p.nom}</td>
                    <td className="px-4 py-3 text-custom-text-300">{p.client}</td>
                    <td className="px-4 py-3 text-xs text-custom-text-400">{p.nature_display}</td>
                    <td className="px-4 py-3 text-xs text-custom-text-400">{p.pdv_count} PdV</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUT_COLORS[p.statut] || ""}`}>{p.statut_display}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-custom-text-400">{p.date_remise ? new Date(p.date_remise).toLocaleDateString("fr-FR") : "—"}</td>
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
