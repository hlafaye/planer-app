// Planer custom: Configurateur AO — Documents & Generation
"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@plane/propel/button";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { useProjetAO } from "../layout";

const DOC_TYPES = [
  { key: "bpu", icon: "\uD83D\uDCCA", name: "BPU Alimentaires", format: ".xlsx", endpoint: "generer-bpu" },
  { key: "budget", icon: "\uD83D\uDCB6", name: "Budget Previsionnel", format: ".xlsx", endpoint: "generer-budget" },
  { key: "coutfixe", icon: "\uD83D\uDCCB", name: "Cout Fixe Multi-Scenarios", format: ".xlsx", endpoint: "generer-cout-fixe" },
  { key: "pptx", icon: "\uD83C\uDFAC", name: "Presentation Soutenance", format: ".pptx", endpoint: null },
  { key: "memoire", icon: "\uD83D\uDCDD", name: "Memoire Technique", format: ".docx", endpoint: null },
  { key: "programme", icon: "\uD83D\uDCC5", name: "Programme Ouverture", format: ".xlsx", endpoint: null },
  { key: "organigramme", icon: "\uD83D\uDC54", name: "Organigramme", format: ".pdf", endpoint: null },
  { key: "synthese", icon: "\uD83D\uDCCA", name: "Fiche Synthese", format: ".pdf", endpoint: null },
];

type LogEntry = { time: string; type: "ok" | "gen" | "info" | "err"; label: string; message: string };

