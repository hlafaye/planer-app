// Planer custom: Configurateur AO — Referentiels (Spreadsheet mode)
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { useProjetAO } from "../layout";

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

export default function ReferentielsPage() {
  const { apiBase } = useProjetAO();
  const [subTab, setSubTab] = useState("postes");
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [localData, setLocalData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const serverDataRef = useRef<any[]>([]);
  const config = REF_CONFIGS.find((c) => c.key === subTab)!;

  useEffect(() => {
    REF_CONFIGS.forEach((cfg) => {
      fetch(`${apiBase}/${cfg.endpoint}`, { credentials: "include" })
        .then((r) => r.json())
        .then((d) => setCounts((prev) => ({ ...prev, [cfg.key]: (Array.isArray(d) ? d : d.results || []).length })))
        .catch(() => {});
    });
  }, [apiBase]);

  const fetchData = useCallback(() => {
    setLoading(true);
    fetch(`${apiBase}/${config.endpoint}`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => { const arr = Array.isArray(d) ? d : d.results || []; setLocalData(arr); serverDataRef.current = arr; setCounts((p) => ({ ...p, [subTab]: arr.length })); setLoading(false); })
      .catch(() => setLoading(false));
  }, [apiBase, config.endpoint, subTab]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const scheduleSave = useCallback((itemId: number, field: string, value: any) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      setSaveStatus("saving");
      const resp = await fetch(`${apiBase}/${config.endpoint}${itemId}/`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ [field]: value }),
      });
      if (resp.ok) {
        setSaveStatus("saved");
        const r2 = await fetch(`${apiBase}/${config.endpoint}`, { credentials: "include" });
        if (r2.ok) { const d = await r2.json(); serverDataRef.current = Array.isArray(d) ? d : d.results || []; }
      } else setSaveStatus("idle");
      setTimeout(() => setSaveStatus("idle"), 2000);
    }, 800);
  }, [apiBase, config.endpoint]);

  const handleChange = useCallback((itemId: number, field: string, value: any) => {
    setLocalData((prev) => prev.map((item) => item.id === itemId ? { ...item, [field]: value } : item));
    scheduleSave(itemId, field, value);
  }, [scheduleSave]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent, rowIdx: number, colIdx: number) => {
    const editableCols = config.columns.filter((c) => c.editable);
    if (e.key === "Tab") {
      e.preventDefault();
      let nc = e.shiftKey ? colIdx - 1 : colIdx + 1;
      let nr = rowIdx;
      if (nc >= editableCols.length) { nc = 0; nr = Math.min(rowIdx + 1, localData.length - 1); }
      else if (nc < 0) { nc = editableCols.length - 1; nr = Math.max(rowIdx - 1, 0); }
      const el = tableRef.current?.querySelector(`[data-row="${nr}"][data-col="${nc}"]`) as HTMLInputElement;
      el?.focus(); el?.select();
    }
    if (e.key === "Enter") { e.preventDefault(); const el = tableRef.current?.querySelector(`[data-row="${Math.min(rowIdx + 1, localData.length - 1)}"][data-col="${colIdx}"]`) as HTMLInputElement; el?.focus(); el?.select(); }
    if (e.key === "Escape") { const sv = serverDataRef.current.find((i: any) => i.id === localData[rowIdx]?.id); if (sv) { const f = config.columns.filter((c) => c.editable)[colIdx].key; setLocalData((p) => p.map((item) => item.id === sv.id ? { ...item, [f]: sv[f] } : item)); } }
  }, [config.columns, localData]);

  const addItem = async () => {
    const resp = await fetch(`${apiBase}/${config.endpoint}`, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(config.defaultNew) });
    if (resp.ok) fetchData();
  };

  const deleteItem = async (id: number) => {
    await fetch(`${apiBase}/${config.endpoint}${id}/`, { method: "DELETE", credentials: "include" });
    fetchData();
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-1 border-b border-border-subtle overflow-x-auto">
        {REF_CONFIGS.map((cfg) => {
          const count = counts[cfg.key];
          return (
            <button key={cfg.key} onClick={() => setSubTab(cfg.key)}
              className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${subTab === cfg.key ? "border-accent-primary text-primary" : "border-transparent text-tertiary hover:text-secondary"}`}
            >{cfg.label}{count != null && count > 0 ? ` (${count})` : ""}</button>
          );
        })}
      </div>
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-primary">{config.label}</span>
          <span className="text-xs text-tertiary">{localData.length} elements</span>
          <span className="text-xs text-placeholder">{saveStatus === "saving" ? "\u27F3 Enregistrement..." : saveStatus === "saved" ? "\u2713 Sauvegarde" : ""}</span>
        </div>
        <button onClick={addItem} className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded text-accent-primary hover:bg-accent-primary/10 transition-colors">+ Ajouter</button>
      </div>
      <div className="border border-border-subtle rounded-lg overflow-auto max-h-[65vh]">
        {loading ? <div className="p-8 text-center text-tertiary text-sm">Chargement...</div> : (
          <table ref={tableRef} className="w-full border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="bg-surface-2">
                {config.columns.map((col) => <th key={col.key} className="px-2 py-1.5 text-left text-[11px] font-medium text-tertiary uppercase tracking-wider border-b border-border-subtle">{col.label}</th>)}
                <th className="px-2 py-1.5 w-8 border-b border-border-subtle"></th>
              </tr>
            </thead>
            <tbody>
              {localData.map((item, rowIdx) => {
                let ei = 0;
                return (
                  <tr key={item.id} className="group border-t border-border-subtle/50">
                    {config.columns.map((col) => {
                      const isEd = col.editable;
                      const ci = isEd ? ei++ : -1;
                      return (
                        <td key={col.key} className="px-0 py-0">
                          {isEd ? (
                            col.type === "select" ? (
                              <select data-row={rowIdx} data-col={ci} value={item[col.key] ?? ""} onChange={(e) => handleChange(item.id, col.key, e.target.value)} onKeyDown={(e) => handleKeyDown(e, rowIdx, ci)}
                                className="w-full px-2 py-1.5 text-sm bg-transparent text-primary border-0 outline-none focus:bg-layer-1-hover transition-colors duration-75">
                                {col.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                              </select>
                            ) : (
                              <input data-row={rowIdx} data-col={ci} type={col.type === "number" ? "number" : "text"} step={col.type === "number" ? "any" : undefined}
                                value={item[col.key] ?? ""} onChange={(e) => handleChange(item.id, col.key, col.type === "number" ? (e.target.value === "" ? null : parseFloat(e.target.value)) : e.target.value)}
                                onKeyDown={(e) => handleKeyDown(e, rowIdx, ci)} onFocus={(e) => e.target.select()}
                                className="w-full px-2 py-1.5 text-sm bg-transparent text-primary border-0 outline-none focus:bg-layer-1-hover transition-colors duration-75 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                            )
                          ) : <span className="block px-2 py-1.5 text-sm text-secondary">{item[col.key] ?? "\u2014"}</span>}
                        </td>
                      );
                    })}
                    <td className="px-1 py-0"><button onClick={() => deleteItem(item.id)} className="opacity-0 group-hover:opacity-60 hover:!opacity-100 p-1 rounded text-placeholder hover:text-danger-secondary transition-opacity" tabIndex={-1}>&times;</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {!loading && localData.length === 0 && <div className="py-12 text-center text-placeholder text-sm">Aucun element. Cliquez "+ Ajouter".</div>}
      </div>
      <div className="text-[10px] text-placeholder px-1">Tab = cellule suivante &middot; Enter = ligne suivante &middot; Esc = annuler</div>
    </div>
  );
}
