// Planer custom: Configurateur AO — Simulation (Mono-scenario P&L)
"use client";

import { useState, useEffect } from "react";
import { Button } from "@plane/propel/button";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { useProjetAO } from "../layout";

type SimResult = {
  activity: { couverts_mois: number; ca_mensuel: number };
  staffing: { etp_total: number; masse_chargee_mensuelle: number };
  matiere: { cout_matiere_mensuel: number; cout_par_couvert: number };
  fg: { fg_mensuel: number };
  invest: { invest_total: number; amortissement_mensuel: number };
  pl: { ca_total: number; resultat: number; resultat_annuel: number; marge_pct: number; cout_matiere: number; masse_salariale: number; frais_generaux: number; amortissements: number; total_charges: number; ratio_matiere_pct: number; ratio_personnel_pct: number; ratio_fg_pct: number };
  kpis: { cout_par_couvert: number };
  score_estime: { total: number; prix: number; concept: number; rh: number; rse: number; qualite: number };
  _elapsed_ms?: number;
};

export default function SimulationPage() {
  const { projet, apiBase } = useProjetAO();
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
      .then((r) => r.json()).then((d) => setScenarios(Array.isArray(d) ? d : d.results || []))
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
    if (r.ok) { const d = await r.json(); setScenarios([...scenarios, d]); setNewName(""); setToast({ type: TOAST_TYPE.SUCCESS, title: `Scenario "${name}" sauvegarde` }); }
  };

  const fmtEur = (v?: number) => v == null ? "\u2014" : new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);
  const fmtPct = (v?: number) => v == null ? "\u2014" : `${v.toFixed(1)}%`;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      <div className="lg:col-span-4 space-y-4">
        <Section title="Parametres">
          <div className="space-y-3">
            <Field label="Niveau prix">
              <select value={params.niveau_prix} onChange={(e) => setParams({ ...params, niveau_prix: e.target.value })} className={inputCls}>
                <option value="prix_eco">Economique</option><option value="prix_standard">Standard</option>
                <option value="prix_premium">Premium</option><option value="prix_luxe">Luxe</option>
              </select>
            </Field>
            <SliderField label="Penetration" value={params.penetration} min={0.3} max={1} step={0.05} format={(v: number) => `${Math.round(v * 100)}%`} onChange={(v: number) => setParams({ ...params, penetration: v })} />
            <SliderField label="Saisonnalite" value={params.saisonnalite} min={0.6} max={1.4} step={0.05} format={(v: number) => `x${v.toFixed(2)}`} onChange={(v: number) => setParams({ ...params, saisonnalite: v })} />
            {projet.points_de_vente.length > 1 && (
              <Field label="Mutualisation">
                <select value={params.mutualisation} onChange={(e) => setParams({ ...params, mutualisation: e.target.value })} className={inputCls}>
                  <option value="none">Aucune</option><option value="scenario_1_3">Scenario 1&3 (-30%)</option><option value="scenario_2">Scenario 2 (-50%)</option>
                </select>
              </Field>
            )}
          </div>
        </Section>
        <Section title="Sauvegarder">
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nom du scenario" className={inputCls + " mb-2"} />
          <Button variant="primary" size="base" className="w-full" onClick={saveScenario}>Sauvegarder scenario</Button>
          {scenarios.length > 0 && (
            <div className="mt-3 pt-3 border-t border-border-subtle">
              <div className="text-[10px] text-tertiary uppercase tracking-wider mb-2">Scenarios sauvegardes</div>
              {scenarios.map((s) => <div key={s.id} className="text-xs text-secondary py-0.5">{s.nom}</div>)}
            </div>
          )}
        </Section>
      </div>

      <div className="lg:col-span-8 space-y-4">
        {sim && (
          <>
            <div className="flex items-center gap-3">
              <div className="px-3 py-1.5 rounded-lg bg-accent-primary/10 flex items-center gap-2">
                <span className="text-xl font-bold text-accent-primary">{sim.score_estime.total}</span>
                <span className="text-[10px] text-tertiary">/ 100</span>
              </div>
              {simulating && <span className="inline-block w-4 h-4 border-2 border-border-subtle border-t-accent-primary rounded-full animate-spin" />}
              {sim._elapsed_ms != null && <span className="text-[10px] text-tertiary">{sim._elapsed_ms}ms</span>}
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <KPI label="CA mensuel" value={fmtEur(sim.pl.ca_total)} sub={`${sim.activity.couverts_mois} cvts`} />
              <KPI label="Masse salariale" value={fmtEur(sim.staffing.masse_chargee_mensuelle)} sub={`${sim.staffing.etp_total.toFixed(1)} ETP`} />
              <KPI label="Cout matiere" value={fmtEur(sim.matiere.cout_matiere_mensuel)} sub={`${sim.matiere.cout_par_couvert.toFixed(2)}\u20AC/cvt`} />
              <KPI label="Resultat" value={fmtEur(sim.pl.resultat)} sub={fmtPct(sim.pl.marge_pct)} accent={sim.pl.resultat >= 0} />
            </div>
            <Section title="Compte de Resultat (mensuel)">
              <table className="w-full text-sm">
                <tbody>
                  {[
                    { l: "CA Total", v: sim.pl.ca_total, b: true },
                    { l: "Cout matiere", v: -sim.pl.cout_matiere, p: sim.pl.ratio_matiere_pct },
                    { l: "Masse salariale", v: -sim.pl.masse_salariale, p: sim.pl.ratio_personnel_pct },
                    { l: "Frais generaux", v: -sim.pl.frais_generaux, p: sim.pl.ratio_fg_pct },
                    { l: "Amortissements", v: -sim.pl.amortissements },
                    { l: "Total charges", v: -sim.pl.total_charges, b: true },
                    { l: "RESULTAT", v: sim.pl.resultat, b: true, accent: sim.pl.resultat >= 0 },
                    { l: "Annualise", v: sim.pl.resultat_annuel, m: true },
                  ].map((r) => (
                    <tr key={r.l} className="border-b border-border-subtle last:border-0">
                      <td className={`px-4 py-2 ${r.b ? "font-semibold text-primary" : r.m ? "text-tertiary" : "text-secondary"}`}>{r.l}</td>
                      <td className={`px-4 py-2 text-right tabular-nums ${r.b ? "font-bold" : ""} ${r.accent === true ? "text-success-secondary" : r.accent === false ? "text-danger-secondary" : r.m ? "text-tertiary" : "text-primary"}`}>{fmtEur(r.v)}</td>
                      <td className="px-3 py-2 text-xs text-right text-tertiary w-16">{r.p ? fmtPct(r.p) : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          </>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (<div className="rounded-lg border border-border-subtle bg-surface-1 overflow-hidden"><div className="px-5 py-3 border-b border-border-subtle bg-layer-1"><h2 className="text-sm font-semibold text-primary">{title}</h2></div><div className="p-5">{children}</div></div>);
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (<div><label className="block text-[10px] font-semibold text-tertiary uppercase tracking-wider mb-1">{label}</label>{children}</div>);
}
function KPI({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (<div className="p-3 rounded-lg bg-layer-1 border border-border-subtle"><div className="text-[10px] text-tertiary uppercase tracking-wider">{label}</div><div className={`text-lg font-bold mt-1 ${accent === false ? "text-danger-secondary" : accent ? "text-success-secondary" : "text-primary"}`}>{value}</div>{sub && <div className="text-xs text-tertiary mt-0.5">{sub}</div>}</div>);
}
function SliderField({ label, value, min, max, step, format, onChange }: { label: string; value: number; min: number; max: number; step: number; format: (v: number) => string; onChange: (v: number) => void }) {
  return (<div><div className="flex items-center justify-between mb-1"><label className="text-[10px] font-semibold text-tertiary uppercase tracking-wider">{label}</label><span className="text-sm font-semibold text-accent-primary">{format(value)}</span></div><input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} className="w-full h-1.5 rounded-full bg-layer-3 appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent-primary [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-pointer" /></div>);
}