export default function DocumentsPage() {
  const { projet, apiBase, mutate } = useProjetAO();
  const [scenarios, setScenarios] = useState<any[]>([]);
  const [selectedScenarioId, setSelectedScenarioId] = useState("");
  const [statuses, setStatuses] = useState<Record<string, string>>({});
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`${apiBase}/projets/${projet.id}/scenarios/`, { credentials: "include" })
      .then((r) => r.json()).then((d) => { const arr = Array.isArray(d) ? d : d.results || []; setScenarios(arr); if (arr.length) setSelectedScenarioId(arr[0].id); })
      .catch(() => {});
  }, [apiBase, projet.id]);

  const addLog = (type: LogEntry["type"], label: string, message: string) => {
    const time = new Date().toLocaleTimeString("fr-FR");
    setLogs((prev) => [...prev, { time, type, label, message }]);
    setTimeout(() => logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" }), 50);
  };

  const upload = async (file: File) => {
    setUploading(true);
    addLog("info", "UPLOAD", `${file.name} (${(file.size / 1024).toFixed(0)} KB)`);
    const fd = new FormData(); fd.append("cctp_pdf", file);
    const resp = await fetch(`${apiBase}/projets/${projet.id}/`, { method: "PATCH", credentials: "include", body: fd });
    setUploading(false);
    if (resp.ok) { mutate(); addLog("ok", "UPLOAD", "Document charge avec succes"); setToast({ type: TOAST_TYPE.SUCCESS, title: "Document uploade" }); }
    else { addLog("err", "UPLOAD", "Erreur upload"); setToast({ type: TOAST_TYPE.ERROR, title: "Erreur upload" }); }
  };

  const generate = async (doc: typeof DOC_TYPES[0]) => {
    if (!doc.endpoint) return;
    setStatuses((s) => ({ ...s, [doc.key]: "generating" }));
    addLog("gen", doc.key.toUpperCase(), `Generation ${doc.name}...`);
    try {
      const r = await fetch(`${apiBase}/projets/${projet.id}/${doc.endpoint}/`, {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ scenario_id: selectedScenarioId || null }),
      });
      if (!r.ok) { addLog("err", doc.key.toUpperCase(), "Erreur generation"); setStatuses((s) => ({ ...s, [doc.key]: "error" })); return; }
      const blob = await r.blob();
      addLog("ok", doc.key.toUpperCase(), `Genere (${(blob.size / 1024).toFixed(0)} KB)`);
      const cd = r.headers.get("content-disposition") || "";
      const m = cd.match(/filename="(.+?)"/);
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = m ? m[1] : `${doc.key}${doc.format}`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setStatuses((s) => ({ ...s, [doc.key]: "ready" }));
    } catch (e: any) {
      addLog("err", doc.key.toUpperCase(), e.message);
      setStatuses((s) => ({ ...s, [doc.key]: "error" }));
    }
  };

  const generateAll = async () => {
    addLog("gen", "ZIP", "Generation du dossier complet...");
    setStatuses((s) => ({ ...s, tout: "generating" }));
    try {
      const r = await fetch(`${apiBase}/projets/${projet.id}/generer-tout/`, {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ scenario_id: selectedScenarioId || null }),
      });
      if (!r.ok) { addLog("err", "ZIP", "Erreur"); setStatuses((s) => ({ ...s, tout: "error" })); return; }
      const blob = await r.blob();
      addLog("ok", "ZIP", `Dossier genere (${(blob.size / 1024).toFixed(0)} KB)`);
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `Dossier_AO_${projet.nom.replace(/ /g, "_")}.zip`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setStatuses((s) => ({ ...s, tout: "ready" }));
    } catch (e: any) { addLog("err", "ZIP", e.message); }
  };

  return (
    <div className="space-y-6">
      {/* Upload section */}
      <div className="rounded-lg border border-border-subtle bg-surface-1 overflow-hidden">
        <div className="px-5 py-3 border-b border-border-subtle bg-layer-1"><h2 className="text-sm font-semibold text-primary">Documents du projet</h2></div>
        <div className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div><div className="text-sm font-medium text-primary">CCTP / Cahier des charges</div><div className="text-xs text-tertiary">{projet.cctp_pdf ? "Document charge" : "Aucun document"}</div></div>
            <label><Button variant="secondary" size="sm" className="cursor-pointer">{uploading ? "Upload..." : projet.cctp_pdf ? "Remplacer" : "Uploader"}</Button>
              <input ref={inputRef} type="file" accept=".pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }} />
            </label>
          </div>
          {!projet.cctp_pdf && (
            <div onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f?.type === "application/pdf") upload(f); }}
              onClick={() => inputRef.current?.click()}
              className={`py-8 rounded-lg text-center cursor-pointer border-2 border-dashed transition-colors ${dragging ? "border-accent-primary bg-accent-primary/5" : "border-border-subtle hover:border-border-strong"}`}
            >
              <div className="text-2xl mb-1">\uD83D\uDCC4</div>
              <div className="text-sm text-secondary">{dragging ? "Deposer ici" : "Glisser-deposer ou cliquer"}</div>
              <div className="text-xs text-tertiary mt-1">PDF uniquement</div>
            </div>
          )}
          {projet.cctp_pdf && <iframe src={projet.cctp_pdf} className="w-full h-48 rounded border border-border-subtle mt-2" title="CCTP" />}
        </div>
      </div>

      {/* Generation section */}
      <div className="rounded-lg border border-border-subtle bg-surface-1 overflow-hidden">
        <div className="px-5 py-3 border-b border-border-subtle bg-layer-1 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-primary">Generation Excel</h2>
          {scenarios.length > 0 && (
            <select value={selectedScenarioId} onChange={(e) => setSelectedScenarioId(e.target.value)}
              className="h-7 px-2 rounded-md border border-border-subtle bg-layer-2 text-primary text-xs">
              {scenarios.map((s) => <option key={s.id} value={s.id}>{s.nom}</option>)}
            </select>
          )}
        </div>
        <div className="p-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            {DOC_TYPES.map((doc) => {
              const status = statuses[doc.key] || (doc.endpoint ? "idle" : "pending");
              return (
                <button key={doc.key} onClick={() => generate(doc)} disabled={!doc.endpoint || status === "generating"}
                  className={`rounded-xl border-2 p-4 text-center transition-all ${
                    status === "ready" ? "border-success-primary" : status === "generating" ? "border-accent-primary" : status === "error" ? "border-danger-primary" : "border-border-subtle"
                  } ${doc.endpoint ? "hover:border-accent-primary hover:shadow-sm cursor-pointer" : "border-dashed opacity-50 cursor-not-allowed"}`}
                >
                  {status === "generating" ? (
                    <div className="w-8 h-8 border-2 border-border-subtle border-t-accent-primary rounded-full animate-spin mx-auto mb-2" />
                  ) : (
                    <div className="text-2xl mb-2">{doc.icon}</div>
                  )}
                  <div className="text-xs font-semibold text-primary mb-0.5">{doc.name}</div>
                  <div className="text-[10px] text-tertiary uppercase tracking-wider mb-1.5">{doc.format}</div>
                  <span className={`inline-block text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                    status === "ready" ? "bg-success-primary/10 text-success-secondary"
                    : status === "generating" ? "bg-accent-primary/10 text-accent-primary"
                    : status === "error" ? "bg-danger-subtle text-danger-secondary"
                    : status === "pending" ? "bg-layer-3 text-tertiary"
                    : "bg-layer-3 text-tertiary"
                  }`}>
                    {status === "ready" ? "Pret" : status === "generating" ? "Generation..." : status === "error" ? "Erreur" : status === "pending" ? "En attente" : "Disponible"}
                  </span>
                </button>
              );
            })}
          </div>

          <Button variant="primary" size="xl" className="w-full" onClick={generateAll} disabled={statuses.tout === "generating"} loading={statuses.tout === "generating"}>
            Telecharger tout le dossier (.zip)
          </Button>
        </div>
      </div>

      {/* Generation log */}
      {logs.length > 0 && (
        <div ref={logRef} className="rounded-xl bg-[#1e1e1e] p-4 font-mono text-xs leading-relaxed max-h-48 overflow-y-auto">
          {logs.map((log, i) => (
            <div key={i}>
              <span className="text-[#555]">{log.time}</span>{" "}
              <span className={log.type === "ok" ? "text-[#6dba5e]" : log.type === "gen" ? "text-[#D68A79]" : log.type === "info" ? "text-[#7ab8db]" : "text-[#e05050]"}>
                [{log.label}]
              </span>{" "}
              <span className="text-[#999]">{log.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
