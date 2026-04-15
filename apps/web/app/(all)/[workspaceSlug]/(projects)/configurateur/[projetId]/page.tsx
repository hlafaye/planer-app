// Planer custom: Configurateur AO — detail page with status stepper + tabs
"use client";

import { useParams } from "next/navigation";
import { useState, useEffect, useCallback } from "react";

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

// ─── Constants ───────────────────────────────────────────────────────────────

const STEPS = [
  { key: "draft", label: "Brouillon" },
  { key: "en_cours", label: "En cours" },
  { key: "fige", label: "Fige" },
  { key: "remis", label: "Remis" },
  { key: "gagne", label: "Gagne" },
];

const PDV_TYPES: Record<string, string> = {
  self: "Self-Service",
  cafeteria: "Cafeteria",
  brasserie: "Brasserie",
  room_service: "Room Service",
  club_vip: "Club VIP",
  da: "Distributeur Auto",
  dflab: "Digital Food Lab",
};

const NATURES: Record<string, string> = {
  ouverture: "Ouverture",
  reprise: "Reprise",
  renouvellement: "Renouvellement",
};

const MODES_GESTION: Record<string, string> = {
  masse_frais: "Masse de frais",
  admission: "Admission / Subvention",
  mixte: "Mixte",
  ticket: "Tout sur le ticket",
  custom: "Autre / Custom",
};

const HORAIRES: Record<string, string> = {
  midi: "Midi",
  midi_soir: "Midi + Soir",
  continu: "Continu",
  pdj_midi: "Petit-dej + Midi",
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
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ statut }),
    });
    if (resp.ok) {
      const data = await resp.json();
      setProjet(data);
    } else {
      alert("Erreur changement de statut");
    }
  };

  const dupliquer = async () => {
    const resp = await fetch(`${apiBase}/projets/${projetId}/dupliquer/`, {
      method: "POST",
      credentials: "include",
    });
    if (resp.ok) {
      const data = await resp.json();
      window.location.assign(`/${workspaceSlug}/configurateur/${data.id}`);
    } else {
      alert("Erreur duplication");
    }
  };

  const supprimer = async () => {
    if (!confirm("Supprimer ce projet AO ? Cette action est irreversible.")) return;
    const resp = await fetch(`${apiBase}/projets/${projetId}/`, {
      method: "DELETE",
      credentials: "include",
    });
    if (resp.ok) {
      window.location.assign(`/${workspaceSlug}/configurateur`);
    } else {
      alert("Erreur suppression");
    }
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
          <a href={`/${workspaceSlug}/configurateur`} className="text-[#BF5D48] text-sm mt-2 inline-block">
            Retour a la liste
          </a>
        </div>
      </div>
    );
  }

  const tabs = [
    { key: "general", label: "General" },
    { key: "pdv", label: `Points de Vente (${projet.points_de_vente.length})` },
    { key: "gestion", label: "Mode de gestion" },
    { key: "scoring", label: "Scoring CCTP" },
    { key: "docs", label: "Documents" },
  ];

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <a
              href={`/${workspaceSlug}/configurateur`}
              className="text-custom-text-400 hover:text-custom-text-200 text-sm no-underline"
            >
              &larr; Retour
            </a>
            <div>
              <h1 className="text-lg font-bold text-custom-text-100">{projet.nom}</h1>
              <p className="text-xs text-custom-text-400">
                {projet.client}
                {projet.date_remise && <> &middot; Remise le {new Date(projet.date_remise).toLocaleDateString("fr-FR")}</>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 relative">
            <button
              onClick={dupliquer}
              className="px-3 py-1.5 rounded-lg border border-custom-border-200 text-custom-text-200 text-sm hover:bg-custom-background-90/50"
            >
              Dupliquer
            </button>
            <div className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="px-2 py-1.5 rounded-lg border border-custom-border-200 text-custom-text-200 text-sm hover:bg-custom-background-90/50"
              >
                &#8942;
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-full mt-1 w-44 rounded-lg border border-custom-border-200 bg-custom-background-100 shadow-lg z-50">
                  <button
                    onClick={() => { changeStatut("perdu"); setMenuOpen(false); }}
                    className="w-full text-left px-3 py-2 text-sm text-custom-text-200 hover:bg-custom-background-90/50"
                  >
                    Marquer Perdu
                  </button>
                  <button
                    onClick={() => { supprimer(); setMenuOpen(false); }}
                    className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-red-500/10"
                  >
                    Supprimer
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Status Stepper */}
        <StatusStepper current={projet.statut} onChange={changeStatut} />

        {/* Tabs */}
        <div className="flex gap-0 border-b border-custom-border-200 mb-6">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? "border-[#BF5D48] text-custom-text-100"
                  : "border-transparent text-custom-text-400 hover:text-custom-text-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === "general" && <TabGeneral projet={projet} apiBase={apiBase} onSave={fetchProjet} />}
        {activeTab === "pdv" && <TabPointsDeVente projet={projet} apiBase={apiBase} onSave={fetchProjet} />}
        {activeTab === "gestion" && <TabModeGestion projet={projet} apiBase={apiBase} onSave={fetchProjet} />}
        {activeTab === "scoring" && <TabScoring projet={projet} apiBase={apiBase} onSave={fetchProjet} />}
        {activeTab === "docs" && <TabDocuments projet={projet} apiBase={apiBase} onSave={fetchProjet} />}
      </div>
    </div>
  );
}

