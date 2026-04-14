// Planer custom: New AO project — 4-step wizard
"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

const PDV_TYPES = [
  { key: "self", label: "Self-Service", icon: "🍽️", desc: "Restauration collective classique" },
  { key: "cafeteria", label: "Cafétéria", icon: "☕", desc: "Espace détente et snacking" },
  { key: "brasserie", label: "Brasserie", icon: "🍷", desc: "Restaurant avec service à table" },
  { key: "room_service", label: "Room Service", icon: "🛎️", desc: "Service en chambre/bureau" },
  { key: "club_vip", label: "Club VIP", icon: "⭐", desc: "Espace premium direction" },
  { key: "da", label: "Distributeur Auto", icon: "🤖", desc: "Distribution automatique 24/7" },
  { key: "dflab", label: "Digital Food Lab", icon: "📱", desc: "Restauration connectée" },
];

export default function NouveauAOPage() {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    nom: "",
    client: "",
    localisation: "",
    date_remise: "",
    date_ouverture_visee: "",
    nature: "ouverture",
    perimetre: "multi",
    mode_gestion: "mixte",
    horaires_service: "midi",
    pdv_types: [] as string[],
    scoring_concept_pct: 20,
    scoring_rh_pct: 15,
    scoring_qualite_pct: 10,
    scoring_rse_pct: 15,
    scoring_prix_pct: 40,
  });

  const update = (key: string, value: any) => setForm((prev) => ({ ...prev, [key]: value }));

  const togglePdv = (type: string) => {
    setForm((prev) => ({
      ...prev,
      pdv_types: prev.pdv_types.includes(type)
        ? prev.pdv_types.filter((t) => t !== type)
        : [...prev.pdv_types, type],
    }));
  };

  const handleCreate = async () => {
    setSaving(true);
    try {
      const resp = await fetch(`/api/v1/workspaces/${workspaceSlug}/configurateur/projets/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });
      if (resp.ok) {
        const projet = await resp.json();
        // Create PdVs
        for (const type of form.pdv_types) {
          await fetch(`/api/v1/workspaces/${workspaceSlug}/configurateur/projets/${projet.id}/pdv/`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ type_pdv: type, nom: PDV_TYPES.find((p) => p.key === type)?.label || type, tranche_frequentation: 1, couverts_jour_cible: 0 }),
          });
        }
        router.push(`/${workspaceSlug}/configurateur`);
      }
    } catch (err) {
      console.error("Create AO error:", err);
    } finally {
      setSaving(false);
    }
  };

  const scoringTotal = form.scoring_concept_pct + form.scoring_rh_pct + form.scoring_qualite_pct + form.scoring_rse_pct + form.scoring_prix_pct;

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto p-6">
        <button onClick={() => router.back()} className="text-xs text-custom-text-400 hover:text-custom-text-200 mb-1">
          ← Retour
        </button>
        <h1 className="text-lg font-bold text-custom-text-100 mb-6">🎯 Nouveau projet AO</h1>

        {/* Steps indicator */}
        <div className="flex items-center gap-2 mb-8">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${step >= s ? "bg-[#BF5D48] text-white" : "bg-custom-background-90 text-custom-text-400"}`}>
                {s}
              </div>
              {s < 4 && <div className={`w-12 h-0.5 ${step > s ? "bg-[#BF5D48]" : "bg-custom-background-90"}`} />}
            </div>
          ))}
          <span className="ml-3 text-xs text-custom-text-400">
            {step === 1 ? "Identité" : step === 2 ? "Points de vente" : step === 3 ? "Configuration" : "Récapitulatif"}
          </span>
        </div>

        {/* Step 1: Identité */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-custom-text-100">Identité du projet</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="text-xs text-custom-text-400 mb-1 block">Nom du projet AO *</label>
                <input value={form.nom} onChange={(e) => update("nom", e.target.value)} placeholder="Ex: AO CHANEL Paris 8" className="w-full rounded-lg border border-custom-border-200 bg-custom-background-100 px-3 py-2 text-sm text-custom-text-100 focus:border-[#BF5D48] focus:outline-none" />
              </div>
              <div>
                <label className="text-xs text-custom-text-400 mb-1 block">Client *</label>
                <input value={form.client} onChange={(e) => update("client", e.target.value)} placeholder="Ex: CHANEL" className="w-full rounded-lg border border-custom-border-200 bg-custom-background-100 px-3 py-2 text-sm text-custom-text-100 focus:border-[#BF5D48] focus:outline-none" />
              </div>
              <div>
                <label className="text-xs text-custom-text-400 mb-1 block">Localisation</label>
                <input value={form.localisation} onChange={(e) => update("localisation", e.target.value)} placeholder="Ex: Paris 8" className="w-full rounded-lg border border-custom-border-200 bg-custom-background-100 px-3 py-2 text-sm text-custom-text-100 focus:border-[#BF5D48] focus:outline-none" />
              </div>
              <div>
                <label className="text-xs text-custom-text-400 mb-1 block">Date de remise</label>
                <input type="date" value={form.date_remise} onChange={(e) => update("date_remise", e.target.value)} className="w-full rounded-lg border border-custom-border-200 bg-custom-background-100 px-3 py-2 text-sm text-custom-text-100 focus:border-[#BF5D48] focus:outline-none" />
              </div>
              <div>
                <label className="text-xs text-custom-text-400 mb-1 block">Date d'ouverture visée</label>
                <input type="date" value={form.date_ouverture_visee} onChange={(e) => update("date_ouverture_visee", e.target.value)} className="w-full rounded-lg border border-custom-border-200 bg-custom-background-100 px-3 py-2 text-sm text-custom-text-100 focus:border-[#BF5D48] focus:outline-none" />
              </div>
              <div>
                <label className="text-xs text-custom-text-400 mb-1 block">Nature</label>
                <select value={form.nature} onChange={(e) => update("nature", e.target.value)} className="w-full rounded-lg border border-custom-border-200 bg-custom-background-100 px-3 py-2 text-sm text-custom-text-100 focus:outline-none">
                  <option value="ouverture">Ouverture</option>
                  <option value="reprise">Reprise</option>
                  <option value="renouvellement">Renouvellement</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-custom-text-400 mb-1 block">Périmètre</label>
                <select value={form.perimetre} onChange={(e) => update("perimetre", e.target.value)} className="w-full rounded-lg border border-custom-border-200 bg-custom-background-100 px-3 py-2 text-sm text-custom-text-100 focus:outline-none">
                  <option value="mono">Mono-PdV</option>
                  <option value="multi">Multi-PdV</option>
                  <option value="multisites">Multi-sites</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end pt-4">
              <button onClick={() => setStep(2)} disabled={!form.nom || !form.client} className="px-4 py-2 rounded-lg bg-[#BF5D48] text-white text-sm font-medium hover:bg-[#a84d3b] disabled:opacity-50">
                Suivant →
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Points de vente */}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-custom-text-100">Points de vente</h2>
            <p className="text-xs text-custom-text-400">Sélectionnez les types de PdV pour ce projet</p>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              {PDV_TYPES.map((pdv) => (
                <button
                  key={pdv.key}
                  onClick={() => togglePdv(pdv.key)}
                  className={`text-left p-4 rounded-xl border transition-all ${
                    form.pdv_types.includes(pdv.key)
                      ? "border-[#BF5D48] bg-[#BF5D48]/10 shadow-sm"
                      : "border-custom-border-200 hover:border-custom-border-300"
                  }`}
                >
                  <span className="text-2xl block mb-1">{pdv.icon}</span>
                  <span className="text-sm font-medium text-custom-text-100 block">{pdv.label}</span>
                  <span className="text-xs text-custom-text-400">{pdv.desc}</span>
                </button>
              ))}
            </div>
            <div className="flex justify-between pt-4">
              <button onClick={() => setStep(1)} className="px-4 py-2 rounded-lg text-sm text-custom-text-300 hover:bg-custom-background-90">← Retour</button>
              <button onClick={() => setStep(3)} disabled={form.pdv_types.length === 0} className="px-4 py-2 rounded-lg bg-[#BF5D48] text-white text-sm font-medium hover:bg-[#a84d3b] disabled:opacity-50">
                Suivant →
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Configuration */}
        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-custom-text-100">Configuration</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-custom-text-400 mb-1 block">Mode de gestion</label>
                <select value={form.mode_gestion} onChange={(e) => update("mode_gestion", e.target.value)} className="w-full rounded-lg border border-custom-border-200 bg-custom-background-100 px-3 py-2 text-sm text-custom-text-100 focus:outline-none">
                  <option value="masse_frais">Masse de frais</option>
                  <option value="admission">Admission / Subvention</option>
                  <option value="mixte">Mixte</option>
                  <option value="ticket">Tout sur le ticket</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-custom-text-400 mb-1 block">Horaires de service</label>
                <select value={form.horaires_service} onChange={(e) => update("horaires_service", e.target.value)} className="w-full rounded-lg border border-custom-border-200 bg-custom-background-100 px-3 py-2 text-sm text-custom-text-100 focus:outline-none">
                  <option value="midi">Midi</option>
                  <option value="midi_soir">Midi + Soir</option>
                  <option value="continu">Continu</option>
                  <option value="pdj_midi">Petit-déj + Midi</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs text-custom-text-400 mb-2 block">Pondération scoring CCTP (total = {scoringTotal}%)</label>
              {[
                { key: "scoring_prix_pct", label: "Prix" },
                { key: "scoring_concept_pct", label: "Concept" },
                { key: "scoring_rh_pct", label: "RH" },
                { key: "scoring_rse_pct", label: "RSE" },
                { key: "scoring_qualite_pct", label: "Qualité" },
              ].map((s) => (
                <div key={s.key} className="flex items-center gap-3 mb-2">
                  <span className="text-xs text-custom-text-300 w-16">{s.label}</span>
                  <input type="range" min="0" max="60" value={(form as any)[s.key]} onChange={(e) => update(s.key, parseInt(e.target.value))} className="flex-1" />
                  <span className="text-xs font-mono text-custom-text-200 w-8 text-right">{(form as any)[s.key]}%</span>
                </div>
              ))}
              {scoringTotal !== 100 && <p className="text-xs text-red-400 mt-1">⚠️ Le total doit faire 100% (actuellement {scoringTotal}%)</p>}
            </div>
            <div className="flex justify-between pt-4">
              <button onClick={() => setStep(2)} className="px-4 py-2 rounded-lg text-sm text-custom-text-300 hover:bg-custom-background-90">← Retour</button>
              <button onClick={() => setStep(4)} className="px-4 py-2 rounded-lg bg-[#BF5D48] text-white text-sm font-medium hover:bg-[#a84d3b]">
                Suivant →
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Récapitulatif */}
        {step === 4 && (
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-custom-text-100">Récapitulatif</h2>
            <div className="rounded-xl border border-custom-border-200 bg-custom-background-100 p-5 space-y-3">
              <div className="flex justify-between text-sm"><span className="text-custom-text-400">Projet</span><span className="text-custom-text-100 font-medium">{form.nom}</span></div>
              <div className="flex justify-between text-sm"><span className="text-custom-text-400">Client</span><span className="text-custom-text-100">{form.client}</span></div>
              <div className="flex justify-between text-sm"><span className="text-custom-text-400">Nature</span><span className="text-custom-text-100">{form.nature}</span></div>
              <div className="flex justify-between text-sm"><span className="text-custom-text-400">Mode gestion</span><span className="text-custom-text-100">{form.mode_gestion}</span></div>
              <div className="flex justify-between text-sm"><span className="text-custom-text-400">PdV</span><span className="text-custom-text-100">{form.pdv_types.length} sélectionnés ({form.pdv_types.join(", ")})</span></div>
              {form.date_remise && <div className="flex justify-between text-sm"><span className="text-custom-text-400">Remise</span><span className="text-custom-text-100">{form.date_remise}</span></div>}
            </div>
            <div className="flex justify-between pt-4">
              <button onClick={() => setStep(3)} className="px-4 py-2 rounded-lg text-sm text-custom-text-300 hover:bg-custom-background-90">← Retour</button>
              <button onClick={handleCreate} disabled={saving} className="px-4 py-2 rounded-lg bg-[#BF5D48] text-white text-sm font-medium hover:bg-[#a84d3b] disabled:opacity-50 shadow-sm">
                {saving ? "Création..." : "Créer le projet AO"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
