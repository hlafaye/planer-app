// Planer custom: Configurateur AO — detail page (polished EMPREINTES design)
"use client";

import { useParams } from "next/navigation";
import { useState, useEffect, useCallback, useRef } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

type PointDeVente = {
  id: string;
  type_pdv: string;
  type_pdv_display: string;
  nom: string;
  tranche_frequentation: number;
  couverts_jour_cible: number;
  jours_ouvres_mois: number;
};

type ProjetAO = {
  id: string;
  nom: string;
  client: string;
  localisation: string;
  date_remise: string | null;
  date_ouverture_visee: string | null;
  nature: string;
  perimetre: string;
  mode_gestion: string;
  horaires_service: string;
  scoring_concept_pct: number;
  scoring_rh_pct: number;
  scoring_qualite_pct: number;
  scoring_rse_pct: number;
  scoring_prix_pct: number;
  statut: string;
  statut_display: string;
  points_de_vente: PointDeVente[];
  cctp_pdf: string | null;
  created_at: string;
  updated_at: string;
};

// ─── Design Tokens (EMPREINTES) ──────────────────────────────────────────────

const C = {
  terracotta: "#BF5D48",
  terracottaHover: "#a84d3b",
  terracottaBg: "rgba(191,93,72,0.10)",
  terracottaGlow: "rgba(191,93,72,0.20)",
  chlorophyle: "#385835",
  chlorophyleBg: "rgba(56,88,53,0.15)",
  sauge: "#929F88",
  saugeBg: "rgba(146,159,136,0.15)",
  nude: "#C4A882",
  nudeBg: "rgba(196,168,130,0.15)",
  charbon: "#3A3632",
  charbonBg: "rgba(58,54,50,0.25)",
};

// ─── Constants ───────────────────────────────────────────────────────────────

const STEPS = [
  { key: "draft", label: "Brouillon", icon: "\u270F\uFE0F" },
  { key: "en_cours", label: "En cours", icon: "\u2699\uFE0F" },
  { key: "fige", label: "Fige", icon: "\uD83D\uDD12" },
  { key: "remis", label: "Remis", icon: "\uD83D\uDCEC" },
  { key: "gagne", label: "Gagne", icon: "\uD83C\uDFC6" },
];

const PDV_ICONS: Record<string, string> = {
  self: "\uD83C\uDF71", cafeteria: "\u2615", brasserie: "\uD83E\uDD69",
  room_service: "\uD83D\uDECE\uFE0F", club_vip: "\uD83E\uDD42",
  da: "\uD83E\uDD16", dflab: "\uD83D\uDD2C",
};

const PDV_LABELS: Record<string, string> = {
  self: "Self-Service", cafeteria: "Cafeteria", brasserie: "Brasserie",
  room_service: "Room Service", club_vip: "Club VIP",
  da: "Distributeur Auto", dflab: "Digital Food Lab",
};

const NATURES: Record<string, string> = {
  ouverture: "Ouverture", reprise: "Reprise", renouvellement: "Renouvellement",
};

const MODES = [
  { id: "masse_frais", icon: "\uD83D\uDCBC", name: "Masse de Frais", desc: "Charges salariales et FG facturees mensuellement au client. Convives paient au prix BPU.", tip: "Le plus courant en restauration d'entreprise" },
  { id: "admission", icon: "\uD83C\uDFAB", name: "Admission / Subvention", desc: "Prix convive fixe. Employeur subventionne ses salaries. Part alimentaire optionnelle.", tip: "Site avec politique de subvention claire" },
  { id: "mixte", icon: "\u2696\uFE0F", name: "Mixte", desc: "Masse de frais pour les charges fixes + admissions pour les exterieurs.", tip: "Projets complexes avec convives mixtes" },
  { id: "ticket", icon: "\uD83C\uDF7D\uFE0F", name: "Tout sur le ticket", desc: "Restauration commerciale classique. Le convive paie tout.", tip: "Restaurants grand public" },
  { id: "custom", icon: "\u2699\uFE0F", name: "Autre / Custom", desc: "Mode hybride ou specifique. Parametrage libre.", tip: "Cas atypiques" },
];

const HORAIRES: Record<string, string> = {
  midi: "Midi", midi_soir: "Midi + Soir", continu: "Continu", pdj_midi: "Petit-dej + Midi",
};

const SCORE_FIELDS = [
  { key: "scoring_prix_pct" as const, label: "Prix", icon: "\uD83D\uDCB0", color: C.terracotta, bg: C.terracottaBg },
  { key: "scoring_concept_pct" as const, label: "Concept", icon: "\uD83D\uDCA1", color: C.nude, bg: C.nudeBg },
  { key: "scoring_rh_pct" as const, label: "RH & Organisation", icon: "\uD83D\uDC65", color: C.chlorophyle, bg: C.chlorophyleBg },
  { key: "scoring_rse_pct" as const, label: "RSE / DD", icon: "\u267B\uFE0F", color: C.sauge, bg: C.saugeBg },
  { key: "scoring_qualite_pct" as const, label: "Qualite & HSQE", icon: "\u2705", color: C.charbon, bg: C.charbonBg },
];

// ─── Toast ───────────────────────────────────────────────────────────────────

