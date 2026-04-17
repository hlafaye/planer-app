// Planer custom: Configurateur AO — Layout with sidebar navigation
"use client";
import { observer } from "mobx-react";
import { Outlet, useParams, useLocation, Link } from "react-router";
import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { Button } from "@plane/propel/button";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { AppSidebarToggleButton } from "@/components/sidebar/sidebar-toggle-button";
import { useAppTheme } from "@/hooks/store/use-app-theme";

// ─── Types ───────────────────────────────────────────────────────────────────

type PointDeVente = {
  id: string; type_pdv: string; type_pdv_display: string; nom: string;
  tranche_frequentation: number; couverts_jour_cible: number; jours_ouvres_mois: number;
};

type ProjetAO = {
  id: string; nom: string; client: string; localisation: string;
  date_remise: string | null; date_ouverture_visee: string | null;
  nature: string; perimetre: string; mode_gestion: string; horaires_service: string;
  scoring_concept_pct: number; scoring_rh_pct: number; scoring_qualite_pct: number;
  scoring_rse_pct: number; scoring_prix_pct: number;
  statut: string; statut_display: string; points_de_vente: PointDeVente[];
  cctp_pdf: string | null;
  duree_contrat_annees: number; pct_frais_siege: number; pct_produits_achats: number;
  remise_commerciale_pct: number; semaines_par_an: number;
  created_at: string; updated_at: string;
};

// ─── Context ─────────────────────────────────────────────────────────────────

type ProjetAOCtx = {
  projet: ProjetAO;
  apiBase: string;
  mutate: () => void;
};

const ProjetAOContext = createContext<ProjetAOCtx | null>(null);
export const useProjetAO = () => {
  const ctx = useContext(ProjetAOContext);
  if (!ctx) throw new Error("useProjetAO must be inside ProjetAOProvider");
  return ctx;
};

// ─── Status stepper ──────────────────────────────────────────────────────────

const STEPS = [
  { key: "draft", label: "Brouillon" },
  { key: "en_cours", label: "En cours" },
  { key: "fige", label: "Fige" },
  { key: "remis", label: "Remis" },
  { key: "gagne", label: "Gagne" },
];

// ─── Layout ──────────────────────────────────────────────────────────────────

