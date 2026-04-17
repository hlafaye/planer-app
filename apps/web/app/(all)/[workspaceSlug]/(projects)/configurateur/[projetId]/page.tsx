// Planer custom: Configurateur AO — detail page (Plane Design System)
"use client";

import { useParams } from "next/navigation";
import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@plane/propel/button";
import { IconButton } from "@plane/propel/icon-button";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";

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
  duree_contrat_annees: number;
  pct_frais_siege: number;
  pct_produits_achats: number;
  remise_commerciale_pct: number;
  semaines_par_an: number;
  created_at: string;
  updated_at: string;
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
  { id: "masse_frais", icon: "\uD83D\uDCBC", name: "Masse de Frais", desc: "Charges salariales et FG facturees mensuellement au client.", tip: "Le plus courant en restauration d'entreprise" },
  { id: "admission", icon: "\uD83C\uDFAB", name: "Admission / Subvention", desc: "Prix convive fixe. Employeur subventionne ses salaries.", tip: "Site avec politique de subvention claire" },
  { id: "mixte", icon: "\u2696\uFE0F", name: "Mixte", desc: "Masse de frais pour les charges fixes + admissions pour les exterieurs.", tip: "Projets complexes avec convives mixtes" },
  { id: "ticket", icon: "\uD83C\uDF7D\uFE0F", name: "Tout sur le ticket", desc: "Restauration commerciale classique. Le convive paie tout.", tip: "Restaurants grand public" },
  { id: "custom", icon: "\u2699\uFE0F", name: "Autre / Custom", desc: "Mode hybride ou specifique. Parametrage libre.", tip: "Cas atypiques" },
];

const HORAIRES: Record<string, string> = {
  midi: "Midi", midi_soir: "Midi + Soir", continu: "Continu", pdj_midi: "Petit-dej + Midi",
};

const SCORE_FIELDS = [
  { key: "scoring_prix_pct" as const, label: "Prix", icon: "\uD83D\uDCB0" },
  { key: "scoring_concept_pct" as const, label: "Concept", icon: "\uD83D\uDCA1" },
  { key: "scoring_rh_pct" as const, label: "RH", icon: "\uD83D\uDC65" },
  { key: "scoring_rse_pct" as const, label: "RSE", icon: "\u267B\uFE0F" },
  { key: "scoring_qualite_pct" as const, label: "Qualite", icon: "\u2705" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const toast = {
  ok: (msg: string) => setToast({ type: TOAST_TYPE.SUCCESS, title: msg }),
  err: (msg: string) => setToast({ type: TOAST_TYPE.ERROR, title: msg }),
};

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function ProjetAODetailPage() {
  const { workspaceSlug, projetId } = useParams<{ workspaceSlug: string; projetId: string }>();
  const [projet, setProjet] = useState<ProjetAO | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("general");
  const [menuOpen, setMenuOpen] = useState(false);

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
      method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify({ statut }),
    });
    if (resp.ok) { setProjet(await resp.json()); toast.ok("Statut mis a jour"); }
    else toast.err("Erreur changement de statut");
  };

  const dupliquer = async () => {
    const resp = await fetch(`${apiBase}/projets/${projetId}/dupliquer/`, { method: "POST", credentials: "include" });
    if (resp.ok) {
      const data = await resp.json();
      toast.ok("Projet duplique");
      setTimeout(() => window.location.assign(`/${workspaceSlug}/configurateur/${data.id}`), 600);
    } else toast.err("Erreur duplication");
  };

  const supprimer = async () => {
    if (!confirm("Supprimer ce projet AO ? Cette action est irreversible.")) return;
    const resp = await fetch(`${apiBase}/projets/${projetId}/`, { method: "DELETE", credentials: "include" });
    if (resp.ok) window.location.assign(`/${workspaceSlug}/configurateur`);
    else toast.err("Erreur suppression");
  };

  if (loading) return <div className="h-full flex items-center justify-center text-tertiary text-sm">Chargement...</div>;
  if (!projet) return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center">
        <p className="text-tertiary text-sm">Projet introuvable</p>
        <a href={`/${workspaceSlug}/configurateur`} className="text-sm mt-2 inline-block text-link-primary">&larr; Retour</a>
      </div>
    </div>
  );

  const NAV_ITEMS = [
    { key: "general", label: "Vue d'ensemble", icon: "\uD83D\uDCCB" },
    { key: "pdv", label: `Points de Vente (${projet.points_de_vente.length})`, icon: "\uD83C\uDFE2" },
    { key: "config", label: "Configuration", icon: "\u2699\uFE0F" },
    { key: "referentiels", label: "Referentiels", icon: "\uD83D\uDCD6" },
    { key: "scenarios", label: "Simulation", icon: "\uD83E\uDDEE" },
    { key: "docs", label: "Documents", icon: "\uD83D\uDCE6" },
  ];

  const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : null;

  return (
    <div className="h-full flex">
      {/* ── Left sidebar nav ── */}
      <div className="w-56 shrink-0 border-r border-border-subtle bg-surface-1 overflow-y-auto">
        <div className="p-3">
          <a
            href={`/${workspaceSlug}/configurateur`}
            className="flex items-center gap-1.5 text-xs text-tertiary hover:text-secondary no-underline mb-3 px-2"
          >
            &larr; Liste AO
          </a>
          <div className="px-2 mb-1">
            <div className="text-caption-xs text-tertiary uppercase tracking-wider font-medium">Configurateur AO</div>
          </div>
          <div className="px-2 mb-4">
            <div className="text-sm font-semibold text-primary truncate">{projet.nom}</div>
            <div className="text-xs text-tertiary">{projet.client}</div>
          </div>
          <div className="flex flex-col gap-0.5">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.key}
                onClick={() => setActiveTab(item.key)}
                className={`w-full text-left px-2 py-1.5 rounded-md text-sm flex items-center gap-2 transition-colors ${
                  activeTab === item.key
                    ? "bg-layer-transparent-active text-primary font-medium"
                    : "text-secondary hover:bg-layer-transparent-hover"
                }`}
              >
                <span className="text-base w-5 text-center shrink-0">{item.icon}</span>
                <span className="truncate">{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="flex-1 overflow-y-auto bg-surface-1">
        <div className="max-w-5xl mx-auto px-6 py-5">
          {/* Header */}
          <div className="flex items-start justify-between pb-4 mb-2 border-b border-border-subtle">
            <div>
              <div className="inline-block text-caption-xs font-bold tracking-widest uppercase text-accent-primary bg-accent-primary/10 px-2 py-0.5 rounded-full mb-2">
                CONFIGURATEUR AO
              </div>
              <h1 className="text-xl font-bold text-primary mb-1">
                {projet.nom}
              </h1>
              <div className="flex items-center gap-2 text-sm text-tertiary flex-wrap">
                {projet.localisation && <span>{projet.localisation}</span>}
                {projet.localisation && <span className="opacity-30">&middot;</span>}
                {projet.date_remise && <span>Remise le {formatDate(projet.date_remise)}</span>}
                {projet.date_remise && <span className="opacity-30">&middot;</span>}
                <span>{projet.client}</span>
                <span className="opacity-30">&middot;</span>
                <span>{projet.points_de_vente.length} PdV</span>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-4 relative">
              <Button variant="secondary" size="base" onClick={dupliquer}>Dupliquer</Button>
              <div className="relative">
                <Button variant="ghost" size="base" onClick={() => setMenuOpen(!menuOpen)}>&#8942;</Button>
                {menuOpen && (
                  <div className="absolute right-0 top-full mt-1 w-48 rounded-lg border border-border-subtle bg-layer-3 shadow-xl z-50 overflow-hidden">
                    <button onClick={() => { changeStatut("perdu"); setMenuOpen(false); }} className="w-full text-left px-3 py-2 text-sm text-secondary hover:bg-layer-transparent-hover">Marquer Perdu</button>
                    <button onClick={() => { supprimer(); setMenuOpen(false); }} className="w-full text-left px-3 py-2 text-sm text-danger-secondary hover:bg-danger-subtle">Supprimer</button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Status Stepper */}
          <StatusStepper current={projet.statut} onChange={changeStatut} />

          {/* Tab Content */}
          {activeTab === "general" && <TabGeneral projet={projet} apiBase={apiBase} onSave={fetchProjet} />}
          {activeTab === "pdv" && <TabPointsDeVente projet={projet} apiBase={apiBase} onSave={fetchProjet} />}
          {activeTab === "config" && <TabConfig projet={projet} apiBase={apiBase} onSave={fetchProjet} />}
          {activeTab === "referentiels" && <TabReferentiels projet={projet} apiBase={apiBase} />}
          {activeTab === "scenarios" && <TabScenarios projet={projet} apiBase={apiBase} />}
          {activeTab === "docs" && <TabDocuments projet={projet} apiBase={apiBase} onSave={fetchProjet} />}
        </div>
      </div>
    </div>
  );
}