function useToast() {
  const [msg, setMsg] = useState<{ text: string; type: "ok" | "err" } | null>(null);
  const show = (text: string, type: "ok" | "err" = "ok") => {
    setMsg({ text, type });
    setTimeout(() => setMsg(null), 2500);
  };
  const Toast = msg ? (
    <div
      className="fixed bottom-6 right-6 z-[9999] px-4 py-2.5 rounded-xl text-sm font-medium shadow-lg animate-[slideUp_0.3s_ease]"
      style={{
        background: msg.type === "ok" ? C.chlorophyle : C.terracotta,
        color: "white",
      }}
    >
      {msg.type === "ok" ? "\u2713 " : "\u2717 "}{msg.text}
    </div>
  ) : null;
  return { show, Toast };
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function ProjetAODetailPage() {
  const { workspaceSlug, projetId } = useParams<{ workspaceSlug: string; projetId: string }>();
  const [projet, setProjet] = useState<ProjetAO | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("general");
  const [menuOpen, setMenuOpen] = useState(false);
  const toast = useToast();

  const apiBase = `/api/v1/workspaces/${workspaceSlug}/configurateur`;

  const fetchProjet = useCallback(async () => {
    try {
      const resp = await fetch(`${apiBase}/projets/${projetId}/`, { credentials: "include" });
      if (resp.ok) setProjet(await resp.json());
    } catch (err) {
      console.error("Fetch projet error:", err);
    } finally {
      setLoading(false);
    }
  }, [apiBase, projetId]);

  useEffect(() => { fetchProjet(); }, [fetchProjet]);

  const changeStatut = async (statut: string) => {
    const resp = await fetch(`${apiBase}/projets/${projetId}/change-statut/`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ statut }),
    });
    if (resp.ok) {
      setProjet(await resp.json());
      toast.show("Statut mis a jour");
    } else {
      toast.show("Erreur changement de statut", "err");
    }
  };

  const dupliquer = async () => {
    const resp = await fetch(`${apiBase}/projets/${projetId}/dupliquer/`, {
      method: "POST", credentials: "include",
    });
    if (resp.ok) {
      const data = await resp.json();
      toast.show("Projet duplique");
      setTimeout(() => window.location.assign(`/${workspaceSlug}/configurateur/${data.id}`), 600);
    } else {
      toast.show("Erreur duplication", "err");
    }
  };

  const supprimer = async () => {
    if (!confirm("Supprimer ce projet AO ? Cette action est irreversible.")) return;
    const resp = await fetch(`${apiBase}/projets/${projetId}/`, { method: "DELETE", credentials: "include" });
    if (resp.ok) window.location.assign(`/${workspaceSlug}/configurateur`);
    else toast.show("Erreur suppression", "err");
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-custom-text-400 text-sm">Chargement...</div>
      </div>
    );
  }

  if (!projet) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <p className="text-custom-text-400 text-sm">Projet introuvable</p>
          <a href={`/${workspaceSlug}/configurateur`} className="text-sm mt-2 inline-block no-underline" style={{ color: C.terracotta }}>
            &larr; Retour a la liste
          </a>
        </div>
      </div>
    );
  }

  const tabs = [
    { key: "general", label: "General", icon: "\uD83D\uDCCB" },
    { key: "pdv", label: `Points de Vente (${projet.points_de_vente.length})`, icon: "\uD83C\uDFE2" },
    { key: "gestion", label: "Mode de gestion", icon: "\uD83D\uDCCA" },
    { key: "scoring", label: "Scoring CCTP", icon: "\uD83C\uDFAF" },
    { key: "scenarios", label: "Scenarios & Simulation", icon: "\u2728" },
    { key: "docs", label: "Documents", icon: "\uD83D\uDCC4" },
    { key: "generation", label: "Generation", icon: "\uD83D\uDCE6" },
  ];

  const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : null;

  return (
    <div className="h-full overflow-y-auto">
      {toast.Toast}

      <style>{`
        @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        input[type="range"] { -webkit-appearance: none; height: 8px; border-radius: 4px; background: rgba(90,85,82,0.2); outline: none; }
        input[type="range"]::-webkit-slider-thumb { -webkit-appearance: none; width: 22px; height: 22px; border-radius: 50%; cursor: pointer; border: 2px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.25); }
      `}</style>

      <div className="max-w-5xl mx-auto px-6 py-5">
        {/* ── Header ── */}
        <div className="flex items-start justify-between pb-5 mb-2 border-b border-custom-border-200">
          <div>
            <a
              href={`/${workspaceSlug}/configurateur`}
              className="text-custom-text-400 hover:text-custom-text-200 text-xs no-underline inline-flex items-center gap-1 mb-3"
            >
              &larr; Retour a la liste
            </a>
            <div
              className="inline-block text-[10px] font-bold tracking-[2px] uppercase px-2.5 py-1 rounded-full mb-2"
              style={{ color: C.terracotta, background: C.terracottaBg }}
            >
              CONFIGURATEUR AO
            </div>
            <h1 className="text-2xl font-bold text-custom-text-100 mb-1.5">
              AO <span style={{ color: C.terracotta }}>{projet.client.toUpperCase()}</span>
            </h1>
            <div className="flex items-center gap-2 text-sm text-custom-text-400 flex-wrap">
              {projet.localisation && <span>📍 {projet.localisation.toUpperCase()}</span>}
              {projet.localisation && <span className="opacity-30">·</span>}
              {projet.date_remise && <span>📅 Remise le {formatDate(projet.date_remise)}</span>}
              {projet.date_remise && <span className="opacity-30">·</span>}
              <span>🏢 {projet.client}</span>
              <span className="opacity-30">·</span>
              <span>🍽️ {projet.points_de_vente.length} Points de vente</span>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-6 relative">
            <button
              onClick={dupliquer}
              className="px-3 py-1.5 rounded-lg border border-custom-border-200 text-custom-text-200 text-sm hover:bg-custom-background-90/50 flex items-center gap-1.5"
            >
              📋 Dupliquer
            </button>
            <div className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="px-2.5 py-1.5 rounded-lg border border-custom-border-200 text-custom-text-200 text-sm hover:bg-custom-background-90/50"
              >
                &#8942;
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-full mt-1 w-48 rounded-xl border border-custom-border-200 bg-custom-background-100 shadow-xl z-50 overflow-hidden">
                  <button
                    onClick={() => { changeStatut("perdu"); setMenuOpen(false); }}
                    className="w-full text-left px-4 py-2.5 text-sm text-custom-text-200 hover:bg-custom-background-90/50"
                  >
                    💀 Marquer Perdu
                  </button>
                  <button
                    onClick={() => { supprimer(); setMenuOpen(false); }}
                    className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10"
                  >
                    🗑️ Supprimer
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Status Stepper ── */}
        <StatusStepper current={projet.statut} onChange={changeStatut} />

        {/* ── Tabs ── */}
        <div className="flex gap-1 mb-6 border-b border-custom-border-200">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-all flex items-center gap-1.5 ${
                activeTab === tab.key
                  ? "text-custom-text-100"
                  : "border-transparent text-custom-text-400 hover:text-custom-text-200"
              }`}
              style={activeTab === tab.key ? { borderBottomColor: C.terracotta } : {}}
            >
              <span className="text-base">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Tab Content ── */}
        {activeTab === "general" && <TabGeneral projet={projet} apiBase={apiBase} onSave={fetchProjet} toast={toast} />}
        {activeTab === "pdv" && <TabPointsDeVente projet={projet} apiBase={apiBase} onSave={fetchProjet} toast={toast} />}
        {activeTab === "gestion" && <TabModeGestion projet={projet} apiBase={apiBase} onSave={fetchProjet} toast={toast} />}
        {activeTab === "scoring" && <TabScoring projet={projet} apiBase={apiBase} onSave={fetchProjet} toast={toast} />}
        {activeTab === "scenarios" && <TabScenarios projet={projet} apiBase={apiBase} toast={toast} />}
        {activeTab === "docs" && <TabDocuments projet={projet} apiBase={apiBase} onSave={fetchProjet} toast={toast} />}
        {activeTab === "generation" && <TabGeneration projet={projet} apiBase={apiBase} toast={toast} />}
      </div>
    </div>
  );
}

// ─── Status Stepper ──────────────────────────────────────────────────────────

function StatusStepper({ current, onChange }: { current: string; onChange: (s: string) => void }) {
  const currentIdx = STEPS.findIndex((s) => s.key === current);

  return (
    <div className="flex items-center py-5 mb-4">
      {STEPS.map((step, i) => {
        const isDone = i < currentIdx;
        const isActive = i === currentIdx;
        const isGagne = step.key === "gagne" && isActive;
        return (
          <div key={step.key} className="flex-1 flex items-center">
            <button
              onClick={() => onChange(step.key)}
              className="flex flex-col items-center gap-1.5 flex-1 group"
            >
              {/* Circle */}
              <div
                className="w-11 h-11 rounded-full flex items-center justify-center text-lg transition-all relative z-10"
                style={{
                  background: isActive
                    ? isGagne ? C.chlorophyle : C.terracotta
                    : isDone ? C.terracottaBg : "rgba(90,85,82,0.08)",
                  border: `2px solid ${isActive ? (isGagne ? C.chlorophyle : C.terracotta) : isDone ? C.terracotta : "rgba(90,85,82,0.15)"}`,
                  boxShadow: isActive
                    ? `0 0 0 4px ${isGagne ? "rgba(56,88,53,0.2)" : C.terracottaGlow}`
                    : "none",
                  transform: isActive ? "scale(1.1)" : "scale(1)",
                }}
              >
                {step.icon}
              </div>
              {/* Label */}
              <span
                className="text-xs transition-all"
                style={{
                  fontWeight: isActive || isDone ? 600 : 400,
                  color: isActive ? (isGagne ? C.chlorophyle : C.terracotta) : isDone ? "var(--color-text-100, #e8e2dc)" : "var(--color-text-400, #7a7672)",
                }}
              >
                {step.label}
              </span>
            </button>
            {/* Connector line */}
            {i < STEPS.length - 1 && (
              <div
                className="h-0.5 flex-1 -mx-2 mt-[-18px]"
                style={{ background: isDone ? C.terracotta : "rgba(90,85,82,0.15)" }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── SaveButton ──────────────────────────────────────────────────────────────

type ToastHandle = { show: (text: string, type?: "ok" | "err") => void };

function SaveButton({ onSave, disabled, toast }: { onSave: () => Promise<void>; disabled?: boolean; toast: ToastHandle }) {
  const [status, setStatus] = useState<"idle" | "saving" | "done">("idle");

  const handleClick = async () => {
    setStatus("saving");
    try {
      await onSave();
      setStatus("done");
      toast.show("Modifications enregistrees");
      setTimeout(() => setStatus("idle"), 1800);
    } catch {
      setStatus("idle");
      toast.show("Erreur sauvegarde", "err");
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled || status === "saving"}
      className="px-5 py-2 rounded-lg text-white text-sm font-medium transition-all disabled:opacity-50 flex items-center gap-2"
      style={{
        background: status === "done" ? C.chlorophyle : C.terracotta,
      }}
    >
      {status === "saving" && (
        <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      )}
      {status === "saving" ? "Enregistrement..." : status === "done" ? "\u2713 Enregistre" : "Enregistrer"}
    </button>
  );
}

// ─── Tab: General ────────────────────────────────────────────────────────────

function TabGeneral({ projet, apiBase, onSave, toast }: { projet: ProjetAO; apiBase: string; onSave: () => void; toast: ToastHandle }) {
  const [form, setForm] = useState({
    nom: projet.nom,
    client: projet.client,
    localisation: projet.localisation || "",
    date_remise: projet.date_remise || "",
    date_ouverture_visee: projet.date_ouverture_visee || "",
    nature: projet.nature,
    perimetre: projet.perimetre,
  });

  const save = async () => {
    const resp = await fetch(`${apiBase}/projets/${projet.id}/`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(form),
    });
    if (resp.ok) await onSave();
    else throw new Error("save failed");
  };

  const update = (key: string, value: string) => setForm((prev) => ({ ...prev, [key]: value }));
  const inputCls = "w-full px-3 py-2.5 rounded-lg border border-custom-border-200 bg-custom-background-90 text-custom-text-100 text-sm focus:outline-none focus:ring-1 transition-shadow";

  return (
    <div className="rounded-xl border border-custom-border-200 bg-custom-background-100 overflow-hidden">
      <div className="px-6 py-4 border-b border-custom-border-200" style={{ background: "rgba(90,85,82,0.04)" }}>
        <h2 className="text-sm font-semibold text-custom-text-100 flex items-center gap-2">📋 Informations generales</h2>
      </div>
      <div className="p-6">
        <div className="grid grid-cols-2 gap-5">
          <Field label="Nom du projet *">
            <input value={form.nom} onChange={(e) => update("nom", e.target.value)} className={inputCls} style={{ focusRingColor: C.terracotta } as any} />
          </Field>
          <Field label="Client *">
            <input value={form.client} onChange={(e) => update("client", e.target.value)} className={inputCls} />
          </Field>
          <Field label="Localisation">
            <input value={form.localisation} onChange={(e) => update("localisation", e.target.value)} placeholder="Ville, region..." className={inputCls} />
          </Field>
          <Field label="Nature de l'AO">
            <select value={form.nature} onChange={(e) => update("nature", e.target.value)} className={inputCls}>
              {Object.entries(NATURES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="Date de remise">
            <input type="date" value={form.date_remise} onChange={(e) => update("date_remise", e.target.value)} className={inputCls} />
          </Field>
          <Field label="Date d'ouverture visee">
            <input type="date" value={form.date_ouverture_visee} onChange={(e) => update("date_ouverture_visee", e.target.value)} className={inputCls} />
          </Field>
        </div>
        <div className="mt-6 flex justify-end">
          <SaveButton onSave={save} toast={toast} />
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Points de Vente ────────────────────────────────────────────────────

function TabPointsDeVente({ projet, apiBase, onSave, toast }: { projet: ProjetAO; apiBase: string; onSave: () => void; toast: ToastHandle }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [adding, setAdding] = useState(false);
  const [newForm, setNewForm] = useState({ type_pdv: "self", nom: "", tranche_frequentation: 1, couverts_jour_cible: 200, jours_ouvres_mois: 20 });

  const savePdv = async (pdvId: string) => {
    const resp = await fetch(`${apiBase}/projets/${projet.id}/pdv/${pdvId}/`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify(editForm),
    });
    if (resp.ok) { setEditingId(null); await onSave(); toast.show("PdV modifie"); }
    else toast.show("Erreur sauvegarde PdV", "err");
  };

  const deletePdv = async (pdvId: string) => {
    if (!confirm("Supprimer ce point de vente ?")) return;
    const resp = await fetch(`${apiBase}/projets/${projet.id}/pdv/${pdvId}/`, { method: "DELETE", credentials: "include" });
    if (resp.ok) { await onSave(); toast.show("PdV supprime"); }
  };

  const addPdv = async () => {
    if (!newForm.nom.trim()) { toast.show("Le nom est requis", "err"); return; }
    const resp = await fetch(`${apiBase}/projets/${projet.id}/pdv/`, {
      method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify(newForm),
    });
    if (resp.ok) {
      setAdding(false);
      setNewForm({ type_pdv: "self", nom: "", tranche_frequentation: 1, couverts_jour_cible: 200, jours_ouvres_mois: 20 });
      await onSave();
      toast.show("PdV ajoute");
    } else toast.show("Erreur ajout PdV", "err");
  };

  const inputCls = "w-full px-2 py-1.5 rounded-lg border border-custom-border-200 bg-custom-background-90 text-custom-text-100 text-sm";

  return (
    <div className="rounded-xl border border-custom-border-200 bg-custom-background-100 overflow-hidden">
      <div className="px-6 py-4 border-b border-custom-border-200 flex items-center justify-between" style={{ background: "rgba(90,85,82,0.04)" }}>
        <h2 className="text-sm font-semibold text-custom-text-100 flex items-center gap-2">
          🏢 Points de Vente ({projet.points_de_vente.length})
        </h2>
        <button
          onClick={() => setAdding(true)}
          className="px-3 py-1.5 rounded-lg text-white text-sm font-medium hover:opacity-90 flex items-center gap-1"
          style={{ background: C.terracotta }}
        >
          + Ajouter un PdV
        </button>
      </div>
      <div className="p-4 space-y-2.5">
        {projet.points_de_vente.map((pdv) =>
          editingId === pdv.id ? (
            <div key={pdv.id} className="p-4 rounded-xl border-2 border-dashed border-custom-border-300 bg-custom-background-90/30">
              <div className="grid grid-cols-5 gap-3 mb-3">
                <Field label="Type"><select value={editForm.type_pdv} onChange={(e) => setEditForm({ ...editForm, type_pdv: e.target.value })} className={inputCls}>{Object.entries(PDV_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
                <Field label="Nom"><input value={editForm.nom} onChange={(e) => setEditForm({ ...editForm, nom: e.target.value })} className={inputCls} /></Field>
                <Field label="Tranche"><input type="number" min={1} max={9} value={editForm.tranche_frequentation} onChange={(e) => setEditForm({ ...editForm, tranche_frequentation: parseInt(e.target.value) || 1 })} className={inputCls} /></Field>
                <Field label="Couverts/j"><input type="number" value={editForm.couverts_jour_cible} onChange={(e) => setEditForm({ ...editForm, couverts_jour_cible: parseInt(e.target.value) || 0 })} className={inputCls} /></Field>
                <Field label="Jours/mois"><input type="number" value={editForm.jours_ouvres_mois} onChange={(e) => setEditForm({ ...editForm, jours_ouvres_mois: parseInt(e.target.value) || 20 })} className={inputCls} /></Field>
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => savePdv(pdv.id)} className="px-3 py-1.5 rounded-lg text-white text-xs font-medium" style={{ background: C.chlorophyle }}>Valider</button>
                <button onClick={() => setEditingId(null)} className="px-3 py-1.5 rounded-lg border border-custom-border-200 text-custom-text-400 text-xs">Annuler</button>
              </div>
            </div>
          ) : (
            <div
              key={pdv.id}
              className="grid items-center gap-4 p-3.5 rounded-xl border border-custom-border-200 bg-custom-background-100 hover:border-custom-border-300 transition-all group"
              style={{ gridTemplateColumns: "56px 1fr auto auto" }}
            >
              {/* Icon */}
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl" style={{ background: C.terracottaBg }}>
                {PDV_ICONS[pdv.type_pdv] || "🍽️"}
              </div>
              {/* Name + Type */}
              <div>
                <div className="font-semibold text-sm text-custom-text-100">{pdv.nom || PDV_LABELS[pdv.type_pdv]}</div>
                <div className="text-xs text-custom-text-400">{PDV_LABELS[pdv.type_pdv]}</div>
              </div>
              {/* Stats */}
              <div className="flex items-center gap-5">
                <TrancheBadge tranche={pdv.tranche_frequentation} />
                <div className="text-center min-w-[50px]">
                  <div className="text-lg font-bold text-custom-text-100 leading-none">{pdv.couverts_jour_cible || "\u2014"}</div>
                  <div className="text-[10px] text-custom-text-400 uppercase tracking-wider mt-0.5">couv/j</div>
                </div>
                <div className="text-center min-w-[40px]">
                  <div className="text-lg font-bold text-custom-text-100 leading-none">{pdv.jours_ouvres_mois}</div>
                  <div className="text-[10px] text-custom-text-400 uppercase tracking-wider mt-0.5">j/mois</div>
                </div>
              </div>
              {/* Actions */}
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => { setEditingId(pdv.id); setEditForm({ type_pdv: pdv.type_pdv, nom: pdv.nom, tranche_frequentation: pdv.tranche_frequentation, couverts_jour_cible: pdv.couverts_jour_cible, jours_ouvres_mois: pdv.jours_ouvres_mois }); }}
                  className="p-1.5 rounded-lg border border-custom-border-200 text-custom-text-400 text-xs hover:text-custom-text-200 hover:bg-custom-background-90/50"
                  title="Modifier"
                >
                  ✎
                </button>
                <button
                  onClick={() => deletePdv(pdv.id)}
                  className="p-1.5 rounded-lg border border-custom-border-200 text-red-400 text-xs hover:bg-red-500/10"
                  title="Supprimer"
                >
                  🗑️
                </button>
              </div>
            </div>
          )
        )}

        {/* Add form */}
        {adding && (
          <div className="p-4 rounded-xl border-2 border-dashed bg-custom-background-90/20" style={{ borderColor: C.terracotta }}>
            <div className="text-xs font-semibold text-custom-text-200 mb-3">Nouveau Point de Vente</div>
            <div className="grid grid-cols-5 gap-3 mb-3">
              <Field label="Type"><select value={newForm.type_pdv} onChange={(e) => setNewForm({ ...newForm, type_pdv: e.target.value })} className={inputCls}>{Object.entries(PDV_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
              <Field label="Nom"><input value={newForm.nom} onChange={(e) => setNewForm({ ...newForm, nom: e.target.value })} placeholder="Nom du PdV" className={inputCls} /></Field>
              <Field label="Tranche"><input type="number" min={1} max={9} value={newForm.tranche_frequentation} onChange={(e) => setNewForm({ ...newForm, tranche_frequentation: parseInt(e.target.value) || 1 })} className={inputCls} /></Field>
              <Field label="Couverts/j"><input type="number" value={newForm.couverts_jour_cible} onChange={(e) => setNewForm({ ...newForm, couverts_jour_cible: parseInt(e.target.value) || 0 })} className={inputCls} /></Field>
              <Field label="Jours/mois"><input type="number" value={newForm.jours_ouvres_mois} onChange={(e) => setNewForm({ ...newForm, jours_ouvres_mois: parseInt(e.target.value) || 20 })} className={inputCls} /></Field>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={addPdv} className="px-3 py-1.5 rounded-lg text-white text-xs font-medium" style={{ background: C.chlorophyle }}>Ajouter</button>
              <button onClick={() => setAdding(false)} className="px-3 py-1.5 rounded-lg border border-custom-border-200 text-custom-text-400 text-xs">Annuler</button>
            </div>
          </div>
        )}

        {projet.points_de_vente.length === 0 && !adding && (
          <div className="text-center py-12 text-custom-text-400">
            <div className="text-3xl mb-2">🏢</div>
            <p className="text-sm">Aucun point de vente</p>
            <p className="text-xs mt-1">Cliquez "+ Ajouter un PdV" pour commencer</p>
          </div>
        )}
      </div>
    </div>
  );
}

function TrancheBadge({ tranche }: { tranche: number }) {
  const style = tranche <= 3
    ? { bg: C.saugeBg, color: C.sauge }
    : tranche <= 6
      ? { bg: C.terracottaBg, color: C.terracotta }
      : { bg: C.chlorophyleBg, color: C.chlorophyle };

  return (
    <div className="flex flex-col items-center px-3 py-1.5 rounded-lg" style={{ background: style.bg }}>
      <span className="text-base font-bold leading-none" style={{ color: style.color }}>T{tranche}</span>
      <span className="text-[9px] uppercase tracking-widest mt-0.5 opacity-80" style={{ color: style.color }}>tranche</span>
    </div>
  );
}

// ─── Tab: Mode de Gestion ────────────────────────────────────────────────────

function TabModeGestion({ projet, apiBase, onSave, toast }: { projet: ProjetAO; apiBase: string; onSave: () => void; toast: ToastHandle }) {
  const [selected, setSelected] = useState(projet.mode_gestion);
  const [horaires, setHoraires] = useState(projet.horaires_service);

  const save = async () => {
    const resp = await fetch(`${apiBase}/projets/${projet.id}/`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify({ mode_gestion: selected, horaires_service: horaires }),
    });
    if (resp.ok) await onSave();
    else throw new Error("save failed");
  };

  return (
    <div className="space-y-6">
      {/* Mode de gestion */}
      <div className="rounded-xl border border-custom-border-200 bg-custom-background-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-custom-border-200" style={{ background: "rgba(90,85,82,0.04)" }}>
          <h2 className="text-sm font-semibold text-custom-text-100 flex items-center gap-2">📊 Mode de gestion</h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {MODES.map((mode) => (
              <button
                key={mode.id}
                onClick={() => setSelected(mode.id)}
                className={`p-5 rounded-xl border-2 text-left transition-all relative ${
                  selected === mode.id ? "shadow-md" : "hover:shadow-sm"
                }`}
                style={{
                  borderColor: selected === mode.id ? C.terracotta : "var(--color-border-200, rgba(90,85,82,0.15))",
                  background: selected === mode.id ? C.terracottaBg : "var(--color-background-100, #2a2725)",
                  transform: selected === mode.id ? "translateY(-2px)" : "none",
                }}
              >
                {selected === mode.id && (
                  <div className="absolute top-3 right-3 w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: C.terracotta }}>
                    ✓
                  </div>
                )}
                <div className="text-2xl mb-2">{mode.icon}</div>
                <div className="font-semibold text-sm text-custom-text-100 mb-1.5">{mode.name}</div>
                <div className="text-xs text-custom-text-400 leading-relaxed mb-3">{mode.desc}</div>
                <div className="text-[11px] pt-2.5 border-t border-dashed border-custom-border-200">
                  <span style={{ color: C.terracotta, fontWeight: 600 }}>💡 Ideal pour : </span>
                  <span className="text-custom-text-400">{mode.tip}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Horaires */}
      <div className="rounded-xl border border-custom-border-200 bg-custom-background-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-custom-border-200" style={{ background: "rgba(90,85,82,0.04)" }}>
          <h2 className="text-sm font-semibold text-custom-text-100 flex items-center gap-2">🕐 Horaires de service</h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {Object.entries(HORAIRES).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setHoraires(key)}
                className="p-3.5 rounded-xl border-2 text-center text-sm font-medium transition-all"
                style={{
                  borderColor: horaires === key ? C.terracotta : "var(--color-border-200, rgba(90,85,82,0.15))",
                  background: horaires === key ? C.terracottaBg : "var(--color-background-90, #242220)",
                  color: horaires === key ? C.terracotta : "var(--color-text-300, #a09a94)",
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="mt-6 flex justify-end">
            <SaveButton onSave={save} toast={toast} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Scoring CCTP ───────────────────────────────────────────────────────

function TabScoring({ projet, apiBase, onSave, toast }: { projet: ProjetAO; apiBase: string; onSave: () => void; toast: ToastHandle }) {
  const [scores, setScores] = useState({
    scoring_concept_pct: projet.scoring_concept_pct,
    scoring_rh_pct: projet.scoring_rh_pct,
    scoring_qualite_pct: projet.scoring_qualite_pct,
    scoring_rse_pct: projet.scoring_rse_pct,
    scoring_prix_pct: projet.scoring_prix_pct,
  });

  const total = scores.scoring_concept_pct + scores.scoring_rh_pct + scores.scoring_qualite_pct + scores.scoring_rse_pct + scores.scoring_prix_pct;
  const isValid = total === 100;

  const save = async () => {
    if (!isValid) throw new Error("Total != 100%");
    const resp = await fetch(`${apiBase}/projets/${projet.id}/`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify(scores),
    });
    if (resp.ok) await onSave();
    else throw new Error("save failed");
  };

  return (
    <div className="rounded-xl border border-custom-border-200 bg-custom-background-100 overflow-hidden">
      <div className="px-6 py-4 border-b border-custom-border-200" style={{ background: "rgba(90,85,82,0.04)" }}>
        <h2 className="text-sm font-semibold text-custom-text-100 flex items-center gap-2">🎯 Ponderation du scoring CCTP</h2>
      </div>
      <div className="p-6">
        <div className="space-y-5 max-w-lg">
          {SCORE_FIELDS.map(({ key, label, icon, color, bg }) => (
            <div key={key}>
              <div className="flex items-center gap-2.5 mb-2">
                <span className="text-base">{icon}</span>
                <span className="flex-1 text-sm font-medium text-custom-text-200">{label}</span>
                <span className="text-lg font-bold min-w-[48px] text-right" style={{ color }}>{scores[key]}%</span>
              </div>
              <div className="relative">
                <div className="absolute inset-0 h-2 rounded-full top-[10px]" style={{ background: "rgba(90,85,82,0.12)" }} />
                <div className="absolute h-2 rounded-full top-[10px] transition-all" style={{ background: color, width: `${scores[key]}%` }} />
                <input
                  type="range"
                  min={0} max={100} step={5}
                  value={scores[key]}
                  onChange={(e) => setScores({ ...scores, [key]: parseInt(e.target.value) })}
                  className="relative w-full z-10"
                  style={{ background: "transparent" }}
                />
                <style>{`
                  input[type="range"]::-webkit-slider-thumb { background: ${color}; }
                `}</style>
              </div>
            </div>
          ))}
        </div>

        {/* Stacked bar */}
        <div className="mt-8 p-4 rounded-xl border border-custom-border-200" style={{ background: "rgba(90,85,82,0.04)" }}>
          <div className="flex h-7 rounded-lg overflow-hidden mb-2.5">
            {SCORE_FIELDS.map(({ key, color }) => (
              <div
                key={key}
                className="transition-all duration-300"
                style={{ width: `${scores[key]}%`, background: color }}
                title={`${key}: ${scores[key]}%`}
              />
            ))}
          </div>
          <div className={`text-sm font-semibold text-center ${isValid ? "" : ""}`} style={{ color: isValid ? C.chlorophyle : C.terracotta }}>
            Total : {total}% {isValid ? " \u2713" : " (doit faire 100%)"}
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <SaveButton onSave={save} disabled={!isValid} toast={toast} />
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Documents ──────────────────────────────────────────────────────────

function TabDocuments({ projet, apiBase, onSave, toast }: { projet: ProjetAO; apiBase: string; onSave: () => void; toast: ToastHandle }) {
  const docs = [
    { key: "cctp_pdf", label: "CCTP / Cahier des charges", icon: "📋", required: true },
  ];

  return (
    <div className="rounded-xl border border-custom-border-200 bg-custom-background-100 overflow-hidden">
      <div className="px-6 py-4 border-b border-custom-border-200" style={{ background: "rgba(90,85,82,0.04)" }}>
        <h2 className="text-sm font-semibold text-custom-text-100 flex items-center gap-2">📄 Documents du projet</h2>
      </div>
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {docs.map((doc) => (
            <DocUploadZone
              key={doc.key}
              projet={projet}
              apiBase={apiBase}
              field={doc.key}
              label={doc.label}
              icon={doc.icon}
              required={doc.required}
              currentFile={(projet as any)[doc.key]}
              onSave={onSave}
              toast={toast}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function DocUploadZone({
  projet, apiBase, field, label, icon, required, currentFile, onSave, toast,
}: {
  projet: ProjetAO; apiBase: string; field: string; label: string; icon: string;
  required?: boolean; currentFile: string | null; onSave: () => void; toast: ToastHandle;
}) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append(field, file);
      const resp = await fetch(`${apiBase}/projets/${projet.id}/`, {
        method: "PATCH", credentials: "include", body: formData,
      });
      if (resp.ok) { await onSave(); toast.show("Document uploade"); }
      else toast.show("Erreur upload", "err");
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type === "application/pdf") upload(file);
    else toast.show("PDF uniquement", "err");
  };

  return (
    <div className="rounded-xl border border-custom-border-200 p-5">
      <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-custom-border-200">
        <span className="text-xl">{icon}</span>
        <span className="text-sm font-medium text-custom-text-100 flex-1">
          {label}
          {required && <span style={{ color: C.terracotta }}> *</span>}
        </span>
      </div>

      {currentFile ? (
        <div>
          <div className="rounded-lg border border-custom-border-200 overflow-hidden mb-3">
            <iframe src={currentFile} className="w-full h-52 border-none block" title={label} />
          </div>
          <div className="flex justify-end gap-2">
            <a
              href={currentFile}
              download
              className="px-3 py-1.5 rounded-lg border border-custom-border-200 text-custom-text-400 text-xs hover:text-custom-text-200 no-underline inline-flex items-center gap-1"
            >
              ⬇ Telecharger
            </a>
            <label className="px-3 py-1.5 rounded-lg border border-custom-border-200 text-custom-text-400 text-xs hover:text-custom-text-200 cursor-pointer inline-flex items-center gap-1">
              🔄 Remplacer
              <input ref={inputRef} type="file" accept=".pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }} />
            </label>
          </div>
        </div>
      ) : (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className="py-10 px-6 rounded-xl text-center cursor-pointer transition-all border-2 border-dashed"
          style={{
            borderColor: dragging ? C.terracotta : "var(--color-border-200, rgba(90,85,82,0.15))",
            background: dragging ? C.terracottaBg : "transparent",
          }}
        >
          <input ref={inputRef} type="file" accept=".pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }} />
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <span className="inline-block w-6 h-6 border-2 border-custom-text-400/30 rounded-full animate-spin" style={{ borderTopColor: C.terracotta }} />
              <span className="text-sm text-custom-text-400">Upload en cours...</span>
            </div>
          ) : (
            <>
              <div className="text-3xl mb-2">📄</div>
              <div className="text-sm font-medium text-custom-text-200 mb-1">
                {dragging ? "Deposer ici" : "Glisser-deposer ou cliquer"}
              </div>
              <div className="text-xs text-custom-text-400">PDF uniquement · 10 Mo max</div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Tab: Scenarios & Simulation ─────────────────────────────────────────────

type SimResult = {
  activity: { couverts_mois: number; couverts_annuel: number; ca_mensuel: number; ca_annuel: number };
  staffing: { etp_total: number; masse_chargee_mensuelle: number; masse_chargee_annuelle: number; detail_postes: any[] };
  matiere: { cout_matiere_mensuel: number; cout_par_couvert: number; niveau_prix: string };
  fg: { fg_mensuel: number; fg_annuel: number; sous_totaux: Record<string, number> };
  invest: { invest_total: number; amortissement_mensuel: number };
  pl: {
    ca_total: number; ca_total_annuel: number; cout_matiere: number; masse_salariale: number;
    frais_generaux: number; amortissements: number; total_charges: number;
    resultat: number; resultat_annuel: number; marge_pct: number; marge_par_couvert: number;
    ratio_matiere_pct: number; ratio_personnel_pct: number; ratio_fg_pct: number;
  };
  kpis: { cout_par_couvert: number; prix_moyen_plateau: number; seuil_rentabilite_couverts: number };
  score_estime: { total: number; prix: number; concept: number; rh: number; rse: number; qualite: number };
  _elapsed_ms?: number;
};

function TabScenarios({ projet, apiBase, toast }: { projet: ProjetAO; apiBase: string; toast: ToastHandle }) {
  const [params, setParams] = useState<any>({
    niveau_prix: "prix_standard",
    prix_admission: 6.50,
    prix_admission_ext: 8.00,
    prix_plateau_moyen: 8.50,
    prix_vente_bpu: 6.00,
    pct_externes: 0.20,
    penetration: 0.90,
    saisonnalite: 1.0,
    mutualisation: "none",
    subvention_employeur_pct: 0.40,
    marge_gestion_pct: 0.06,
  });
  const [sim, setSim] = useState<SimResult | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [scenarios, setScenarios] = useState<any[]>([]);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>("");
  const [newScenarioName, setNewScenarioName] = useState("");

  // Load scenarios
  useEffect(() => {
    fetch(`${apiBase}/projets/${projet.id}/scenarios/`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        const arr = Array.isArray(data) ? data : data.results || [];
        setScenarios(arr);
        if (arr.length && !selectedScenarioId) {
          setSelectedScenarioId(arr[0].id);
          if (arr[0].parametres) setParams({ ...params, ...arr[0].parametres });
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced simulation
  useEffect(() => {
    const t = setTimeout(async () => {
      setSimulating(true);
      try {
        const r = await fetch(`${apiBase}/projets/${projet.id}/simuler/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ parametres: params }),
        });
        if (r.ok) setSim(await r.json());
        else toast.show("Erreur simulation", "err");
      } finally {
        setSimulating(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [params, apiBase, projet.id, toast]);

  const saveAsScenario = async () => {
    const name = newScenarioName || `Scenario ${scenarios.length + 1}`;
    const r = await fetch(`${apiBase}/projets/${projet.id}/scenarios/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ nom: name, parametres: params, resultats: sim }),
    });
    if (r.ok) {
      const created = await r.json();
      setScenarios([...scenarios, created]);
      setSelectedScenarioId(created.id);
      setNewScenarioName("");
      toast.show(`Scenario "${name}" sauvegarde`);
    } else {
      toast.show("Erreur sauvegarde scenario", "err");
    }
  };

  const fmtEur = (v?: number) =>
    v == null ? "—" : new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);
  const fmtNum = (v?: number) =>
    v == null ? "—" : new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(v);
  const fmtPct = (v?: number) => (v == null ? "—" : `${v.toFixed(1)}%`);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      {/* Sliders */}
      <div className="lg:col-span-4 rounded-xl border border-custom-border-200 bg-custom-background-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-custom-border-200" style={{ background: "rgba(90,85,82,0.04)" }}>
          <h2 className="text-sm font-semibold text-custom-text-100 flex items-center gap-2">⚙️ Parametres simulation</h2>
        </div>
        <div className="p-5 space-y-4">
          {/* Scenarios saved */}
          {scenarios.length > 0 && (
            <Field label="Scenario charge">
              <select
                value={selectedScenarioId}
                onChange={(e) => {
                  const id = e.target.value;
                  setSelectedScenarioId(id);
                  const s = scenarios.find((x) => x.id === id);
                  if (s?.parametres) setParams({ ...params, ...s.parametres });
                }}
                className="w-full px-3 py-2 rounded-lg border border-custom-border-200 bg-custom-background-90 text-custom-text-100 text-sm"
              >
                {scenarios.map((s) => <option key={s.id} value={s.id}>{s.nom}</option>)}
              </select>
            </Field>
          )}

          <Field label="Niveau de prix matiere">
            <select
              value={params.niveau_prix}
              onChange={(e) => setParams({ ...params, niveau_prix: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-custom-border-200 bg-custom-background-90 text-custom-text-100 text-sm"
            >
              <option value="prix_eco">Economique</option>
              <option value="prix_standard">Standard</option>
              <option value="prix_premium">Premium</option>
              <option value="prix_luxe">Luxe</option>
            </select>
          </Field>

          {(projet.mode_gestion === "admission" || projet.mode_gestion === "mixte") && (
            <SliderField
              label="Prix admission (€/cvt)"
              value={params.prix_admission} min={3} max={15} step={0.10}
              format={(v) => `${v.toFixed(2)} €`}
              onChange={(v) => setParams({ ...params, prix_admission: v })}
            />
          )}

          {projet.mode_gestion === "mixte" && (
            <SliderField
              label="% convives externes"
              value={params.pct_externes} min={0} max={1} step={0.05}
              format={(v) => `${Math.round(v * 100)}%`}
              onChange={(v) => setParams({ ...params, pct_externes: v })}
            />
          )}

          {projet.mode_gestion === "ticket" && (
            <SliderField
              label="Prix plateau moyen (€)"
              value={params.prix_plateau_moyen} min={5} max={20} step={0.50}
              format={(v) => `${v.toFixed(2)} €`}
              onChange={(v) => setParams({ ...params, prix_plateau_moyen: v })}
            />
          )}

          {projet.mode_gestion === "masse_frais" && (
            <SliderField
              label="Marge gestion (%)"
              value={params.marge_gestion_pct} min={0} max={0.20} step={0.01}
              format={(v) => `${(v * 100).toFixed(1)}%`}
              onChange={(v) => setParams({ ...params, marge_gestion_pct: v })}
            />
          )}

          <SliderField
            label="Penetration convives"
            value={params.penetration} min={0.3} max={1.0} step={0.05}
            format={(v) => `${Math.round(v * 100)}%`}
            onChange={(v) => setParams({ ...params, penetration: v })}
          />

          <SliderField
            label="Coefficient saisonnalite"
            value={params.saisonnalite} min={0.6} max={1.4} step={0.05}
            format={(v) => `×${v.toFixed(2)}`}
            onChange={(v) => setParams({ ...params, saisonnalite: v })}
          />

          {projet.points_de_vente.length > 1 && (
            <Field label="Mutualisation multi-PdV">
              <select
                value={params.mutualisation}
                onChange={(e) => setParams({ ...params, mutualisation: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-custom-border-200 bg-custom-background-90 text-custom-text-100 text-sm"
              >
                <option value="none">Aucune</option>
                <option value="scenario_1_3">Scenario 1&3 (encadrement -30%)</option>
                <option value="scenario_2">Scenario 2 (encadrement -50%)</option>
              </select>
            </Field>
          )}

          {/* Save as scenario */}
          <div className="pt-4 border-t border-custom-border-200">
            <input
              value={newScenarioName}
              onChange={(e) => setNewScenarioName(e.target.value)}
              placeholder="Nom du scenario"
              className="w-full px-3 py-2 rounded-lg border border-custom-border-200 bg-custom-background-90 text-custom-text-100 text-sm mb-2"
            />
            <button
              onClick={saveAsScenario}
              className="w-full px-4 py-2 rounded-lg text-white text-sm font-medium hover:opacity-90"
              style={{ background: C.chlorophyle }}
            >
              💾 Sauvegarder comme scenario
            </button>
          </div>
        </div>
      </div>

      {/* KPIs + P&L */}
      <div className="lg:col-span-8 space-y-5">
        {/* Score badge + perf */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {sim && (
              <div className="px-4 py-2 rounded-xl flex items-center gap-3" style={{ background: C.terracottaBg }}>
                <span className="text-2xl font-bold" style={{ color: C.terracotta }}>{sim.score_estime.total}</span>
                <span className="text-xs text-custom-text-400">SCORE<br/>ESTIME /100</span>
              </div>
            )}
            {simulating && <span className="inline-block w-4 h-4 border-2 border-custom-text-400/30 border-t-custom-text-200 rounded-full animate-spin" />}
          </div>
          {sim?._elapsed_ms != null && (
            <span className="text-[11px] text-custom-text-400">
              Calcule en {sim._elapsed_ms}ms
            </span>
          )}
        </div>

        {/* KPI Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KPICard label="CA mensuel" value={fmtEur(sim?.pl.ca_total)} sub={`${fmtNum(sim?.activity.couverts_mois)} cvts`} color={C.terracotta} />
          <KPICard label="Masse salariale" value={fmtEur(sim?.staffing.masse_chargee_mensuelle)} sub={`${sim?.staffing.etp_total.toFixed(1)} ETP`} color={C.chlorophyle} />
          <KPICard label="Cout matiere" value={fmtEur(sim?.matiere.cout_matiere_mensuel)} sub={`${sim?.matiere.cout_par_couvert.toFixed(2) ?? "—"}€/cvt`} color={C.nude} />
          <KPICard
            label="Resultat"
            value={fmtEur(sim?.pl.resultat)}
            sub={fmtPct(sim?.pl.marge_pct)}
            color={(sim?.pl.resultat ?? 0) >= 0 ? C.chlorophyle : C.terracotta}
          />
        </div>

        {/* P&L Detail */}
        <div className="rounded-xl border border-custom-border-200 bg-custom-background-100 overflow-hidden">
          <div className="px-5 py-3 border-b border-custom-border-200" style={{ background: "rgba(90,85,82,0.04)" }}>
            <h3 className="text-sm font-semibold text-custom-text-100">Compte de Resultat (mensuel)</h3>
          </div>
          {sim && (
            <table className="w-full text-sm">
              <tbody>
                <PLRow label="CA Total" value={fmtEur(sim.pl.ca_total)} bold />
                <PLRow label="Cout matiere" value={`- ${fmtEur(sim.pl.cout_matiere)}`} pct={fmtPct(sim.pl.ratio_matiere_pct)} />
                <PLRow label="Masse salariale chargee" value={`- ${fmtEur(sim.pl.masse_salariale)}`} pct={fmtPct(sim.pl.ratio_personnel_pct)} />
                <PLRow label="Frais generaux" value={`- ${fmtEur(sim.pl.frais_generaux)}`} pct={fmtPct(sim.pl.ratio_fg_pct)} />
                <PLRow label="Amortissements" value={`- ${fmtEur(sim.pl.amortissements)}`} />
                <PLRow label="Total charges" value={`- ${fmtEur(sim.pl.total_charges)}`} bold />
                <PLRow label="RESULTAT MENSUEL" value={fmtEur(sim.pl.resultat)} bold accent={sim.pl.resultat >= 0 ? C.chlorophyle : C.terracotta} />
                <PLRow label="Resultat annualise" value={fmtEur(sim.pl.resultat_annuel)} muted />
              </tbody>
            </table>
          )}
        </div>

        {/* Score breakdown */}
        {sim && (
          <div className="rounded-xl border border-custom-border-200 bg-custom-background-100 p-5">
            <h3 className="text-sm font-semibold text-custom-text-100 mb-3">Decomposition du score estime</h3>
            <div className="grid grid-cols-5 gap-2">
              {[
                { k: "prix", label: "Prix", v: sim.score_estime.prix, max: 40, c: C.terracotta },
                { k: "concept", label: "Concept", v: sim.score_estime.concept, max: 20, c: C.nude },
                { k: "rh", label: "RH", v: sim.score_estime.rh, max: 15, c: C.chlorophyle },
                { k: "rse", label: "RSE", v: sim.score_estime.rse, max: 15, c: C.sauge },
                { k: "qualite", label: "Qualite", v: sim.score_estime.qualite, max: 10, c: C.charbon },
              ].map((s) => (
                <div key={s.k} className="text-center">
                  <div className="text-2xl font-bold" style={{ color: s.c }}>{s.v}</div>
                  <div className="text-[10px] text-custom-text-400">/ {s.max}</div>
                  <div className="text-xs font-medium text-custom-text-200 mt-1">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function KPICard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="rounded-xl border border-custom-border-200 bg-custom-background-100 p-4">
      <div className="text-[10px] font-semibold text-custom-text-400 uppercase tracking-wide">{label}</div>
      <div className="text-xl font-bold mt-1" style={{ color: color || "var(--color-text-100)" }}>{value}</div>
      {sub && <div className="text-xs text-custom-text-400 mt-0.5">{sub}</div>}
    </div>
  );
}

function PLRow({ label, value, pct, bold, muted, accent }: { label: string; value: string; pct?: string; bold?: boolean; muted?: boolean; accent?: string }) {
  return (
    <tr className="border-b border-custom-border-100 last:border-b-0">
      <td className={`px-5 py-2 text-sm ${bold ? "font-semibold" : ""} ${muted ? "text-custom-text-400" : "text-custom-text-200"}`}>
        {label}
      </td>
      <td className={`px-5 py-2 text-sm text-right tabular-nums ${bold ? "font-bold" : ""} ${muted ? "text-custom-text-400" : ""}`} style={accent ? { color: accent } : {}}>
        {value}
      </td>
      <td className="px-3 py-2 text-xs text-right text-custom-text-400 w-16">{pct || ""}</td>
    </tr>
  );
}

function SliderField({ label, value, min, max, step, format, onChange }: {
  label: string; value: number; min: number; max: number; step: number;
  format?: (v: number) => string; onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-[11px] font-semibold text-custom-text-400 uppercase tracking-wide">{label}</label>
        <span className="text-sm font-semibold" style={{ color: C.terracotta }}>
          {format ? format(value) : value}
        </span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full"
      />
    </div>
  );
}

// ─── Tab: Generation ─────────────────────────────────────────────────────────

function TabGeneration({ projet, apiBase, toast }: { projet: ProjetAO; apiBase: string; toast: ToastHandle }) {
  const [scenarios, setScenarios] = useState<any[]>([]);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>("");
  const [generating, setGenerating] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch(`${apiBase}/projets/${projet.id}/scenarios/`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        const arr = Array.isArray(data) ? data : data.results || [];
        setScenarios(arr);
        if (arr.length) setSelectedScenarioId(arr[0].id);
      })
      .catch(() => {});
  }, [apiBase, projet.id]);

  const generate = async (kind: string, ext: string = "xlsx") => {
    setGenerating({ ...generating, [kind]: true });
    try {
      const url = kind === "tout"
        ? `${apiBase}/projets/${projet.id}/generer-tout/`
        : `${apiBase}/projets/${projet.id}/generer-${kind}/`;
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ scenario_id: selectedScenarioId || null }),
      });
      if (!r.ok) {
        toast.show("Erreur generation", "err");
        return;
      }
      const blob = await r.blob();
      const cd = r.headers.get("content-disposition") || "";
      const m = cd.match(/filename="(.+?)"/);
      const fname = m ? m[1] : `${kind}.${ext}`;
      const url2 = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url2;
      a.download = fname;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url2);
      toast.show("Telechargement OK");
    } catch (e: any) {
      toast.show("Erreur: " + e.message, "err");
    } finally {
      setGenerating({ ...generating, [kind]: false });
    }
  };

  const cards = [
    { kind: "bpu", icon: "📊", title: "BPU Alimentaires", desc: ".xlsx · 25 onglets · prix unitaires", count: "25" },
    { kind: "budget", icon: "💶", title: "Budget Previsionnel", desc: ".xlsx · 5 onglets · activite + P&L", count: "5" },
    { kind: "cout-fixe", icon: "📋", title: "Cout Fixe Multi-Scenarios", desc: ".xlsx · 20 onglets · 3 scenarios", count: "20" },
  ];

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-custom-border-200 bg-custom-background-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-custom-border-200" style={{ background: "rgba(90,85,82,0.04)" }}>
          <h2 className="text-sm font-semibold text-custom-text-100 flex items-center gap-2">📦 Generation des documents AO</h2>
        </div>
        <div className="p-6">
          {scenarios.length > 0 ? (
            <Field label="Scenario a utiliser pour la generation">
              <select
                value={selectedScenarioId}
                onChange={(e) => setSelectedScenarioId(e.target.value)}
                className="w-full max-w-md px-3 py-2 rounded-lg border border-custom-border-200 bg-custom-background-90 text-custom-text-100 text-sm"
              >
                {scenarios.map((s) => <option key={s.id} value={s.id}>{s.nom}</option>)}
              </select>
            </Field>
          ) : (
            <div className="px-4 py-3 rounded-lg text-sm" style={{ background: C.terracottaBg, color: C.terracotta }}>
              ℹ️ Aucun scenario sauvegarde — la generation utilisera les parametres par defaut.
              Cree un scenario depuis l'onglet "Scenarios & Simulation" pour customiser.
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            {cards.map((c) => (
              <button
                key={c.kind}
                onClick={() => generate(c.kind)}
                disabled={generating[c.kind]}
                className="p-5 rounded-xl border-2 border-custom-border-200 text-left hover:border-custom-border-300 transition-all hover:shadow-md disabled:opacity-50 relative"
              >
                <div className="text-3xl mb-3">{c.icon}</div>
                <div className="font-semibold text-sm text-custom-text-100 mb-1">{c.title}</div>
                <div className="text-xs text-custom-text-400">{c.desc}</div>
                {generating[c.kind] && (
                  <div className="absolute top-3 right-3">
                    <span className="inline-block w-4 h-4 border-2 border-custom-text-400/30 border-t-custom-text-200 rounded-full animate-spin" />
                  </div>
                )}
                <div className="absolute bottom-3 right-4 text-[10px] uppercase tracking-wide text-custom-text-400 font-semibold">
                  Telecharger →
                </div>
              </button>
            ))}
          </div>

          <div className="mt-6 flex justify-center pt-6 border-t border-custom-border-200">
            <button
              onClick={() => generate("tout", "zip")}
              disabled={generating["tout"]}
              className="px-6 py-3 rounded-xl text-white text-base font-semibold hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
              style={{ background: C.terracotta }}
            >
              {generating["tout"] && <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              📦 Telecharger tout le dossier (.zip)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Shared Components ───────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-custom-text-400 uppercase tracking-wide mb-1.5">{label}</label>
      {children}
    </div>
  );
}