function ConfigurateurAOLayout() {
  const { workspaceSlug, projetId } = useParams<{ workspaceSlug: string; projetId: string }>();
  const { sidebarCollapsed } = useAppTheme();
  const location = useLocation();
  const [projet, setProjet] = useState<ProjetAO | null>(null);
  const [loading, setLoading] = useState(true);
  const [scenarioCount, setScenarioCount] = useState(0);

  const apiBase = `/api/v1/workspaces/${workspaceSlug}/configurateur`;

  const fetchProjet = useCallback(async () => {
    try {
      const resp = await fetch(`${apiBase}/projets/${projetId}/`, { credentials: "include" });
      if (resp.ok) setProjet(await resp.json());
    } catch (err) {
      console.error("Fetch projet:", err);
    } finally {
      setLoading(false);
    }
  }, [apiBase, projetId]);

  useEffect(() => { fetchProjet(); }, [fetchProjet]);

  useEffect(() => {
    fetch(`${apiBase}/projets/${projetId}/scenarios/`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setScenarioCount((Array.isArray(d) ? d : d.results || []).length))
      .catch(() => {});
  }, [apiBase, projetId]);

  const changeStatut = async (statut: string) => {
    const resp = await fetch(`${apiBase}/projets/${projetId}/change-statut/`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify({ statut }),
    });
    if (resp.ok) {
      setProjet(await resp.json());
      setToast({ type: TOAST_TYPE.SUCCESS, title: "Statut mis a jour" });
    }
  };

  if (loading) return <div className="h-full flex items-center justify-center text-tertiary text-sm">Chargement...</div>;
  if (!projet) return (
    <div className="h-full flex items-center justify-center">
      <p className="text-tertiary text-sm">Projet introuvable</p>
    </div>
  );

  const basePath = `/${workspaceSlug}/configurateur/${projetId}`;
  const currentPath = location.pathname;
  const activeSection = currentPath.split("/").pop() || "vue-ensemble";

  const sections = [
    {
      title: "Projet",
      items: [
        { href: "vue-ensemble", icon: "\uD83D\uDCCB", label: "Parametrage" },
        { href: "points-de-vente", icon: "\uD83C\uDF7D\uFE0F", label: "Points de Vente", badge: projet.points_de_vente.length },
        { href: "comparateur", icon: "\uD83D\uDD00", label: "Comparateur", badge: scenarioCount },
      ],
    },
    {
      title: "Modules",
      items: [
        { href: "referentiels", icon: "\uD83D\uDCCA", label: "Referentiels" },
        { href: "simulation", icon: "\uD83D\uDCC8", label: "Synthese P&L" },
      ],
    },
    {
      title: "Generation",
      items: [
        { href: "documents", icon: "\uD83D\uDCC4", label: "Documents" },
        { href: "configuration", icon: "\uD83C\uDFAF", label: "Scoring AO" },
      ],
    },
  ];

  // Stepper
  const stepIdx = STEPS.findIndex((s) => s.key === projet.statut);

  // Progress
  const checks = [
    !!(projet.nom && projet.client),
    projet.points_de_vente.length > 0,
    !!projet.mode_gestion,
    projet.scoring_prix_pct > 0,
    scenarioCount > 0,
  ];
  const pct = Math.round((checks.filter(Boolean).length / checks.length) * 100);

  return (
    <ProjetAOContext.Provider value={{ projet, apiBase, mutate: fetchProjet }}>
      <div className="h-full flex">
        {/* ── Sidebar interne ── */}
        <aside className="w-52 flex-shrink-0 border-r border-border-subtle bg-layer-1 flex flex-col">
          <div className="p-3 border-b border-border-subtle">
            <Link to={`/${workspaceSlug}/configurateur`} className="text-xs text-tertiary hover:text-secondary no-underline flex items-center gap-1 mb-2">
              &larr; Liste AO
            </Link>
            <div className="text-[10px] uppercase tracking-widest font-bold text-accent-primary">Configurateur AO</div>
          </div>
          <nav className="flex-1 overflow-y-auto p-2 space-y-3">
            {sections.map((sec) => (
              <div key={sec.title}>
                <div className="text-[9px] uppercase tracking-widest text-tertiary font-semibold mb-1.5 px-2">{sec.title}</div>
                {sec.items.map((item) => {
                  const active = activeSection === item.href;
                  return (
                    <Link
                      key={item.href}
                      to={`${basePath}/${item.href}`}
                      className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-sm no-underline transition-colors ${
                        active ? "bg-accent-primary/10 text-accent-primary font-medium" : "text-secondary hover:bg-layer-transparent-hover"
                      }`}
                    >
                      <span className="text-sm w-5 text-center">{item.icon}</span>
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.badge != null && item.badge > 0 && (
                        <span className="text-[10px] bg-accent-primary/20 text-accent-primary px-1.5 rounded-full font-bold">{item.badge}</span>
                      )}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>
          <div className="p-3 border-t border-border-subtle">
            <div className="text-sm font-semibold text-primary truncate">{projet.nom}</div>
            <div className="text-xs text-tertiary truncate">{projet.client}{projet.localisation ? ` \u00B7 ${projet.localisation}` : ""}</div>
          </div>
        </aside>

        {/* ── Content ── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Topbar */}
          <div className="flex items-center justify-between px-5 py-2.5 border-b border-border-subtle bg-surface-1 shrink-0">
            <div className="flex items-center gap-3">
              {sidebarCollapsed && <AppSidebarToggleButton />}
              <h1 className="text-sm font-semibold text-primary">{projet.nom}</h1>
              {/* Stepper inline */}
              <div className="flex items-center gap-1 ml-2">
                {STEPS.map((step, i) => (
                  <button
                    key={step.key}
                    onClick={() => changeStatut(step.key)}
                    className={`px-2 py-0.5 rounded-full text-[11px] font-medium transition-all ${
                      i < stepIdx ? "bg-accent-primary/10 text-accent-primary"
                        : i === stepIdx ? "bg-accent-primary text-on-color"
                          : "bg-layer-3 text-tertiary hover:bg-layer-transparent-hover"
                    }`}
                  >
                    {step.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={async () => {
                const r = await fetch(`${apiBase}/projets/${projetId}/dupliquer/`, { method: "POST", credentials: "include" });
                if (r.ok) { const d = await r.json(); setToast({ type: TOAST_TYPE.SUCCESS, title: "Duplique" }); window.location.assign(`/${workspaceSlug}/configurateur/${d.id}/vue-ensemble`); }
              }}>Dupliquer</Button>
            </div>
          </div>

          {/* Page content */}
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-5xl mx-auto px-6 py-5">
              <Outlet />
            </div>
          </div>

          {/* Progress bar */}
          <div className="px-5 py-1.5 border-t border-border-subtle bg-layer-1 flex items-center gap-3 shrink-0">
            <span className="text-[10px] text-tertiary uppercase tracking-wider">Completion</span>
            <div className="flex-1 h-1 bg-layer-3 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500 bg-accent-primary" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs font-semibold text-accent-primary">{pct}%</span>
          </div>
        </div>
      </div>
    </ProjetAOContext.Provider>
  );
}

export default observer(ConfigurateurAOLayout);
