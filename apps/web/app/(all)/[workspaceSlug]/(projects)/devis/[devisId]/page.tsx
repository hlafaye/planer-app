// Planer custom: Devis detail page
"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";

const STATUT_STYLES: Record<string, { bg: string; text: string }> = {
  draft: { bg: "bg-gray-500/10", text: "text-gray-400" },
  pending: { bg: "bg-orange-500/10", text: "text-orange-400" },
  approved: { bg: "bg-emerald-500/10", text: "text-emerald-400" },
  rejected: { bg: "bg-red-500/10", text: "text-red-400" },
  modif_requested: { bg: "bg-yellow-500/10", text: "text-yellow-400" },
  ordered: { bg: "bg-blue-500/10", text: "text-blue-400" },
  delivered: { bg: "bg-emerald-500/10", text: "text-emerald-400" },
  invoiced: { bg: "bg-purple-500/10", text: "text-purple-400" },
};

const TYPE_ICONS: Record<string, string> = { fournisseur: "📦", sous_traitant: "🔧", personnel: "👥", client: "💼" };

const ACTION_ICONS: Record<string, string> = {
  submit: "📤", approve: "✅", reject: "❌", request_modif: "✏️", resubmit: "🔄", delegate: "➡️",
};

export default function DevisDetailPage() {
  const { workspaceSlug, devisId } = useParams<{ workspaceSlug: string; devisId: string }>();
  const router = useRouter();
  const [devis, setDevis] = useState<any>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionComment, setActionComment] = useState("");
  const [actioning, setActioning] = useState(false);

  // Fetch project
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

  // Fetch devis detail
  const fetchDevis = useCallback(async () => {
    if (!projectId || !devisId) return;
    setLoading(true);
    try {
      const resp = await fetch(
        `/api/v1/workspaces/${workspaceSlug}/projects/${projectId}/devis/${devisId}/`,
        { credentials: "include" }
      );
      if (resp.ok) setDevis(await resp.json());
    } catch (err) {
      console.error("Fetch devis error:", err);
    } finally {
      setLoading(false);
    }
  }, [workspaceSlug, projectId, devisId]);

  useEffect(() => { fetchDevis(); }, [fetchDevis]);

  const handleAction = async (action: string) => {
    if (!projectId) return;
    setActioning(true);
    try {
      const resp = await fetch(
        `/api/v1/workspaces/${workspaceSlug}/projects/${projectId}/devis/${devisId}/action/`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ action, comment: actionComment }),
        }
      );
      if (resp.ok) {
        setActionComment("");
        fetchDevis();
      }
    } catch (err) {
      console.error("Action error:", err);
    } finally {
      setActioning(false);
    }
  };

  const formatMoney = (n: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);
  const formatDate = (d: string) => d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "—";
  const formatDateTime = (d: string) => d ? new Date(d).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "";

  if (loading || !devis) {
    return <div className="flex items-center justify-center h-full text-custom-text-400"><span className="animate-pulse">Chargement...</span></div>;
  }

  const s = STATUT_STYLES[devis.statut] || STATUT_STYLES.draft;

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <button onClick={() => router.push(`/${workspaceSlug}/devis`)} className="text-xs text-custom-text-400 hover:text-custom-text-200 mb-2">
          ← Retour aux devis
        </button>

        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="font-mono text-sm text-[#BF5D48] font-medium">{devis.reference}</span>
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${s.bg} ${s.text}`}>{devis.statut_display}</span>
            </div>
            <h1 className="text-lg font-bold text-custom-text-100">{devis.nom}</h1>
            <div className="flex items-center gap-3 mt-1 text-xs text-custom-text-400">
              <span>{TYPE_ICONS[devis.type_devis] || ""} {devis.type_display}</span>
              {devis.fournisseur_nom && <span>· 🏢 {devis.fournisseur_nom}</span>}
              <span>· 💶 {formatMoney(devis.montant_ht)} HT</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {devis.statut === "draft" && (
              <button onClick={() => handleAction("submit")} disabled={actioning} className="px-3 py-1.5 rounded-lg bg-[#BF5D48] text-white text-xs font-medium hover:bg-[#a84d3b] disabled:opacity-50">
                Envoyer en validation →
              </button>
            )}
            {devis.statut === "pending" && (
              <>
                <button onClick={() => handleAction("approve")} disabled={actioning} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 disabled:opacity-50">
                  ✓ Approuver
                </button>
                <button onClick={() => handleAction("request_modif")} disabled={actioning} className="px-3 py-1.5 rounded-lg border border-custom-border-200 text-xs text-custom-text-300 hover:bg-custom-background-90 disabled:opacity-50">
                  Modifier
                </button>
                <button onClick={() => handleAction("reject")} disabled={actioning} className="px-3 py-1.5 rounded-lg border border-red-500/30 text-xs text-red-400 hover:bg-red-500/10 disabled:opacity-50">
                  Rejeter
                </button>
              </>
            )}
            {(devis.statut === "rejected" || devis.statut === "modif_requested") && (
              <button onClick={() => handleAction("resubmit")} disabled={actioning} className="px-3 py-1.5 rounded-lg bg-[#BF5D48] text-white text-xs font-medium hover:bg-[#a84d3b] disabled:opacity-50">
                🔄 Resoumettre
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Informations */}
          <div className="rounded-xl border border-custom-border-200 bg-custom-background-100 p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-custom-text-100 mb-4">Informations</h3>
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between"><span className="text-custom-text-400">Fournisseur</span><span className="text-custom-text-100">{devis.fournisseur_nom || "—"}</span></div>
              <div className="flex justify-between"><span className="text-custom-text-400">Type</span><span className="text-custom-text-100">{devis.type_display}</span></div>
              <div className="flex justify-between"><span className="text-custom-text-400">Catégorie</span><span className="text-custom-text-100">{devis.categorie || "—"}</span></div>
              <div className="flex justify-between"><span className="text-custom-text-400">Module</span><span className="text-custom-text-100">{devis.module_name || "—"}</span></div>
              <div className="flex justify-between"><span className="text-custom-text-400">Poste budget</span><span className="text-custom-text-100">{devis.poste_budget || "—"}</span></div>
              <div className="flex justify-between"><span className="text-custom-text-400">Date devis</span><span className="text-custom-text-100">{formatDate(devis.date_devis)}</span></div>
              {devis.date_livraison_prevue && <div className="flex justify-between"><span className="text-custom-text-400">Livraison prévue</span><span className="text-custom-text-100">{formatDate(devis.date_livraison_prevue)}</span></div>}
              {devis.description && <div className="pt-2 border-t border-custom-border-100"><p className="text-xs text-custom-text-300">{devis.description}</p></div>}
            </div>
          </div>

          {/* Montants */}
          <div className="rounded-xl border border-custom-border-200 bg-custom-background-100 p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-custom-text-100 mb-4">💶 Montants</h3>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-custom-text-400">Montant HT</span>
                <span className="font-mono font-medium text-custom-text-100">{formatMoney(devis.montant_ht)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-custom-text-400">TVA ({devis.tva_taux}%)</span>
                <span className="font-mono text-custom-text-300">{formatMoney(devis.tva_montant)}</span>
              </div>
              <div className="flex justify-between text-sm pt-2 border-t border-custom-border-100">
                <span className="text-custom-text-100 font-semibold">Montant TTC</span>
                <span className="font-mono font-bold text-lg text-custom-text-100">{formatMoney(devis.montant_ttc)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* PDF Preview */}
        {devis.pdf_original && (
          <div className="rounded-xl border border-custom-border-200 bg-custom-background-100 p-5 shadow-sm mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-custom-text-100">📄 Pièce jointe</h3>
              <a href={devis.pdf_original} download className="text-xs text-[#BF5D48] hover:underline">⬇ Télécharger</a>
            </div>
            <iframe src={devis.pdf_original} title="PDF devis" className="w-full rounded-lg border border-custom-border-100" style={{ height: 400 }} />
          </div>
        )}

        {/* Action comment */}
        {(devis.statut === "pending" || devis.statut === "draft") && (
          <div className="rounded-xl border border-custom-border-200 bg-custom-background-100 p-4 shadow-sm mb-6">
            <label className="text-xs text-custom-text-400 mb-1.5 block">Commentaire (optionnel)</label>
            <textarea
              value={actionComment}
              onChange={(e) => setActionComment(e.target.value)}
              placeholder="Ajouter un commentaire à votre action..."
              rows={2}
              className="w-full rounded-lg border border-custom-border-200 bg-custom-background-100 px-3 py-2 text-sm text-custom-text-100 placeholder:text-custom-text-400 focus:border-[#BF5D48] focus:outline-none"
            />
          </div>
        )}

        {/* History */}
        {devis.actions && devis.actions.length > 0 && (
          <div className="rounded-xl border border-custom-border-200 bg-custom-background-100 p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-custom-text-100 mb-4">🕐 Historique</h3>
            <div className="space-y-3">
              {devis.actions.map((a: any, i: number) => (
                <div key={a.id || i} className="flex items-start gap-3">
                  <span className="text-sm mt-0.5">{ACTION_ICONS[a.action] || "•"}</span>
                  <div className="flex-1">
                    <div className="text-sm">
                      <span className="font-medium text-custom-text-100">{a.from_user_name}</span>
                      <span className="text-custom-text-400"> — {a.action}</span>
                    </div>
                    {a.comment && <p className="text-xs text-custom-text-300 mt-0.5 italic">"{a.comment}"</p>}
                    <span className="text-[10px] text-custom-text-400">{formatDateTime(a.created_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Created info */}
        <div className="mt-4 text-xs text-custom-text-400 text-center">
          Créé le {formatDate(devis.created_at)}
        </div>
      </div>
    </div>
  );
}