// ─── Status Stepper ──────────────────────────────────────────────────────────

function StatusStepper({ current, onChange }: { current: string; onChange: (s: string) => void }) {
  const currentIdx = STEPS.findIndex((s) => s.key === current);

  return (
    <div className="flex mb-6 rounded-xl overflow-hidden border border-custom-border-200">
      {STEPS.map((step, i) => {
        const isDone = i < currentIdx;
        const isActive = i === currentIdx;
        return (
          <button
            key={step.key}
            onClick={() => onChange(step.key)}
            className={`flex-1 py-3 px-2 text-center text-sm transition-all border-r last:border-r-0 border-custom-border-200 ${
              isActive
                ? "bg-[#BF5D48] text-white font-semibold"
                : isDone
                  ? "bg-[#BF5D48]/10 text-custom-text-200"
                  : "bg-custom-background-100 text-custom-text-400 hover:bg-custom-background-90/50"
            }`}
          >
            {step.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Tab: General ────────────────────────────────────────────────────────────

function TabGeneral({ projet, apiBase, onSave }: { projet: ProjetAO; apiBase: string; onSave: () => void }) {
  const [form, setForm] = useState({
    nom: projet.nom,
    client: projet.client,
    localisation: projet.localisation || "",
    date_remise: projet.date_remise || "",
    date_ouverture_visee: projet.date_ouverture_visee || "",
    nature: projet.nature,
    perimetre: projet.perimetre,
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const resp = await fetch(`${apiBase}/projets/${projet.id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });
      if (resp.ok) {
        await onSave();
      } else {
        alert("Erreur sauvegarde");
      }
    } finally {
      setSaving(false);
    }
  };

  const update = (key: string, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="rounded-xl border border-custom-border-200 bg-custom-background-100 p-6">
      <h2 className="text-sm font-semibold text-custom-text-100 mb-4">Informations generales</h2>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Nom du projet *">
          <input
            value={form.nom}
            onChange={(e) => update("nom", e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-custom-border-200 bg-custom-background-90 text-custom-text-100 text-sm"
          />
        </Field>
        <Field label="Client *">
          <input
            value={form.client}
            onChange={(e) => update("client", e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-custom-border-200 bg-custom-background-90 text-custom-text-100 text-sm"
          />
        </Field>
        <Field label="Localisation">
          <input
            value={form.localisation}
            onChange={(e) => update("localisation", e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-custom-border-200 bg-custom-background-90 text-custom-text-100 text-sm"
          />
        </Field>
        <Field label="Nature de l'AO">
          <select
            value={form.nature}
            onChange={(e) => update("nature", e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-custom-border-200 bg-custom-background-90 text-custom-text-100 text-sm"
          >
            {Object.entries(NATURES).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </Field>
        <Field label="Date de remise">
          <input
            type="date"
            value={form.date_remise}
            onChange={(e) => update("date_remise", e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-custom-border-200 bg-custom-background-90 text-custom-text-100 text-sm"
          />
        </Field>
        <Field label="Date d'ouverture visee">
          <input
            type="date"
            value={form.date_ouverture_visee}
            onChange={(e) => update("date_ouverture_visee", e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-custom-border-200 bg-custom-background-90 text-custom-text-100 text-sm"
          />
        </Field>
      </div>
      <div className="mt-6 flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 rounded-lg bg-[#BF5D48] text-white text-sm font-medium hover:bg-[#a84d3b] disabled:opacity-50"
        >
          {saving ? "Enregistrement..." : "Enregistrer"}
        </button>
      </div>
    </div>
  );
}

// ─── Tab: Points de Vente ────────────────────────────────────────────────────

function TabPointsDeVente({ projet, apiBase, onSave }: { projet: ProjetAO; apiBase: string; onSave: () => void }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [adding, setAdding] = useState(false);
  const [newForm, setNewForm] = useState({
    type_pdv: "self",
    nom: "",
    tranche_frequentation: 1,
    couverts_jour_cible: 0,
    jours_ouvres_mois: 20,
  });

  const savePdv = async (pdvId: string) => {
    const resp = await fetch(`${apiBase}/projets/${projet.id}/pdv/${pdvId}/`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(editForm),
    });
    if (resp.ok) {
      setEditingId(null);
      await onSave();
    } else {
      alert("Erreur sauvegarde PdV");
    }
  };

  const deletePdv = async (pdvId: string) => {
    if (!confirm("Supprimer ce point de vente ?")) return;
    const resp = await fetch(`${apiBase}/projets/${projet.id}/pdv/${pdvId}/`, {
      method: "DELETE",
      credentials: "include",
    });
    if (resp.ok) await onSave();
  };

  const addPdv = async () => {
    if (!newForm.nom.trim()) {
      alert("Le nom est requis");
      return;
    }
    const resp = await fetch(`${apiBase}/projets/${projet.id}/pdv/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(newForm),
    });
    if (resp.ok) {
      setAdding(false);
      setNewForm({ type_pdv: "self", nom: "", tranche_frequentation: 1, couverts_jour_cible: 0, jours_ouvres_mois: 20 });
      await onSave();
    } else {
      alert("Erreur ajout PdV");
    }
  };

  const inputCls = "w-full px-2 py-1 rounded border border-custom-border-200 bg-custom-background-90 text-custom-text-100 text-sm";

  return (
    <div className="rounded-xl border border-custom-border-200 bg-custom-background-100 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-custom-text-100">
          Points de Vente ({projet.points_de_vente.length})
        </h2>
        <button
          onClick={() => setAdding(true)}
          className="px-3 py-1.5 rounded-lg bg-[#BF5D48] text-white text-sm hover:bg-[#a84d3b]"
        >
          + Ajouter un PdV
        </button>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-custom-border-200">
            <th className="text-left px-3 py-2 text-[10px] font-semibold text-custom-text-400 uppercase">Type</th>
            <th className="text-left px-3 py-2 text-[10px] font-semibold text-custom-text-400 uppercase">Nom</th>
            <th className="text-left px-3 py-2 text-[10px] font-semibold text-custom-text-400 uppercase">Tranche</th>
            <th className="text-left px-3 py-2 text-[10px] font-semibold text-custom-text-400 uppercase">Couverts/j</th>
            <th className="text-left px-3 py-2 text-[10px] font-semibold text-custom-text-400 uppercase">Jours/mois</th>
            <th className="px-3 py-2 w-24"></th>
          </tr>
        </thead>
        <tbody>
          {projet.points_de_vente.map((pdv) =>
            editingId === pdv.id ? (
              <tr key={pdv.id} className="border-b border-custom-border-100">
                <td className="px-3 py-2">
                  <select value={editForm.type_pdv} onChange={(e) => setEditForm({ ...editForm, type_pdv: e.target.value })} className={inputCls}>
                    {Object.entries(PDV_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </td>
                <td className="px-3 py-2"><input value={editForm.nom} onChange={(e) => setEditForm({ ...editForm, nom: e.target.value })} className={inputCls} /></td>
                <td className="px-3 py-2"><input type="number" min={1} max={9} value={editForm.tranche_frequentation} onChange={(e) => setEditForm({ ...editForm, tranche_frequentation: parseInt(e.target.value) || 1 })} className={inputCls} /></td>
                <td className="px-3 py-2"><input type="number" value={editForm.couverts_jour_cible} onChange={(e) => setEditForm({ ...editForm, couverts_jour_cible: parseInt(e.target.value) || 0 })} className={inputCls} /></td>
                <td className="px-3 py-2"><input type="number" value={editForm.jours_ouvres_mois} onChange={(e) => setEditForm({ ...editForm, jours_ouvres_mois: parseInt(e.target.value) || 20 })} className={inputCls} /></td>
                <td className="px-3 py-2 flex gap-1">
                  <button onClick={() => savePdv(pdv.id)} className="px-2 py-1 rounded bg-emerald-600 text-white text-xs">OK</button>
                  <button onClick={() => setEditingId(null)} className="px-2 py-1 rounded border border-custom-border-200 text-custom-text-400 text-xs">X</button>
                </td>
              </tr>
            ) : (
              <tr key={pdv.id} className="border-b border-custom-border-100 hover:bg-custom-background-90/30">
                <td className="px-3 py-2 text-custom-text-200">{pdv.type_pdv_display}</td>
                <td className="px-3 py-2 text-custom-text-100 font-medium">{pdv.nom}</td>
                <td className="px-3 py-2 text-custom-text-400">T{pdv.tranche_frequentation}</td>
                <td className="px-3 py-2 text-custom-text-400">{pdv.couverts_jour_cible}</td>
                <td className="px-3 py-2 text-custom-text-400">{pdv.jours_ouvres_mois}</td>
                <td className="px-3 py-2 flex gap-1">
                  <button
                    onClick={() => { setEditingId(pdv.id); setEditForm({ type_pdv: pdv.type_pdv, nom: pdv.nom, tranche_frequentation: pdv.tranche_frequentation, couverts_jour_cible: pdv.couverts_jour_cible, jours_ouvres_mois: pdv.jours_ouvres_mois }); }}
                    className="px-2 py-1 rounded border border-custom-border-200 text-custom-text-400 text-xs hover:text-custom-text-200"
                  >
                    Editer
                  </button>
                  <button
                    onClick={() => deletePdv(pdv.id)}
                    className="px-2 py-1 rounded border border-custom-border-200 text-red-400 text-xs hover:bg-red-500/10"
                  >
                    Suppr
                  </button>
                </td>
              </tr>
            )
          )}
          {adding && (
            <tr className="border-b border-custom-border-100 bg-custom-background-90/20">
              <td className="px-3 py-2">
                <select value={newForm.type_pdv} onChange={(e) => setNewForm({ ...newForm, type_pdv: e.target.value })} className={inputCls}>
                  {Object.entries(PDV_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </td>
              <td className="px-3 py-2"><input value={newForm.nom} onChange={(e) => setNewForm({ ...newForm, nom: e.target.value })} placeholder="Nom du PdV" className={inputCls} /></td>
              <td className="px-3 py-2"><input type="number" min={1} max={9} value={newForm.tranche_frequentation} onChange={(e) => setNewForm({ ...newForm, tranche_frequentation: parseInt(e.target.value) || 1 })} className={inputCls} /></td>
              <td className="px-3 py-2"><input type="number" value={newForm.couverts_jour_cible} onChange={(e) => setNewForm({ ...newForm, couverts_jour_cible: parseInt(e.target.value) || 0 })} className={inputCls} /></td>
              <td className="px-3 py-2"><input type="number" value={newForm.jours_ouvres_mois} onChange={(e) => setNewForm({ ...newForm, jours_ouvres_mois: parseInt(e.target.value) || 20 })} className={inputCls} /></td>
              <td className="px-3 py-2 flex gap-1">
                <button onClick={addPdv} className="px-2 py-1 rounded bg-emerald-600 text-white text-xs">OK</button>
                <button onClick={() => setAdding(false)} className="px-2 py-1 rounded border border-custom-border-200 text-custom-text-400 text-xs">X</button>
              </td>
            </tr>
          )}
          {projet.points_de_vente.length === 0 && !adding && (
            <tr>
              <td colSpan={6} className="px-3 py-8 text-center text-custom-text-400 text-sm">
                Aucun point de vente. Cliquez "+ Ajouter un PdV" pour commencer.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ─── Tab: Mode de Gestion ────────────────────────────────────────────────────

function TabModeGestion({ projet, apiBase, onSave }: { projet: ProjetAO; apiBase: string; onSave: () => void }) {
  const [selected, setSelected] = useState(projet.mode_gestion);
  const [horaires, setHoraires] = useState(projet.horaires_service);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const resp = await fetch(`${apiBase}/projets/${projet.id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ mode_gestion: selected, horaires_service: horaires }),
      });
      if (resp.ok) await onSave();
      else alert("Erreur sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-custom-border-200 bg-custom-background-100 p-6">
      <h2 className="text-sm font-semibold text-custom-text-100 mb-4">Mode de gestion</h2>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
        {Object.entries(MODES_GESTION).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setSelected(key)}
            className={`p-4 rounded-xl border text-left text-sm transition-all ${
              selected === key
                ? "border-[#BF5D48] bg-[#BF5D48]/10 text-custom-text-100 ring-1 ring-[#BF5D48]"
                : "border-custom-border-200 bg-custom-background-90 text-custom-text-300 hover:border-custom-border-300"
            }`}
          >
            <div className="font-medium">{label}</div>
          </button>
        ))}
      </div>

      <h2 className="text-sm font-semibold text-custom-text-100 mb-4">Horaires de service</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {Object.entries(HORAIRES).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setHoraires(key)}
            className={`p-3 rounded-xl border text-center text-sm transition-all ${
              horaires === key
                ? "border-[#BF5D48] bg-[#BF5D48]/10 text-custom-text-100 ring-1 ring-[#BF5D48]"
                : "border-custom-border-200 bg-custom-background-90 text-custom-text-300 hover:border-custom-border-300"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 rounded-lg bg-[#BF5D48] text-white text-sm font-medium hover:bg-[#a84d3b] disabled:opacity-50"
        >
          {saving ? "Enregistrement..." : "Enregistrer"}
        </button>
      </div>
    </div>
  );
}

// ─── Tab: Scoring CCTP ───────────────────────────────────────────────────────

function TabScoring({ projet, apiBase, onSave }: { projet: ProjetAO; apiBase: string; onSave: () => void }) {
  const [scores, setScores] = useState({
    scoring_concept_pct: projet.scoring_concept_pct,
    scoring_rh_pct: projet.scoring_rh_pct,
    scoring_qualite_pct: projet.scoring_qualite_pct,
    scoring_rse_pct: projet.scoring_rse_pct,
    scoring_prix_pct: projet.scoring_prix_pct,
  });
  const [saving, setSaving] = useState(false);

  const total = scores.scoring_concept_pct + scores.scoring_rh_pct + scores.scoring_qualite_pct + scores.scoring_rse_pct + scores.scoring_prix_pct;
  const isValid = total === 100;

  const handleSave = async () => {
    if (!isValid) { alert("Le total doit faire 100%"); return; }
    setSaving(true);
    try {
      const resp = await fetch(`${apiBase}/projets/${projet.id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(scores),
      });
      if (resp.ok) await onSave();
      else alert("Erreur sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  const scoreFields = [
    { key: "scoring_prix_pct" as const, label: "Prix" },
    { key: "scoring_concept_pct" as const, label: "Concept" },
    { key: "scoring_rh_pct" as const, label: "RH" },
    { key: "scoring_rse_pct" as const, label: "RSE" },
    { key: "scoring_qualite_pct" as const, label: "Qualite" },
  ];

  return (
    <div className="rounded-xl border border-custom-border-200 bg-custom-background-100 p-6">
      <h2 className="text-sm font-semibold text-custom-text-100 mb-4">Ponderation du scoring CCTP</h2>
      <div className="space-y-4 max-w-md">
        {scoreFields.map(({ key, label }) => (
          <div key={key} className="flex items-center gap-4">
            <label className="w-20 text-sm text-custom-text-200">{label}</label>
            <input
              type="range"
              min={0}
              max={100}
              value={scores[key]}
              onChange={(e) => setScores({ ...scores, [key]: parseInt(e.target.value) })}
              className="flex-1"
            />
            <span className="w-12 text-right text-sm font-medium text-custom-text-100">{scores[key]}%</span>
          </div>
        ))}
      </div>
      <div className={`mt-4 text-sm font-semibold ${isValid ? "text-emerald-400" : "text-red-400"}`}>
        Total : {total}% {isValid ? "" : "(doit faire 100%)"}
      </div>
      <div className="mt-4 flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving || !isValid}
          className="px-4 py-2 rounded-lg bg-[#BF5D48] text-white text-sm font-medium hover:bg-[#a84d3b] disabled:opacity-50"
        >
          {saving ? "Enregistrement..." : "Enregistrer"}
        </button>
      </div>
    </div>
  );
}

// ─── Tab: Documents ──────────────────────────────────────────────────────────

function TabDocuments({ projet, apiBase, onSave }: { projet: ProjetAO; apiBase: string; onSave: () => void }) {
  const [uploading, setUploading] = useState(false);

  const uploadCctp = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("cctp_pdf", file);
      const resp = await fetch(`${apiBase}/projets/${projet.id}/`, {
        method: "PATCH",
        credentials: "include",
        body: formData,
      });
      if (resp.ok) await onSave();
      else alert("Erreur upload");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="rounded-xl border border-custom-border-200 bg-custom-background-100 p-6">
      <h2 className="text-sm font-semibold text-custom-text-100 mb-4">Documents du projet</h2>

      <div className="space-y-4">
        {/* CCTP PDF */}
        <div className="rounded-lg border border-custom-border-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-sm font-medium text-custom-text-100">CCTP / Cahier des charges</div>
              <div className="text-xs text-custom-text-400">
                {projet.cctp_pdf ? "Document charge" : "Aucun document"}
              </div>
            </div>
            <label className="px-3 py-1.5 rounded-lg bg-[#BF5D48] text-white text-sm cursor-pointer hover:bg-[#a84d3b]">
              {uploading ? "Upload..." : projet.cctp_pdf ? "Remplacer" : "Uploader"}
              <input
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadCctp(file);
                }}
              />
            </label>
          </div>
          {projet.cctp_pdf && (
            <iframe
              src={projet.cctp_pdf}
              className="w-full h-96 rounded border border-custom-border-200"
              title="CCTP Preview"
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Shared Components ───────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-custom-text-400 mb-1">{label}</label>
      {children}
    </div>
  );
}
