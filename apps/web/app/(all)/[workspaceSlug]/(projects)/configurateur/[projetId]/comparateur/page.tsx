// Planer custom: Configurateur AO — Comparateur Side-by-Side
"use client";

import { useState, useEffect } from "react";
import { Link, useParams } from "react-router";
import { useProjetAO } from "../layout";

export default function ComparateurPage() {
  const { projet, apiBase } = useProjetAO();
  const { workspaceSlug, projetId } = useParams();
  const [scenarios, setScenarios] = useState<any[]>([]);

  useEffect(() => {
    fetch(`${apiBase}/projets/${projet.id}/scenarios/`, { credentials: "include" })
      .then((r) => r.json()).then((d) => setScenarios(Array.isArray(d) ? d : d.results || []))
      .catch(() => {});
  }, [apiBase, projet.id]);

  const fmtEur = (v?: number) => v == null ? "\u2014" : new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);
  const fmtPct = (v?: number) => v == null ? "\u2014" : `${v.toFixed(1)}%`;

  if (scenarios.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="text-3xl mb-3">\uD83D\uDD00</div>
        <h2 className="text-lg font-semibold text-primary mb-2">Comparateur de Scenarios</h2>
        <p className="text-sm text-tertiary mb-4">Sauvegardez au moins 2 scenarios depuis la page Simulation pour les comparer ici.</p>
        <Link to={`/${workspaceSlug}/configurateur/${projetId}/simulation`} className="text-sm text-accent-primary hover:underline no-underline">
          Aller a la Simulation &rarr;
        </Link>
      </div>
    );
  }

  // KPI comparison
  const getValue = (s: any, path: string) => {
    try { return path.split(".").reduce((o, k) => o?.[k], s.resultats); } catch { return null; }
  };

  const KPI_ROWS = [
    { label: "Cout / Couvert", path: "kpis.cout_par_couvert", fmt: "eur", lower: true },
    { label: "Marge operateur", path: "pl.marge_pct", fmt: "pct", lower: false },
    { label: "Score AO", path: "score_estime.total", fmt: "pts", lower: false },
  ];

  const PL_ROWS = [
    { label: "CA Total", key: "ca_total", bold: true },
    { label: "Cout matiere", key: "cout_matiere" },
    { label: "Masse salariale", key: "masse_salariale" },
    { label: "Frais generaux", key: "frais_generaux" },
    { label: "Amortissements", key: "amortissements" },
    { label: "Total charges", key: "total_charges", bold: true },
    { label: "RESULTAT", key: "resultat", bold: true, result: true },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-sm font-semibold text-primary">Comparateur ({scenarios.length} scenarios)</h2>

      {/* KPI Row */}
      <div className="grid grid-cols-3 gap-4">
        {KPI_ROWS.map((kpi) => {
          const values = scenarios.map((s) => getValue(s, kpi.path) as number | null).filter((v): v is number => v != null);
          const best = kpi.lower ? Math.min(...values) : Math.max(...values);
          return (
            <div key={kpi.label} className="rounded-lg border border-border-subtle bg-layer-1 p-4">
              <div className="text-[10px] uppercase tracking-widest text-tertiary font-semibold mb-3">{kpi.label}</div>
              <div className="flex gap-4">
                {scenarios.map((s) => {
                  const v = getValue(s, kpi.path) as number | null;
                  const isBest = v === best;
                  return (
                    <div key={s.id} className="text-center flex-1">
                      <div className={`text-xl font-bold ${isBest ? "text-success-secondary" : "text-primary"}`}>
                        {v != null ? (kpi.fmt === "eur" ? `${v.toFixed(2)}\u20AC` : kpi.fmt === "pct" ? `${v.toFixed(1)}%` : v) : "\u2014"}
                      </div>
                      <div className="text-[10px] text-tertiary mt-1 truncate">{s.nom}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* P&L Comparison Table */}
      <div className="rounded-lg border border-border-subtle overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-layer-1">
              <th className="text-left px-4 py-2 text-[10px] text-tertiary uppercase">Poste</th>
              {scenarios.map((s) => <th key={s.id} className="text-right px-4 py-2 text-[10px] text-tertiary uppercase">{s.nom}</th>)}
            </tr>
          </thead>
          <tbody>
            {PL_ROWS.map((row) => (
              <tr key={row.key} className={`border-t border-border-subtle ${row.result ? "border-t-2 border-accent-primary" : ""}`}>
                <td className={`px-4 py-2 ${row.bold ? "font-semibold text-primary" : "text-secondary"}`}>{row.label}</td>
                {scenarios.map((s, i) => {
                  const val = s.resultats?.pl?.[row.key];
                  const baseVal = scenarios[0]?.resultats?.pl?.[row.key];
                  const diff = i > 0 && baseVal ? ((val - baseVal) / Math.abs(baseVal)) * 100 : null;
                  return (
                    <td key={s.id} className={`text-right px-4 py-2 tabular-nums ${row.bold ? "font-semibold" : ""} ${row.result && val >= 0 ? "text-success-secondary" : row.result && val < 0 ? "text-danger-secondary" : "text-primary"}`}>
                      {fmtEur(val)}
                      {diff != null && Math.abs(diff) > 1 && (
                        <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded ${diff > 0 ? "bg-success-primary/10 text-success-secondary" : "bg-danger-subtle text-danger-secondary"}`}>
                          {diff > 0 ? "+" : ""}{diff.toFixed(0)}%
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Score breakdown */}
      <div className="rounded-lg border border-border-subtle bg-layer-1 p-5">
        <h3 className="text-sm font-semibold text-primary mb-3">Decomposition du score</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="text-left px-3 py-1 text-[10px] text-tertiary uppercase">Axe</th>
                {scenarios.map((s) => <th key={s.id} className="text-center px-3 py-1 text-[10px] text-tertiary uppercase">{s.nom}</th>)}
              </tr>
            </thead>
            <tbody>
              {["prix", "concept", "rh", "rse", "qualite"].map((axis) => (
                <tr key={axis} className="border-t border-border-subtle/50">
                  <td className="px-3 py-1.5 text-secondary capitalize">{axis}</td>
                  {scenarios.map((s) => (
                    <td key={s.id} className="text-center px-3 py-1.5 font-bold text-primary">
                      {s.resultats?.score_estime?.[axis] ?? "\u2014"}
                    </td>
                  ))}
                </tr>
              ))}
              <tr className="border-t-2 border-accent-primary">
                <td className="px-3 py-1.5 font-semibold text-primary">TOTAL</td>
                {scenarios.map((s) => (
                  <td key={s.id} className="text-center px-3 py-1.5 font-bold text-xl text-accent-primary">
                    {s.resultats?.score_estime?.total ?? "\u2014"}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
