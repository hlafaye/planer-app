// Planer custom: Configurateur AO — Points de Vente (Cards + CRUD)
"use client";

import { useState, useEffect } from "react";
import { Button } from "@plane/propel/button";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { useProjetAO } from "../layout";

const PDV_ICONS: Record<string, string> = { self: "\uD83C\uDF71", cafeteria: "\u2615", brasserie: "\uD83E\uDD69", room_service: "\uD83D\uDECE\uFE0F", club_vip: "\uD83E\uDD42", da: "\uD83E\uDD16", dflab: "\uD83D\uDD2C" };
const PDV_LABELS: Record<string, string> = { self: "Self-Service", cafeteria: "Cafeteria", brasserie: "Brasserie", room_service: "Room Service", club_vip: "Club VIP", da: "Distributeur Auto", dflab: "Digital Food Lab" };
const PDV_DESCS: Record<string, string> = { self: "Restauration collective classique", cafeteria: "Espace detente et snacking", brasserie: "Restaurant avec service a table", room_service: "Service en chambre/bureau", club_vip: "Espace premium direction", da: "Distribution automatique 24/7", dflab: "Restauration connectee" };

type Tranche = { id: number; numero: number; borne_min: number; borne_max: number; mediane: number };

export default function PointsDeVentePage() {
  const { projet, apiBase, mutate } = useProjetAO();
  const [tranches, setTranches] = useState<Tranche[]>([]);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    fetch(`${apiBase}/referentiels/tranches/`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setTranches(Array.isArray(d) ? d : d.results || []))
      .catch(() => {});
  }, [apiBase]);

  const updatePdv = async (id: string, data: any) => {
    const r = await fetch(`${apiBase}/projets/${projet.id}/pdv/${id}/`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify(data),
    });
    if (r.ok) mutate();
  };

  const deletePdv = async (id: string) => {
    if (!confirm("Supprimer ce point de vente ?")) return;
    await fetch(`${apiBase}/projets/${projet.id}/pdv/${id}/`, { method: "DELETE", credentials: "include" });
    mutate();
    setToast({ type: TOAST_TYPE.SUCCESS, title: "PdV supprime" });
  };

  const addPdv = async (type: string) => {
    const r = await fetch(`${apiBase}/projets/${projet.id}/pdv/`, {
      method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify({ type_pdv: type, nom: PDV_LABELS[type], tranche_frequentation: 3, couverts_jour_cible: tranches.find((t) => t.numero === 3)?.mediane || 200, jours_ouvres_mois: 20 }),
    });
    if (r.ok) { mutate(); setAdding(false); setToast({ type: TOAST_TYPE.SUCCESS, title: "PdV ajoute" }); }
  };

  const inputCls = "w-full h-7 px-2 rounded-md border border-border-subtle bg-layer-2 text-primary text-sm focus:outline-none focus:border-accent-primary";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-primary">Points de Vente ({projet.points_de_vente.length})</h2>
        <Button variant="primary" size="sm" onClick={() => setAdding(true)}>+ Ajouter un PdV</Button>
      </div>

      {/* Add PdV — type selector grid */}
      {adding && (
        <div className="rounded-lg border-2 border-dashed border-accent-primary bg-accent-primary/5 p-4">
          <div className="text-xs font-semibold text-secondary mb-3">Choisir un type de PdV</div>
          <div className="grid grid-cols-3 lg:grid-cols-4 gap-2">
            {Object.entries(PDV_LABELS).map(([key, label]) => (
              <button key={key} onClick={() => addPdv(key)} className="p-3 rounded-lg border-2 border-border-subtle text-center hover:border-accent-primary hover:bg-accent-primary/5 transition-all">
                <div className="text-2xl mb-1">{PDV_ICONS[key]}</div>
                <div className="text-xs font-semibold text-primary">{label}</div>
                <div className="text-[10px] text-tertiary">{PDV_DESCS[key]}</div>
              </button>
            ))}
          </div>
          <div className="mt-3 flex justify-end"><Button variant="ghost" size="sm" onClick={() => setAdding(false)}>Annuler</Button></div>
        </div>
      )}

      {/* PdV cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {projet.points_de_vente.map((pdv) => (
          <div key={pdv.id} className="rounded-lg border border-border-subtle bg-layer-1 p-4 hover:border-border-strong transition-colors group">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl bg-accent-primary/10">{PDV_ICONS[pdv.type_pdv] || "\uD83C\uDF7D\uFE0F"}</div>
              <div className="flex-1 min-w-0">
                <input value={pdv.nom} onChange={(e) => updatePdv(pdv.id, { nom: e.target.value })} className="text-sm font-semibold text-primary bg-transparent border-0 outline-none w-full focus:bg-layer-1-hover rounded px-1 -mx-1" />
                <div className="text-xs text-tertiary">{PDV_LABELS[pdv.type_pdv]}</div>
              </div>
              <button onClick={() => deletePdv(pdv.id)} className="opacity-0 group-hover:opacity-60 hover:!opacity-100 text-danger-secondary text-xs p-1" tabIndex={-1}>&times;</button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[9px] uppercase tracking-wider text-tertiary font-semibold">Tranche</label>
                <select value={pdv.tranche_frequentation} onChange={(e) => {
                  const t = parseInt(e.target.value);
                  const med = tranches.find((tr) => tr.numero === t)?.mediane || pdv.couverts_jour_cible;
                  updatePdv(pdv.id, { tranche_frequentation: t, couverts_jour_cible: med });
                }} className={inputCls + " mt-0.5"}>
                  {tranches.map((t) => <option key={t.numero} value={t.numero}>T{t.numero} ({t.borne_min}-{t.borne_max})</option>)}
                  {tranches.length === 0 && <option value={pdv.tranche_frequentation}>T{pdv.tranche_frequentation}</option>}
                </select>
              </div>
              <div>
                <label className="text-[9px] uppercase tracking-wider text-tertiary font-semibold">CVT/J</label>
                <input type="number" value={pdv.couverts_jour_cible} onChange={(e) => updatePdv(pdv.id, { couverts_jour_cible: parseInt(e.target.value) || 0 })} className={inputCls + " mt-0.5"} />
              </div>
              <div>
                <label className="text-[9px] uppercase tracking-wider text-tertiary font-semibold">J/mois</label>
                <input type="number" value={pdv.jours_ouvres_mois} onChange={(e) => updatePdv(pdv.id, { jours_ouvres_mois: parseInt(e.target.value) || 20 })} className={inputCls + " mt-0.5"} />
              </div>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold ${pdv.tranche_frequentation <= 3 ? "bg-success-primary/10 text-success-secondary" : pdv.tranche_frequentation <= 6 ? "bg-accent-primary/10 text-accent-primary" : "bg-warning-primary/10 text-warning-secondary"}`}>T{pdv.tranche_frequentation}</span>
              <span className="text-xs text-tertiary">{pdv.couverts_jour_cible} cvt/j &middot; {pdv.jours_ouvres_mois} j/m</span>
            </div>
          </div>
        ))}
      </div>

      {projet.points_de_vente.length === 0 && !adding && (
        <div className="text-center py-12 text-tertiary">
          <div className="text-3xl mb-2">\uD83C\uDFE2</div>
          <p className="text-sm">Aucun point de vente</p>
          <p className="text-xs mt-1">Cliquez "+ Ajouter un PdV" pour commencer</p>
        </div>
      )}
    </div>
  );
}