// ─── Status Stepper ──────────────────────────────────────────────────────────

function StatusStepper({ current, onChange }: { current: string; onChange: (s: string) => void }) {
  const currentIdx = STEPS.findIndex((s) => s.key === current);
  return (
    <div className="flex items-center py-4 mb-4">
      {STEPS.map((step, i) => {
        const isDone = i < currentIdx;
        const isActive = i === currentIdx;
        const isGagne = step.key === "gagne" && isActive;
        return (
          <div key={step.key} className="flex-1 flex items-center">
            <button onClick={() => onChange(step.key)} className="flex flex-col items-center gap-1.5 flex-1 group">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg relative z-10 border-2 transition-all ${
                isActive
                  ? isGagne ? "bg-success-primary border-success-primary text-on-color shadow-md scale-110" : "bg-accent-primary border-accent-primary text-on-color shadow-md scale-110"
                  : isDone ? "bg-accent-primary/10 border-accent-primary" : "bg-layer-1 border-border-subtle"
              }`}>
                {step.icon}
              </div>
              <span className={`text-xs transition-all ${
                isActive ? "font-semibold text-primary" : isDone ? "font-medium text-secondary" : "text-tertiary"
              }`}>
                {step.label}
              </span>
            </button>
            {i < STEPS.length - 1 && (
              <div className={`h-0.5 flex-1 -mx-2 mt-[-18px] ${isDone ? "bg-accent-primary" : "bg-border-subtle"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── SaveButton ──────────────────────────────────────────────────────────────

function SaveButton({ onSave, disabled }: { onSave: () => Promise<void>; disabled?: boolean }) {
  const [status, setStatus] = useState<"idle" | "saving" | "done">("idle");
  const handleClick = async () => {
    setStatus("saving");
    try { await onSave(); setStatus("done"); toast.ok("Modifications enregistrees"); setTimeout(() => setStatus("idle"), 1800); }
    catch { setStatus("idle"); toast.err("Erreur sauvegarde"); }
  };
  return (
    <Button variant="primary" size="lg" onClick={handleClick} disabled={disabled || status === "saving"} loading={status === "saving"}>
      {status === "done" ? "\u2713 Enregistre" : "Enregistrer"}
    </Button>
  );
}

// ─── Tab: General (Vue d'ensemble) ───────────────────────────────────────────

function TabGeneral({ projet, apiBase, onSave }: { projet: ProjetAO; apiBase: string; onSave: () => void }) {
  const [form, setForm] = useState({
    nom: projet.nom, client: projet.client, localisation: projet.localisation || "",
    date_remise: projet.date_remise || "", date_ouverture_visee: projet.date_ouverture_visee || "",
    nature: projet.nature, perimetre: projet.perimetre,
    duree_contrat_annees: projet.duree_contrat_annees || 5,
    pct_frais_siege: projet.pct_frais_siege || 6.5,
    remise_commerciale_pct: projet.remise_commerciale_pct || 0,
    pct_produits_achats: projet.pct_produits_achats || 25,
    semaines_par_an: projet.semaines_par_an || 45,
  });

  const save = async () => {
    const resp = await fetch(`${apiBase}/projets/${projet.id}/`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify(form),
    });
    if (resp.ok) await onSave(); else throw new Error("save failed");
  };

  const update = (key: string, value: any) => setForm((prev) => ({ ...prev, [key]: value }));
  const inputCls = "w-full h-8 px-3 rounded-md border border-border-subtle bg-layer-2 text-primary text-sm focus:outline-none focus:border-accent-primary transition-colors";

  return (
    <div className="space-y-5">
      {/* KPI cards */}
      <div className="grid grid-cols-4 gap-3">
        <div className="p-3 rounded-lg bg-layer-1 border border-border-subtle">
          <div className="text-xs text-tertiary">Points de vente</div>
          <div className="text-lg font-bold text-primary mt-1">{projet.points_de_vente.length}</div>
        </div>
        <div className="p-3 rounded-lg bg-layer-1 border border-border-subtle">
          <div className="text-xs text-tertiary">Mode gestion</div>
          <div className="text-lg font-bold text-primary mt-1 truncate">{MODES.find(m => m.id === projet.mode_gestion)?.name || projet.mode_gestion}</div>
        </div>
        <div className="p-3 rounded-lg bg-layer-1 border border-border-subtle">
          <div className="text-xs text-tertiary">Semaines / an</div>
          <div className="text-lg font-bold text-primary mt-1">{form.semaines_par_an}</div>
        </div>
        <div className="p-3 rounded-lg bg-layer-1 border border-border-subtle">
          <div className="text-xs text-tertiary">Duree contrat</div>
          <div className="text-lg font-bold text-primary mt-1">{form.duree_contrat_annees} ans</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-5">
        {/* Left: Informations generales */}
        <Section title="Informations generales">
          <div className="space-y-3">
            <Field label="Nom du projet"><input value={form.nom} onChange={(e) => update("nom", e.target.value)} className={inputCls} /></Field>
            <Field label="Client"><input value={form.client} onChange={(e) => update("client", e.target.value)} className={inputCls} /></Field>
            <Field label="Localisation"><input value={form.localisation} onChange={(e) => update("localisation", e.target.value)} placeholder="Ville, region..." className={inputCls} /></Field>
            <Field label="Nature">
              <select value={form.nature} onChange={(e) => update("nature", e.target.value)} className={inputCls}>
                {Object.entries(NATURES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Date de remise"><input type="date" value={form.date_remise} onChange={(e) => update("date_remise", e.target.value)} className={inputCls} /></Field>
              <Field label="Date ouverture"><input type="date" value={form.date_ouverture_visee} onChange={(e) => update("date_ouverture_visee", e.target.value)} className={inputCls} /></Field>
            </div>
          </div>
        </Section>

        {/* Right: Parametres financiers + Scoring */}
        <div className="space-y-5">
          <Section title="Parametres financiers">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Frais de siege (%)"><input type="number" step="0.1" value={form.pct_frais_siege} onChange={(e) => update("pct_frais_siege", parseFloat(e.target.value))} className={inputCls} /></Field>
                <Field label="Remise commerciale (%)"><input type="number" step="0.1" value={form.remise_commerciale_pct} onChange={(e) => update("remise_commerciale_pct", parseFloat(e.target.value))} className={inputCls} /></Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Produits/achats (%)"><input type="number" step="0.1" value={form.pct_produits_achats} onChange={(e) => update("pct_produits_achats", parseFloat(e.target.value))} className={inputCls} /></Field>
                <Field label="Duree contrat (ans)"><input type="number" value={form.duree_contrat_annees} onChange={(e) => update("duree_contrat_annees", parseInt(e.target.value))} className={inputCls} /></Field>
              </div>
              <Field label="Semaines / an"><input type="number" value={form.semaines_par_an} onChange={(e) => update("semaines_par_an", parseInt(e.target.value))} className={inputCls} /></Field>
            </div>
          </Section>

          <Section title="Scoring CCTP">
            <ScoringEditor projet={projet} apiBase={apiBase} onSave={onSave} />
          </Section>
        </div>
      </div>
      <div className="flex justify-end"><SaveButton onSave={save} /></div>
    </div>
  );
}

function ScoringEditor({ projet, apiBase, onSave }: { projet: ProjetAO; apiBase: string; onSave: () => void }) {
  const [scores, setScores] = useState({
    scoring_concept_pct: projet.scoring_concept_pct, scoring_rh_pct: projet.scoring_rh_pct,
    scoring_qualite_pct: projet.scoring_qualite_pct, scoring_rse_pct: projet.scoring_rse_pct,
    scoring_prix_pct: projet.scoring_prix_pct,
  });
  const total = Object.values(scores).reduce((a, b) => a + b, 0);

  const save = async () => {
    const resp = await fetch(`${apiBase}/projets/${projet.id}/`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify(scores),
    });
    if (resp.ok) { await onSave(); toast.ok("Scoring mis a jour"); }
    else toast.err("Erreur");
  };

  return (
    <div className="space-y-2">
      {SCORE_FIELDS.map(({ key, label, icon }) => (
        <div key={key} className="flex items-center gap-2">
          <span className="text-sm w-5">{icon}</span>
          <span className="text-sm text-secondary flex-1">{label}</span>
          <input
            type="number" min={0} max={100} step={5} value={scores[key]}
            onChange={(e) => setScores({ ...scores, [key]: parseInt(e.target.value) || 0 })}
            className="w-16 h-7 px-2 rounded-md border border-border-subtle bg-layer-2 text-primary text-sm text-right"
          />
          <span className="text-xs text-tertiary w-4">%</span>
        </div>
      ))}
      <div className={`text-xs font-medium mt-1 ${total === 100 ? "text-success-secondary" : "text-danger-secondary"}`}>
        Total : {total}% {total === 100 ? "\u2713" : "(doit faire 100%)"}
      </div>
      {total === 100 && <Button variant="ghost" size="sm" onClick={save}>Sauver scoring</Button>}
    </div>
  );
}

// ─── Tab: Points de Vente ────────────────────────────────────────────────────

function TabPointsDeVente({ projet, apiBase, onSave }: { projet: ProjetAO; apiBase: string; onSave: () => void }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [adding, setAdding] = useState(false);
  const [newForm, setNewForm] = useState({ type_pdv: "self", nom: "", tranche_frequentation: 1, couverts_jour_cible: 200, jours_ouvres_mois: 20 });
  const inputCls = "w-full h-7 px-2 rounded-md border border-border-subtle bg-layer-2 text-primary text-sm";

  const savePdv = async (pdvId: string) => {
    const resp = await fetch(`${apiBase}/projets/${projet.id}/pdv/${pdvId}/`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify(editForm),
    });
    if (resp.ok) { setEditingId(null); await onSave(); toast.ok("PdV modifie"); }
    else toast.err("Erreur sauvegarde PdV");
  };

  const deletePdv = async (pdvId: string) => {
    if (!confirm("Supprimer ce point de vente ?")) return;
    const resp = await fetch(`${apiBase}/projets/${projet.id}/pdv/${pdvId}/`, { method: "DELETE", credentials: "include" });
    if (resp.ok) { await onSave(); toast.ok("PdV supprime"); }
  };

  const addPdv = async () => {
    if (!newForm.nom.trim()) { toast.err("Le nom est requis"); return; }
    const resp = await fetch(`${apiBase}/projets/${projet.id}/pdv/`, {
      method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify(newForm),
    });
    if (resp.ok) {
      setAdding(false); setNewForm({ type_pdv: "self", nom: "", tranche_frequentation: 1, couverts_jour_cible: 200, jours_ouvres_mois: 20 });
      await onSave(); toast.ok("PdV ajoute");
    } else toast.err("Erreur ajout");
  };

  return (
    <Section title={`Points de Vente (${projet.points_de_vente.length})`} action={<Button variant="primary" size="sm" onClick={() => setAdding(true)}>+ Ajouter</Button>}>
      <div className="space-y-2">
        {projet.points_de_vente.map((pdv) =>
          editingId === pdv.id ? (
            <div key={pdv.id} className="p-4 rounded-lg border-2 border-dashed border-border-strong bg-layer-1">
              <div className="grid grid-cols-5 gap-3 mb-3">
                <Field label="Type"><select value={editForm.type_pdv} onChange={(e) => setEditForm({ ...editForm, type_pdv: e.target.value })} className={inputCls}>{Object.entries(PDV_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
                <Field label="Nom"><input value={editForm.nom} onChange={(e) => setEditForm({ ...editForm, nom: e.target.value })} className={inputCls} /></Field>
                <Field label="Tranche"><input type="number" min={1} max={9} value={editForm.tranche_frequentation} onChange={(e) => setEditForm({ ...editForm, tranche_frequentation: parseInt(e.target.value) || 1 })} className={inputCls} /></Field>
                <Field label="Couverts/j"><input type="number" value={editForm.couverts_jour_cible} onChange={(e) => setEditForm({ ...editForm, couverts_jour_cible: parseInt(e.target.value) || 0 })} className={inputCls} /></Field>
                <Field label="Jours/mois"><input type="number" value={editForm.jours_ouvres_mois} onChange={(e) => setEditForm({ ...editForm, jours_ouvres_mois: parseInt(e.target.value) || 20 })} className={inputCls} /></Field>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="primary" size="sm" onClick={() => savePdv(pdv.id)}>Valider</Button>
                <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>Annuler</Button>
              </div>
            </div>
          ) : (
            <div key={pdv.id} className="flex items-center gap-4 p-3 rounded-lg border border-border-subtle bg-layer-1 hover:border-border-strong transition-colors group">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl bg-accent-primary/10">{PDV_ICONS[pdv.type_pdv] || "\uD83C\uDF7D\uFE0F"}</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-primary">{pdv.nom || PDV_LABELS[pdv.type_pdv]}</div>
                <div className="text-xs text-tertiary">{PDV_LABELS[pdv.type_pdv]}</div>
              </div>
              <div className="flex items-center gap-5">
                <TrancheBadge tranche={pdv.tranche_frequentation} />
                <Stat value={pdv.couverts_jour_cible || "\u2014"} label="cvt/j" />
                <Stat value={pdv.jours_ouvres_mois} label="j/m" />
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="sm" onClick={() => { setEditingId(pdv.id); setEditForm(pdv); }}>Editer</Button>
                <Button variant="ghost" size="sm" className="text-danger-secondary" onClick={() => deletePdv(pdv.id)}>Suppr</Button>
              </div>
            </div>
          )
        )}
        {adding && (
          <div className="p-4 rounded-lg border-2 border-dashed border-accent-primary bg-accent-primary/5">
            <div className="text-xs font-semibold text-secondary mb-3">Nouveau Point de Vente</div>
            <div className="grid grid-cols-5 gap-3 mb-3">
              <Field label="Type"><select value={newForm.type_pdv} onChange={(e) => setNewForm({ ...newForm, type_pdv: e.target.value })} className={inputCls}>{Object.entries(PDV_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
              <Field label="Nom"><input value={newForm.nom} onChange={(e) => setNewForm({ ...newForm, nom: e.target.value })} placeholder="Nom du PdV" className={inputCls} /></Field>
              <Field label="Tranche"><input type="number" min={1} max={9} value={newForm.tranche_frequentation} onChange={(e) => setNewForm({ ...newForm, tranche_frequentation: parseInt(e.target.value) || 1 })} className={inputCls} /></Field>
              <Field label="Couverts/j"><input type="number" value={newForm.couverts_jour_cible} onChange={(e) => setNewForm({ ...newForm, couverts_jour_cible: parseInt(e.target.value) || 0 })} className={inputCls} /></Field>
              <Field label="Jours/mois"><input type="number" value={newForm.jours_ouvres_mois} onChange={(e) => setNewForm({ ...newForm, jours_ouvres_mois: parseInt(e.target.value) || 20 })} className={inputCls} /></Field>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="primary" size="sm" onClick={addPdv}>Ajouter</Button>
              <Button variant="ghost" size="sm" onClick={() => setAdding(false)}>Annuler</Button>
            </div>
          </div>
        )}
        {projet.points_de_vente.length === 0 && !adding && (
          <div className="text-center py-12 text-tertiary"><p className="text-sm">Aucun point de vente</p></div>
        )}
      </div>
    </Section>
  );
}

// ─── Tab: Configuration (Mode gestion + Horaires) ────────────────────────────

function TabConfig({ projet, apiBase, onSave }: { projet: ProjetAO; apiBase: string; onSave: () => void }) {
  const [selected, setSelected] = useState(projet.mode_gestion);
  const [horaires, setHoraires] = useState(projet.horaires_service);

  const save = async () => {
    const resp = await fetch(`${apiBase}/projets/${projet.id}/`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify({ mode_gestion: selected, horaires_service: horaires }),
    });
    if (resp.ok) { await onSave(); toast.ok("Configuration enregistree"); }
    else toast.err("Erreur");
  };

  return (
    <div className="space-y-6">
      <Section title="Mode de gestion">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {MODES.map((mode) => (
            <button
              key={mode.id} onClick={() => setSelected(mode.id)}
              className={`p-4 rounded-lg border-2 text-left transition-all relative ${
                selected === mode.id
                  ? "border-accent-primary bg-accent-primary/5 shadow-sm"
                  : "border-border-subtle bg-layer-1 hover:border-border-strong hover:shadow-sm"
              }`}
            >
              {selected === mode.id && (
                <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-accent-primary text-on-color flex items-center justify-center text-xs font-bold">&check;</div>
              )}
              <div className="text-xl mb-2">{mode.icon}</div>
              <div className="text-sm font-semibold text-primary mb-1">{mode.name}</div>
              <div className="text-xs text-tertiary leading-relaxed mb-2">{mode.desc}</div>
              <div className="text-caption-xs pt-2 border-t border-border-subtle">
                <span className="text-accent-primary font-medium">Ideal : </span>
                <span className="text-tertiary">{mode.tip}</span>
              </div>
            </button>
          ))}
        </div>
      </Section>

      <Section title="Horaires de service">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Object.entries(HORAIRES).map(([key, label]) => (
            <button key={key} onClick={() => setHoraires(key)}
              className={`p-3 rounded-lg border-2 text-center text-sm font-medium transition-all ${
                horaires === key
                  ? "border-accent-primary bg-accent-primary/5 text-accent-primary"
                  : "border-border-subtle bg-layer-1 text-secondary hover:border-border-strong"
              }`}
            >{label}</button>
          ))}
        </div>
      </Section>

      <div className="flex justify-end"><SaveButton onSave={save} /></div>
    </div>
  );
}

// ─── Tab: Referentiels ───────────────────────────────────────────────────────

type RefColumn = { key: string; label: string; type: "text" | "number" | "select"; editable: boolean; options?: { value: string; label: string }[] };
type RefConfig = { key: string; label: string; endpoint: string; columns: RefColumn[]; defaultNew: Record<string, any> };

const REF_CONFIGS: RefConfig[] = [
  {
    key: "postes", label: "Postes", endpoint: "referentiels/postes/",
    columns: [
      { key: "nom", label: "Nom", type: "text", editable: true },
      { key: "qualification", label: "Qualification", type: "text", editable: true },
      { key: "salaire_brut_mensuel", label: "Salaire brut", type: "number", editable: true },
      { key: "taux_charges", label: "Taux charges", type: "number", editable: true },
      { key: "categorie", label: "Categorie", type: "select", editable: true, options: [
        { value: "cuisine", label: "Cuisine" }, { value: "salle", label: "Salle" },
        { value: "encadrement", label: "Encadrement" }, { value: "support", label: "Support" },
      ]},
      { key: "heures_mois", label: "H/mois", type: "number", editable: true },
    ],
    defaultNew: { nom: "Nouveau poste", qualification: "", salaire_brut_mensuel: 2000, taux_charges: 45, categorie: "cuisine", heures_mois: 152 },
  },
  {
    key: "fg", label: "Frais Generaux", endpoint: "referentiels/frais-generaux/",
    columns: [
      { key: "code", label: "Code", type: "text", editable: true },
      { key: "libelle", label: "Libelle", type: "text", editable: true },
      { key: "section", label: "Section", type: "text", editable: true },
      { key: "mode_calcul", label: "Mode", type: "select", editable: true, options: [
        { value: "forfait", label: "Forfait" }, { value: "ratio_couvert", label: "Ratio/cvt" },
        { value: "ratio_effectif", label: "Ratio/eff" }, { value: "pct_ca", label: "% CA" },
      ]},
      { key: "montant_reference", label: "Montant ref.", type: "number", editable: true },
    ],
    defaultNew: { code: "nouveau_fg", libelle: "Nouveau FG", section: "AUTRES", mode_calcul: "forfait", montant_reference: 0, ordre: 99 },
  },
  {
    key: "invest", label: "Investissements", endpoint: "referentiels/investissements/",
    columns: [
      { key: "code", label: "Code", type: "text", editable: true },
      { key: "libelle", label: "Libelle", type: "text", editable: true },
      { key: "section", label: "Section", type: "text", editable: true },
      { key: "montant_unitaire", label: "Montant unit.", type: "number", editable: true },
      { key: "quantite_defaut", label: "Qte", type: "number", editable: true },
      { key: "duree_amortissement", label: "Amort. (ans)", type: "number", editable: true },
    ],
    defaultNew: { code: "nouveau_inv", libelle: "Nouvel investissement", section: "AUTRES", montant_unitaire: 0, quantite_defaut: 1, duree_amortissement: 5 },
  },
  {
    key: "taux", label: "Taux Charges", endpoint: "referentiels/taux-charges/",
    columns: [
      { key: "tranche", label: "Tranche", type: "number", editable: false },
      { key: "taux", label: "Taux", type: "number", editable: true },
    ],
    defaultNew: { tranche: 0, taux: 0.65 },
  },
  {
    key: "tranches", label: "Tranches", endpoint: "referentiels/tranches/",
    columns: [
      { key: "numero", label: "N\u00B0", type: "number", editable: false },
      { key: "borne_min", label: "Min", type: "number", editable: true },
      { key: "borne_max", label: "Max", type: "number", editable: true },
      { key: "mediane", label: "Mediane", type: "number", editable: true },
    ],
    defaultNew: { numero: 11, borne_min: 0, borne_max: 0, mediane: 0 },
  },
  {
    key: "produits", label: "Produits", endpoint: "referentiels/produits/",
    columns: [
      { key: "designation", label: "Designation", type: "text", editable: true },
      { key: "famille", label: "Famille", type: "text", editable: true },
      { key: "gamme", label: "Gamme", type: "text", editable: true },
      { key: "prix_ht_reference", label: "Prix HT", type: "number", editable: true },
    ],
    defaultNew: { designation: "Nouveau produit", famille: "", gamme: "Frais", categorie: "", prix_ht_reference: null, types_pdv: ["self"], actif: true },
  },
];

function TabReferentiels({ projet, apiBase }: { projet: ProjetAO; apiBase: string }) {
  const [subTab, setSubTab] = useState("postes");
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editCell, setEditCell] = useState<{ id: number; key: string } | null>(null);
  const [editVal, setEditVal] = useState<any>(null);
  const [adding, setAdding] = useState(false);

  const config = REF_CONFIGS.find((c) => c.key === subTab)!;

  // Fetch counts for all tabs on mount
  useEffect(() => {
    REF_CONFIGS.forEach((cfg) => {
      fetch(`${apiBase}/${cfg.endpoint}`, { credentials: "include" })
        .then((r) => r.json())
        .then((d) => {
          const arr = Array.isArray(d) ? d : d.results || [];
          setCounts((prev) => ({ ...prev, [cfg.key]: arr.length }));
        })
        .catch(() => {});
    });
  }, [apiBase]);

  // Fetch data for active tab
  const fetchData = useCallback(() => {
    setLoading(true);
    fetch(`${apiBase}/${config.endpoint}`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        const arr = Array.isArray(d) ? d : d.results || [];
        setData(arr);
        setCounts((prev) => ({ ...prev, [subTab]: arr.length }));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [apiBase, config.endpoint, subTab]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // PATCH a single field
  const patchItem = async (id: number, field: string, value: any) => {
    const resp = await fetch(`${apiBase}/${config.endpoint}${id}/`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify({ [field]: value }),
    });
    if (resp.ok) { fetchData(); toast.ok("Modifie"); }
    else toast.err("Erreur sauvegarde");
    setEditCell(null);
  };

  // POST a new item
  const addItem = async () => {
    setAdding(true);
    const resp = await fetch(`${apiBase}/${config.endpoint}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify(config.defaultNew),
    });
    setAdding(false);
    if (resp.ok) { fetchData(); toast.ok("Ajoute"); }
    else toast.err("Erreur creation");
  };

  // DELETE an item
  const deleteItem = async (id: number) => {
    if (!confirm("Supprimer cette ligne ?")) return;
    const resp = await fetch(`${apiBase}/${config.endpoint}${id}/`, { method: "DELETE", credentials: "include" });
    if (resp.ok) { fetchData(); toast.ok("Supprime"); }
    else toast.err("Erreur suppression");
  };

  return (
    <div className="space-y-4">
      {/* Sub-tabs with counts */}
      <div className="flex gap-1 border-b border-border-subtle overflow-x-auto">
        {REF_CONFIGS.map((cfg) => {
          const count = counts[cfg.key];
          return (
            <button key={cfg.key} onClick={() => { setSubTab(cfg.key); setEditCell(null); }}
              className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                subTab === cfg.key ? "border-accent-primary text-primary" : "border-transparent text-tertiary hover:text-secondary"
              }`}
            >
              {cfg.label}{count != null && count > 0 ? ` (${count})` : ""}
            </button>
          );
        })}
      </div>

      {/* Header + Add button */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-tertiary">Cliquez sur une valeur pour la modifier</div>
        <Button variant="primary" size="sm" onClick={addItem} disabled={adding} loading={adding}>+ Ajouter</Button>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border-subtle overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-tertiary text-sm">Chargement...</div>
        ) : data.length === 0 ? (
          <div className="p-8 text-center text-tertiary text-sm">Aucun element. Cliquez "Ajouter" pour commencer.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-layer-1">
                  {config.columns.map((col) => (
                    <th key={col.key} className="text-left px-3 py-2 text-caption-xs font-semibold text-tertiary uppercase">{col.label}</th>
                  ))}
                  <th className="w-10 px-2"></th>
                </tr>
              </thead>
              <tbody>
                {data.map((item) => (
                  <tr key={item.id} className="border-t border-border-subtle hover:bg-layer-transparent-hover group">
                    {config.columns.map((col) => {
                      const isEditing = editCell?.id === item.id && editCell?.key === col.key;
                      const cellVal = item[col.key];
                      return (
                        <td key={col.key} className="px-3 py-1.5">
                          {isEditing ? (
                            col.type === "select" ? (
                              <select autoFocus value={editVal} onChange={(e) => patchItem(item.id, col.key, e.target.value)}
                                onBlur={() => setEditCell(null)}
                                className="w-full h-7 px-2 rounded border border-accent-primary bg-layer-2 text-primary text-sm focus:outline-none"
                              >
                                {col.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                              </select>
                            ) : (
                              <input autoFocus type={col.type === "number" ? "number" : "text"}
                                step={col.type === "number" ? "0.01" : undefined}
                                value={editVal ?? ""} onChange={(e) => setEditVal(col.type === "number" ? parseFloat(e.target.value) || 0 : e.target.value)}
                                onBlur={() => patchItem(item.id, col.key, editVal)}
                                onKeyDown={(e) => { if (e.key === "Enter") patchItem(item.id, col.key, editVal); if (e.key === "Escape") setEditCell(null); }}
                                className="w-full h-7 px-2 rounded border border-accent-primary bg-layer-2 text-primary text-sm focus:outline-none"
                              />
                            )
                          ) : (
                            <span
                              className={col.editable ? "cursor-pointer hover:bg-layer-1-hover px-2 py-1 -mx-1 rounded transition-colors text-primary" : "text-secondary"}
                              onClick={() => { if (col.editable) { setEditCell({ id: item.id, key: col.key }); setEditVal(cellVal); } }}
                            >
                              {col.type === "select" && col.options
                                ? col.options.find((o) => o.value === cellVal)?.label || cellVal
                                : typeof cellVal === "number" ? (cellVal % 1 === 0 ? cellVal : cellVal.toFixed(2)) : cellVal ?? "\u2014"}
                            </span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-2 py-1.5">
                      <button onClick={() => deleteItem(item.id)} className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-danger-subtle text-tertiary hover:text-danger-secondary transition-all" title="Supprimer">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tab: Simulation ─────────────────────────────────────────────────────────

type SimResult = {
  activity: { couverts_mois: number; ca_mensuel: number };
  staffing: { etp_total: number; masse_chargee_mensuelle: number; detail_postes: any[] };
  matiere: { cout_matiere_mensuel: number; cout_par_couvert: number };
  fg: { fg_mensuel: number };
  invest: { invest_total: number; amortissement_mensuel: number };
  pl: { ca_total: number; ca_total_annuel: number; cout_matiere: number; masse_salariale: number; frais_generaux: number; amortissements: number; total_charges: number; resultat: number; resultat_annuel: number; marge_pct: number; ratio_matiere_pct: number; ratio_personnel_pct: number; ratio_fg_pct: number };
  kpis: { cout_par_couvert: number };
  score_estime: { total: number; prix: number; concept: number; rh: number; rse: number; qualite: number };
  _elapsed_ms?: number;
};

function TabScenarios({ projet, apiBase }: { projet: ProjetAO; apiBase: string }) {
  const [params, setParams] = useState<any>({
    niveau_prix: "prix_standard", prix_admission: 6.50, prix_plateau_moyen: 8.50, prix_vente_bpu: 6.00,
    pct_externes: 0.20, penetration: 0.90, saisonnalite: 1.0, mutualisation: "none",
    subvention_employeur_pct: 0.40, marge_gestion_pct: 0.06,
  });
  const [sim, setSim] = useState<SimResult | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [scenarios, setScenarios] = useState<any[]>([]);
  const [newName, setNewName] = useState("");
  const inputCls = "w-full h-7 px-2 rounded-md border border-border-subtle bg-layer-2 text-primary text-sm";

  useEffect(() => {
    fetch(`${apiBase}/projets/${projet.id}/scenarios/`, { credentials: "include" })
      .then((r) => r.json()).then((d) => { const arr = Array.isArray(d) ? d : d.results || []; setScenarios(arr); })
      .catch(() => {});
  }, [apiBase, projet.id]);

  useEffect(() => {
    const t = setTimeout(async () => {
      setSimulating(true);
      try {
        const r = await fetch(`${apiBase}/projets/${projet.id}/simuler/`, {
          method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
          body: JSON.stringify({ parametres: params }),
        });
        if (r.ok) setSim(await r.json());
      } finally { setSimulating(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [params, apiBase, projet.id]);

  const saveScenario = async () => {
    const name = newName || `Scenario ${scenarios.length + 1}`;
    const r = await fetch(`${apiBase}/projets/${projet.id}/scenarios/`, {
      method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify({ nom: name, parametres: params, resultats: sim }),
    });
    if (r.ok) { const d = await r.json(); setScenarios([...scenarios, d]); setNewName(""); toast.ok(`Scenario "${name}" sauvegarde`); }
  };

  const fmtEur = (v?: number) => v == null ? "\u2014" : new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);
  const fmtPct = (v?: number) => v == null ? "\u2014" : `${v.toFixed(1)}%`;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      {/* Params panel */}
      <div className="lg:col-span-4">
        <Section title="Parametres">
          <div className="space-y-3">
            <Field label="Niveau prix matiere">
              <select value={params.niveau_prix} onChange={(e) => setParams({ ...params, niveau_prix: e.target.value })} className={inputCls}>
                <option value="prix_eco">Economique</option>
                <option value="prix_standard">Standard</option>
                <option value="prix_premium">Premium</option>
                <option value="prix_luxe">Luxe</option>
              </select>
            </Field>
            <SliderField label="Penetration" value={params.penetration} min={0.3} max={1} step={0.05} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => setParams({ ...params, penetration: v })} />
            <SliderField label="Saisonnalite" value={params.saisonnalite} min={0.6} max={1.4} step={0.05} format={(v) => `x${v.toFixed(2)}`} onChange={(v) => setParams({ ...params, saisonnalite: v })} />
            {projet.points_de_vente.length > 1 && (
              <Field label="Mutualisation">
                <select value={params.mutualisation} onChange={(e) => setParams({ ...params, mutualisation: e.target.value })} className={inputCls}>
                  <option value="none">Aucune</option>
                  <option value="scenario_1_3">Scenario 1&3 (-30%)</option>
                  <option value="scenario_2">Scenario 2 (-50%)</option>
                </select>
              </Field>
            )}
            <div className="pt-3 border-t border-border-subtle">
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nom du scenario" className={inputCls + " mb-2"} />
              <Button variant="secondary" size="base" className="w-full" onClick={saveScenario}>Sauvegarder scenario</Button>
            </div>
          </div>
        </Section>
      </div>

      {/* Results panel */}
      <div className="lg:col-span-8 space-y-4">
        {sim && (
          <>
            <div className="flex items-center gap-3">
              <div className="px-3 py-1.5 rounded-lg bg-accent-primary/10 flex items-center gap-2">
                <span className="text-xl font-bold text-accent-primary">{sim.score_estime.total}</span>
                <span className="text-caption-xs text-tertiary">/ 100</span>
              </div>
              {simulating && <span className="inline-block w-4 h-4 border-2 border-border-subtle border-t-accent-primary rounded-full animate-spin" />}
              {sim._elapsed_ms != null && <span className="text-caption-xs text-tertiary">{sim._elapsed_ms}ms</span>}
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <KPICard label="CA mensuel" value={fmtEur(sim.pl.ca_total)} sub={`${sim.activity.couverts_mois} cvts`} />
              <KPICard label="Masse salariale" value={fmtEur(sim.staffing.masse_chargee_mensuelle)} sub={`${sim.staffing.etp_total.toFixed(1)} ETP`} />
              <KPICard label="Cout matiere" value={fmtEur(sim.matiere.cout_matiere_mensuel)} sub={`${sim.matiere.cout_par_couvert.toFixed(2)}\u20AC/cvt`} />
              <KPICard label="Resultat" value={fmtEur(sim.pl.resultat)} sub={fmtPct(sim.pl.marge_pct)} accent={sim.pl.resultat >= 0} />
            </div>

            <Section title="Compte de Resultat (mensuel)">
              <table className="w-full text-sm">
                <tbody>
                  <PLRow label="CA Total" value={fmtEur(sim.pl.ca_total)} bold />
                  <PLRow label="Cout matiere" value={`- ${fmtEur(sim.pl.cout_matiere)}`} pct={fmtPct(sim.pl.ratio_matiere_pct)} />
                  <PLRow label="Masse salariale" value={`- ${fmtEur(sim.pl.masse_salariale)}`} pct={fmtPct(sim.pl.ratio_personnel_pct)} />
                  <PLRow label="Frais generaux" value={`- ${fmtEur(sim.pl.frais_generaux)}`} pct={fmtPct(sim.pl.ratio_fg_pct)} />
                  <PLRow label="Amortissements" value={`- ${fmtEur(sim.pl.amortissements)}`} />
                  <PLRow label="Total charges" value={`- ${fmtEur(sim.pl.total_charges)}`} bold />
                  <PLRow label="RESULTAT" value={fmtEur(sim.pl.resultat)} bold accent={sim.pl.resultat >= 0} />
                  <PLRow label="Resultat annualise" value={fmtEur(sim.pl.resultat_annuel)} muted />
                </tbody>
              </table>
            </Section>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Tab: Documents & Generation ─────────────────────────────────────────────

function TabDocuments({ projet, apiBase, onSave }: { projet: ProjetAO; apiBase: string; onSave: () => void }) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState<Record<string, boolean>>({});
  const [scenarios, setScenarios] = useState<any[]>([]);
  const [selectedScenarioId, setSelectedScenarioId] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`${apiBase}/projets/${projet.id}/scenarios/`, { credentials: "include" })
      .then((r) => r.json()).then((d) => { const arr = Array.isArray(d) ? d : d.results || []; setScenarios(arr); if (arr.length) setSelectedScenarioId(arr[0].id); })
      .catch(() => {});
  }, [apiBase, projet.id]);

  const upload = async (file: File) => {
    setUploading(true);
    const fd = new FormData(); fd.append("cctp_pdf", file);
    const resp = await fetch(`${apiBase}/projets/${projet.id}/`, { method: "PATCH", credentials: "include", body: fd });
    setUploading(false);
    if (resp.ok) { await onSave(); toast.ok("Document uploade"); } else toast.err("Erreur upload");
  };

  const generate = async (kind: string) => {
    setGenerating({ ...generating, [kind]: true });
    try {
      const url = kind === "tout" ? `${apiBase}/projets/${projet.id}/generer-tout/` : `${apiBase}/projets/${projet.id}/generer-${kind}/`;
      const r = await fetch(url, {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ scenario_id: selectedScenarioId || null }),
      });
      if (!r.ok) { toast.err("Erreur generation"); return; }
      const blob = await r.blob();
      const cd = r.headers.get("content-disposition") || "";
      const m = cd.match(/filename="(.+?)"/);
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = m ? m[1] : `${kind}.xlsx`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      toast.ok("Telechargement OK");
    } finally { setGenerating({ ...generating, [kind]: false }); }
  };

  return (
    <div className="space-y-6">
      {/* Upload section */}
      <Section title="Documents du projet">
        <div className="rounded-lg border border-border-subtle p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-sm font-medium text-primary">CCTP / Cahier des charges</div>
              <div className="text-xs text-tertiary">{projet.cctp_pdf ? "Document charge" : "Aucun document"}</div>
            </div>
            <label>
              <Button variant="secondary" size="sm" className="cursor-pointer">{uploading ? "Upload..." : projet.cctp_pdf ? "Remplacer" : "Uploader"}</Button>
              <input ref={inputRef} type="file" accept=".pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }} />
            </label>
          </div>
          {!projet.cctp_pdf && (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f?.type === "application/pdf") upload(f); }}
              onClick={() => inputRef.current?.click()}
              className={`py-8 rounded-lg text-center cursor-pointer border-2 border-dashed transition-colors ${
                dragging ? "border-accent-primary bg-accent-primary/5" : "border-border-subtle hover:border-border-strong"
              }`}
            >
              <div className="text-2xl mb-1">\uD83D\uDCC4</div>
              <div className="text-sm text-secondary">{dragging ? "Deposer ici" : "Glisser-deposer ou cliquer"}</div>
              <div className="text-xs text-tertiary mt-1">PDF uniquement</div>
            </div>
          )}
          {projet.cctp_pdf && <iframe src={projet.cctp_pdf} className="w-full h-52 rounded border border-border-subtle mt-2" title="CCTP" />}
        </div>
      </Section>

      {/* Generation section */}
      <Section title="Generation Excel">
        {scenarios.length > 0 && (
          <div className="mb-4">
            <Field label="Scenario">
              <select value={selectedScenarioId} onChange={(e) => setSelectedScenarioId(e.target.value)}
                className="w-full max-w-sm h-8 px-3 rounded-md border border-border-subtle bg-layer-2 text-primary text-sm"
              >
                {scenarios.map((s) => <option key={s.id} value={s.id}>{s.nom}</option>)}
              </select>
            </Field>
          </div>
        )}

        <div className="grid grid-cols-3 gap-4 mb-4">
          {[
            { kind: "bpu", icon: "\uD83D\uDCCA", title: "BPU Alimentaires", desc: "25 onglets" },
            { kind: "budget", icon: "\uD83D\uDCB6", title: "Budget Previsionnel", desc: "5 onglets" },
            { kind: "cout-fixe", icon: "\uD83D\uDCCB", title: "Cout Fixe", desc: "20 onglets" },
          ].map((c) => (
            <button key={c.kind} onClick={() => generate(c.kind)} disabled={generating[c.kind]}
              className="p-4 rounded-lg border border-border-subtle bg-layer-1 text-left hover:border-border-strong hover:shadow-sm transition-all disabled:opacity-50"
            >
              <div className="text-2xl mb-2">{c.icon}</div>
              <div className="text-sm font-semibold text-primary">{c.title}</div>
              <div className="text-xs text-tertiary">{c.desc}</div>
              {generating[c.kind] && <span className="inline-block w-3 h-3 border border-border-subtle border-t-accent-primary rounded-full animate-spin mt-2" />}
            </button>
          ))}
        </div>

        <Button variant="primary" size="xl" className="w-full" onClick={() => generate("tout")} disabled={generating["tout"]} loading={generating["tout"]}>
          Telecharger tout le dossier (.zip)
        </Button>
      </Section>
    </div>
  );
}

// ─── Shared Components ───────────────────────────────────────────────────────

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border-subtle bg-surface-1 overflow-hidden">
      <div className="px-5 py-3 border-b border-border-subtle bg-layer-1 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-primary">{title}</h2>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-caption-xs font-semibold text-tertiary uppercase tracking-wide mb-1">{label}</label>
      {children}
    </div>
  );
}

function TrancheBadge({ tranche }: { tranche: number }) {
  const cls = tranche <= 3 ? "bg-success-primary/10 text-success-secondary"
    : tranche <= 6 ? "bg-accent-primary/10 text-accent-primary"
    : "bg-warning-primary/10 text-warning-secondary";
  return (
    <div className={`flex flex-col items-center px-2.5 py-1 rounded-md ${cls}`}>
      <span className="text-sm font-bold leading-none">T{tranche}</span>
      <span className="text-caption-xs uppercase tracking-wider opacity-80">tranche</span>
    </div>
  );
}

function Stat({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="text-center min-w-[40px]">
      <div className="text-base font-bold text-primary leading-none">{value}</div>
      <div className="text-caption-xs text-tertiary uppercase tracking-wider mt-0.5">{label}</div>
    </div>
  );
}

function KPICard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className="p-3 rounded-lg bg-layer-1 border border-border-subtle">
      <div className="text-caption-xs text-tertiary uppercase tracking-wide">{label}</div>
      <div className={`text-lg font-bold mt-1 ${accent === false ? "text-danger-secondary" : accent === true ? "text-success-secondary" : "text-primary"}`}>{value}</div>
      {sub && <div className="text-xs text-tertiary mt-0.5">{sub}</div>}
    </div>
  );
}

function PLRow({ label, value, pct, bold, muted, accent }: { label: string; value: string; pct?: string; bold?: boolean; muted?: boolean; accent?: boolean }) {
  return (
    <tr className="border-b border-border-subtle last:border-b-0">
      <td className={`px-4 py-2 text-sm ${bold ? "font-semibold text-primary" : muted ? "text-tertiary" : "text-secondary"}`}>{label}</td>
      <td className={`px-4 py-2 text-sm text-right tabular-nums ${bold ? "font-bold" : ""} ${
        accent === true ? "text-success-secondary" : accent === false ? "text-danger-secondary" : muted ? "text-tertiary" : "text-primary"
      }`}>{value}</td>
      <td className="px-3 py-2 text-xs text-right text-tertiary w-16">{pct || ""}</td>
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
        <label className="text-caption-xs font-semibold text-tertiary uppercase tracking-wide">{label}</label>
        <span className="text-sm font-semibold text-accent-primary">{format ? format(value) : value}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} className="w-full accent-accent-primary" />
    </div>
  );
}
