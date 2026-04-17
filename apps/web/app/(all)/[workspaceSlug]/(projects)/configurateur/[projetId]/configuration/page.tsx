// Planer custom: Configurateur AO — Configuration (Mode gestion + Horaires + Scoring)
"use client";

import { useState } from "react";
import { Button } from "@plane/propel/button";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { useProjetAO } from "../layout";

const MODES = [
  { id: "masse_frais", icon: "\uD83D\uDCBC", name: "Masse de Frais", desc: "Charges salariales et FG facturees mensuellement.", tip: "Le plus courant en RC" },
  { id: "admission", icon: "\uD83C\uDFAB", name: "Admission / Subvention", desc: "Prix convive fixe + subvention employeur.", tip: "Sites avec politique subvention claire" },
  { id: "mixte", icon: "\u2696\uFE0F", name: "Mixte", desc: "Masse de frais charges fixes + admissions exterieurs.", tip: "Projets complexes, convives mixtes" },
  { id: "ticket", icon: "\uD83C\uDF7D\uFE0F", name: "Tout sur le ticket", desc: "Restauration commerciale classique.", tip: "Restaurants grand public" },
  { id: "custom", icon: "\u2699\uFE0F", name: "Autre / Custom", desc: "Mode hybride ou specifique.", tip: "Cas atypiques" },
];
const HORAIRES: Record<string, string> = { midi: "Midi", midi_soir: "Midi + Soir", continu: "Continu", pdj_midi: "Petit-dej + Midi" };
const SCORE_FIELDS = [
  { key: "scoring_prix_pct" as const, label: "Prix", icon: "\uD83D\uDCB0" },
  { key: "scoring_concept_pct" as const, label: "Concept", icon: "\uD83D\uDCA1" },
  { key: "scoring_rh_pct" as const, label: "RH", icon: "\uD83D\uDC65" },
  { key: "scoring_rse_pct" as const, label: "RSE", icon: "\u267B\uFE0F" },
  { key: "scoring_qualite_pct" as const, label: "Qualite", icon: "\u2705" },
];

export default function ConfigurationPage() {
  const { projet, apiBase, mutate } = useProjetAO();
  const [mode, setMode] = useState(projet.mode_gestion);
  const [horaires, setHoraires] = useState(projet.horaires_service);
  const [scores, setScores] = useState({
    scoring_concept_pct: projet.scoring_concept_pct, scoring_rh_pct: projet.scoring_rh_pct,
    scoring_qualite_pct: projet.scoring_qualite_pct, scoring_rse_pct: projet.scoring_rse_pct,
    scoring_prix_pct: projet.scoring_prix_pct,
  });
  const total = Object.values(scores).reduce((a, b) => a + b, 0);

  const save = async () => {
    const resp = await fetch(`${apiBase}/projets/${projet.id}/`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify({ mode_gestion: mode, horaires_service: horaires, ...scores }),
    });
    if (resp.ok) { mutate(); setToast({ type: TOAST_TYPE.SUCCESS, title: "Configuration enregistree" }); }
    else setToast({ type: TOAST_TYPE.ERROR, title: "Erreur" });
  };

  return (
    <div className="space-y-6">
      {/* Mode de gestion */}
      <Section title="Mode de gestion">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {MODES.map((m) => (
            <button key={m.id} onClick={() => setMode(m.id)}
              className={`p-4 rounded-lg border-2 text-left transition-all relative ${mode === m.id ? "border-accent-primary bg-accent-primary/5 shadow-sm" : "border-border-subtle bg-layer-1 hover:border-border-strong"}`}
            >
              {mode === m.id && <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-accent-primary text-on-color flex items-center justify-center text-xs font-bold">&check;</div>}
              <div className="text-xl mb-2">{m.icon}</div>
              <div className="text-sm font-semibold text-primary mb-1">{m.name}</div>
              <div className="text-xs text-tertiary leading-relaxed mb-2">{m.desc}</div>
              <div className="text-[10px] pt-2 border-t border-border-subtle"><span className="text-accent-primary font-medium">Ideal : </span><span className="text-tertiary">{m.tip}</span></div>
            </button>
          ))}
        </div>
      </Section>

      {/* Horaires */}
      <Section title="Horaires de service">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Object.entries(HORAIRES).map(([key, label]) => (
            <button key={key} onClick={() => setHoraires(key)} className={`p-3 rounded-lg border-2 text-center text-sm font-medium transition-all ${horaires === key ? "border-accent-primary bg-accent-primary/5 text-accent-primary" : "border-border-subtle bg-layer-1 text-secondary hover:border-border-strong"}`}>{label}</button>
          ))}
        </div>
      </Section>

      {/* Scoring */}
      <Section title="Scoring CCTP">
        <div className="space-y-2 max-w-md">
          {SCORE_FIELDS.map(({ key, label, icon }) => (
            <div key={key} className="flex items-center gap-2">
              <span className="text-sm w-5">{icon}</span>
              <span className="text-sm text-secondary flex-1">{label}</span>
              <input type="number" min={0} max={100} step={5} value={scores[key]}
                onChange={(e) => setScores({ ...scores, [key]: parseInt(e.target.value) || 0 })}
                className="w-16 h-7 px-2 rounded-md border border-border-subtle bg-layer-2 text-primary text-sm text-right" />
              <span className="text-xs text-tertiary w-4">%</span>
            </div>
          ))}
          <div className={`text-xs font-medium mt-1 ${total === 100 ? "text-success-secondary" : "text-danger-secondary"}`}>
            Total : {total}% {total === 100 ? "\u2713" : "(doit faire 100%)"}
          </div>
        </div>
      </Section>

      <div className="flex justify-end"><Button variant="primary" size="lg" onClick={save} disabled={total !== 100}>Enregistrer</Button></div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border-subtle bg-surface-1 overflow-hidden">
      <div className="px-5 py-3 border-b border-border-subtle bg-layer-1"><h2 className="text-sm font-semibold text-primary">{title}</h2></div>
      <div className="p-5">{children}</div>
    </div>
  );
}
