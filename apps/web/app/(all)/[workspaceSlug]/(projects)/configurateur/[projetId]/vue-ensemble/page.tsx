// Planer custom: Configurateur AO — Vue d'ensemble (Parametrage)
"use client";

import { useState } from "react";
import { Button } from "@plane/propel/button";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { useProjetAO } from "../layout";

const NATURES: Record<string, string> = { ouverture: "Ouverture", reprise: "Reprise", renouvellement: "Renouvellement" };
const MODE_LABELS: Record<string, string> = { masse_frais: "Masse de Frais", admission: "Admission", mixte: "Mixte", ticket: "Ticket", custom: "Custom" };

export default function VueEnsemblePage() {
  const { projet, apiBase, mutate } = useProjetAO();
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
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const resp = await fetch(`${apiBase}/projets/${projet.id}/`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (resp.ok) { mutate(); setToast({ type: TOAST_TYPE.SUCCESS, title: "Enregistre" }); }
    else setToast({ type: TOAST_TYPE.ERROR, title: "Erreur" });
  };

  const update = (key: string, value: any) => setForm((p) => ({ ...p, [key]: value }));
  const inputCls = "w-full h-8 px-3 rounded-md border border-border-subtle bg-layer-2 text-primary text-sm focus:outline-none focus:border-accent-primary";

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Points de vente", value: projet.points_de_vente.length },
          { label: "Mode gestion", value: MODE_LABELS[projet.mode_gestion] || projet.mode_gestion },
          { label: "Semaines / an", value: form.semaines_par_an },
          { label: "Duree contrat", value: `${form.duree_contrat_annees} ans` },
        ].map((kpi) => (
          <div key={kpi.label} className="p-4 rounded-xl bg-layer-2 border border-border-subtle">
            <div className="text-[10px] uppercase tracking-widest text-tertiary font-semibold">{kpi.label}</div>
            <div className="text-2xl font-bold text-primary mt-2 truncate">{kpi.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-5">
        {/* Left: Infos generales */}
        <div className="rounded-lg border border-border-subtle bg-surface-1 overflow-hidden">
          <div className="px-5 py-3 border-b border-border-subtle bg-layer-1 flex items-center gap-2.5">
            <div className="w-1 h-4 rounded-full bg-[#BF5D48]" />
            <h2 className="text-sm font-semibold text-primary">Informations generales</h2>
          </div>
          <div className="p-5 space-y-3">
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
        </div>

        {/* Right: Parametres financiers */}
        <div className="rounded-lg border border-border-subtle bg-surface-1 overflow-hidden">
          <div className="px-5 py-3 border-b border-border-subtle bg-layer-1 flex items-center gap-2.5">
            <div className="w-1 h-4 rounded-full bg-[#BF5D48]" />
            <h2 className="text-sm font-semibold text-primary">Parametres financiers</h2>
          </div>
          <div className="p-5 space-y-3">
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
        </div>
      </div>

      <div className="flex justify-end">
        <Button variant="primary" size="lg" onClick={save} disabled={saving} loading={saving}>Enregistrer</Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] font-semibold text-tertiary uppercase tracking-wider mb-1">{label}</label>
      {children}
    </div>
  );
}
