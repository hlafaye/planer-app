// Planer custom: New devis page with PDF upload + AI extraction
"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";

type ExtractedData = {
  nom?: string;
  fournisseur_nom?: string;
  date_devis?: string;
  montant_ht?: number;
  tva_taux?: number;
  tva_montant?: number;
  montant_ttc?: number;
  date_livraison_prevue?: string;
  categorie?: string;
  description?: string;
};

type ValidationPreview = {
  mode: string;
  validators: { id: string; name: string }[];
  seuil_franchi: number | null;
  message?: string;
};

const TYPE_ICONS: Record<string, string> = { fournisseur: "📦", sous_traitant: "🔧", personnel: "👥", client: "💼" };
const CATEGORIES = [
  { value: "gros_materiel", label: "Gros matériel" },
  { value: "petit_materiel", label: "Petit matériel" },
  { value: "mobilier", label: "Mobilier" },
  { value: "it", label: "IT / Informatique" },
  { value: "signaletique", label: "Signalétique" },
  { value: "agencement", label: "Agencement" },
  { value: "services", label: "Services" },
  { value: "autre", label: "Autre" },
];

export default function NouveauDevisPage() {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const router = useRouter();
  const [projectId, setProjectId] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [aiFields, setAiFields] = useState<Set<string>>(new Set());
  const [validationPreview, setValidationPreview] = useState<ValidationPreview | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    type_devis: "fournisseur",
    nom: "",
    description: "",
    fournisseur_nom: "",
    categorie: "",
    poste_budget: "",
    montant_ht: "",
    tva_taux: "20",
    date_devis: new Date().toISOString().split("T")[0],
    date_livraison_prevue: "",
  });

  // Fetch project
  useEffect(() => {
    async function fetchProject() {
      const resp = await fetch(`/api/workspaces/${workspaceSlug}/projects/`, { credentials: "include" });
      if (resp.ok) {
        const data = await resp.json();
        const projects = data.results || data;
        if (Array.isArray(projects) && projects.length > 0) setProjectId(projects[0].id);
        else {
          for (const val of Object.values(data)) {
            if (Array.isArray(val) && (val as any[]).length > 0) { setProjectId((val as any[])[0].id); break; }
          }
        }
      }
    }
    fetchProject();
  }, [workspaceSlug]);

  // Preview validation when montant/type changes
  useEffect(() => {
    if (!projectId || !form.montant_ht || !form.type_devis) {
      setValidationPreview(null);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const resp = await fetch(
          `/api/v1/workspaces/${workspaceSlug}/projects/${projectId}/devis/preview-validation/`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ type_devis: form.type_devis, montant_ht: parseFloat(form.montant_ht) }),
          }
        );
        if (resp.ok) setValidationPreview(await resp.json());
      } catch {}
    }, 500);
    return () => clearTimeout(timer);
  }, [form.montant_ht, form.type_devis, projectId, workspaceSlug]);

  const updateField = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  // PDF upload + extraction
  const handlePDFUpload = async (file: File) => {
    if (!projectId) return;
    setExtracting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const resp = await fetch(
        `/api/v1/workspaces/${workspaceSlug}/projects/${projectId}/devis/extract-from-pdf/`,
        { method: "POST", credentials: "include", body: formData }
      );
      if (resp.ok) {
        const result = await resp.json();
        if (result.success && result.data) {
          const d = result.data;
          const filled = new Set<string>();
          if (d.nom) { updateField("nom", d.nom); filled.add("nom"); }
          if (d.fournisseur_nom) { updateField("fournisseur_nom", d.fournisseur_nom); filled.add("fournisseur_nom"); }
          if (d.date_devis) { updateField("date_devis", d.date_devis); filled.add("date_devis"); }
          if (d.montant_ht) { updateField("montant_ht", String(d.montant_ht)); filled.add("montant_ht"); }
          if (d.tva_taux) { updateField("tva_taux", String(d.tva_taux)); filled.add("tva_taux"); }
          if (d.date_livraison_prevue) { updateField("date_livraison_prevue", d.date_livraison_prevue); filled.add("date_livraison_prevue"); }
          if (d.categorie) { updateField("categorie", d.categorie); filled.add("categorie"); }
          if (d.description) { updateField("description", d.description); filled.add("description"); }
          setAiFields(filled);
        }
      }
    } catch (err) {
      console.error("PDF extraction error:", err);
    } finally {
      setExtracting(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file?.name.toLowerCase().endsWith(".pdf")) handlePDFUpload(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handlePDFUpload(file);
  };

  // Submit
  const handleSubmit = async (asDraft: boolean) => {
    if (!projectId || !form.nom || !form.montant_ht) return;
    setSaving(true);
    try {
      const resp = await fetch(
        `/api/v1/workspaces/${workspaceSlug}/projects/${projectId}/devis/`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            ...form,
            montant_ht: parseFloat(form.montant_ht),
            tva_taux: parseFloat(form.tva_taux || "20"),
          }),
        }
      );
      if (resp.ok) {
        const devis = await resp.json();
        // If not draft, submit for validation
        if (!asDraft) {
          await fetch(
            `/api/v1/workspaces/${workspaceSlug}/projects/${projectId}/devis/${devis.id}/action/`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ action: "submit" }),
            }
          );
        }
        router.push(`/${workspaceSlug}/devis`);
      }
    } catch (err) {
      console.error("Create devis error:", err);
    } finally {
      setSaving(false);
    }
  };

  const tvaAmount = form.montant_ht ? parseFloat(form.montant_ht) * parseFloat(form.tva_taux || "20") / 100 : 0;
  const ttcAmount = form.montant_ht ? parseFloat(form.montant_ht) + tvaAmount : 0;
  const formatMoney = (n: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);

  const inputClass = (field: string) =>
    `w-full rounded-lg border ${aiFields.has(field) ? "border-emerald-400 bg-emerald-500/5" : "border-custom-border-200 bg-custom-background-100"} px-3 py-2 text-sm text-custom-text-100 placeholder:text-custom-text-400 focus:border-[#BF5D48] focus:outline-none`;

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <button onClick={() => router.back()} className="text-xs text-custom-text-400 hover:text-custom-text-200 mb-1">
              ← Retour aux devis
            </button>
            <h1 className="text-lg font-bold text-custom-text-100">Nouveau devis</h1>
          </div>
        </div>

        {/* PDF Upload Zone */}
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className="rounded-xl border-2 border-dashed border-custom-border-200 hover:border-[#BF5D48] transition-colors p-8 text-center mb-6 cursor-pointer"
          onClick={() => document.getElementById("pdf-input")?.click()}
        >
          <input id="pdf-input" type="file" accept=".pdf" onChange={handleFileSelect} className="hidden" />
          {extracting ? (
            <div>
              <span className="text-3xl block mb-2 animate-pulse">🤖</span>
              <p className="text-sm text-[#BF5D48] font-medium">Analyse du PDF en cours...</p>
              <p className="text-xs text-custom-text-400 mt-1">OCR + extraction IA (5-15 secondes)</p>
            </div>
          ) : (
            <div>
              <span className="text-3xl block mb-2">📄</span>
              <p className="text-sm text-custom-text-200 font-medium">Glisser-déposer le PDF du devis</p>
              <p className="text-xs text-custom-text-400 mt-1">Ou cliquer pour parcourir</p>
              <p className="text-xs text-emerald-500 mt-2">🤖 L'IA extraira automatiquement les champs</p>
            </div>
          )}
        </div>

        {aiFields.size > 0 && (
          <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 mb-6 text-xs text-emerald-400 flex items-center gap-2">
            🤖 {aiFields.size} champs pré-remplis par l'IA — vérifiez et corrigez si nécessaire
          </div>
        )}

        {/* Section 1: Type */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-custom-text-100 mb-3">Type de devis</h3>
          <div className="grid grid-cols-4 gap-2">
            {(["fournisseur", "sous_traitant", "personnel", "client"] as const).map((t) => (
              <button
                key={t}
                onClick={() => updateField("type_devis", t)}
                className={`flex flex-col items-center gap-1 px-3 py-3 rounded-lg border text-sm transition-all ${
                  form.type_devis === t
                    ? "border-[#BF5D48] bg-[#BF5D48]/10 text-[#BF5D48] shadow-sm"
                    : "border-custom-border-200 text-custom-text-300 hover:border-custom-border-300"
                }`}
              >
                <span className="text-xl">{TYPE_ICONS[t]}</span>
                <span className="text-xs font-medium capitalize">{t.replace("_", "-")}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Section 2: Informations */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-custom-text-100 mb-3">Informations</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="text-xs text-custom-text-400 mb-1.5 block">Nom / Objet du devis *</label>
              <input value={form.nom} onChange={(e) => updateField("nom", e.target.value)} placeholder="Ex: Four mixte Rational 20 niveaux" className={inputClass("nom")} />
            </div>
            <div>
              <label className="text-xs text-custom-text-400 mb-1.5 block">Fournisseur</label>
              <input value={form.fournisseur_nom} onChange={(e) => updateField("fournisseur_nom", e.target.value)} placeholder="Nom du fournisseur" className={inputClass("fournisseur_nom")} />
            </div>
            <div>
              <label className="text-xs text-custom-text-400 mb-1.5 block">Catégorie</label>
              <select value={form.categorie} onChange={(e) => updateField("categorie", e.target.value)} className={inputClass("categorie")}>
                <option value="">Sélectionner...</option>
                {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-custom-text-400 mb-1.5 block">Poste budgétaire</label>
              <input value={form.poste_budget} onChange={(e) => updateField("poste_budget", e.target.value)} placeholder="Ex: Investissements gros matériel" className={inputClass("poste_budget")} />
            </div>
            <div>
              <label className="text-xs text-custom-text-400 mb-1.5 block">Description</label>
              <input value={form.description} onChange={(e) => updateField("description", e.target.value)} placeholder="Description optionnelle" className={inputClass("description")} />
            </div>
          </div>
        </div>

        {/* Section 3: Montants */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-custom-text-100 mb-3">Montants</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="text-xs text-custom-text-400 mb-1.5 block">Montant HT *</label>
              <input type="number" step="0.01" value={form.montant_ht} onChange={(e) => updateField("montant_ht", e.target.value)} placeholder="18450.00" className={inputClass("montant_ht")} />
            </div>
            <div>
              <label className="text-xs text-custom-text-400 mb-1.5 block">TVA %</label>
              <input type="number" step="0.1" value={form.tva_taux} onChange={(e) => updateField("tva_taux", e.target.value)} className={inputClass("tva_taux")} />
            </div>
            <div>
              <label className="text-xs text-custom-text-400 mb-1.5 block">TVA montant</label>
              <div className="rounded-lg border border-custom-border-200 bg-custom-background-90 px-3 py-2 text-sm text-custom-text-300">{form.montant_ht ? formatMoney(tvaAmount) : "—"}</div>
            </div>
            <div>
              <label className="text-xs text-custom-text-400 mb-1.5 block">Montant TTC</label>
              <div className="rounded-lg border border-custom-border-200 bg-custom-background-90 px-3 py-2 text-sm font-bold text-custom-text-100">{form.montant_ht ? formatMoney(ttcAmount) : "—"}</div>
            </div>
          </div>
        </div>

        {/* Validation Preview */}
        {validationPreview && validationPreview.mode !== "none" && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 mb-6">
            <div className="text-xs font-semibold text-emerald-400 mb-2">⚙️ Circuit de validation détecté</div>
            <div className="text-xs text-custom-text-400 mb-2">
              {form.montant_ht && formatMoney(parseFloat(form.montant_ht))} HT · Type {form.type_devis}
              {validationPreview.seuil_franchi && ` · Seuil: ${formatMoney(validationPreview.seuil_franchi)}`}
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="px-2 py-1 rounded bg-custom-background-90 text-custom-text-200">Vous (créateur)</span>
              {validationPreview.validators.map((v, i) => (
                <span key={v.id}>
                  <span className="text-custom-text-400 mx-1">→</span>
                  <span className="px-2 py-1 rounded bg-[#BF5D48]/10 text-[#BF5D48] font-medium">{v.name}</span>
                </span>
              ))}
              <span className="text-custom-text-400 mx-1">→</span>
              <span className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 font-medium">✅ Approuvé</span>
            </div>
          </div>
        )}

        {/* Section 4: Dates */}
        <div className="mb-8">
          <h3 className="text-sm font-semibold text-custom-text-100 mb-3">Dates</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-custom-text-400 mb-1.5 block">Date du devis</label>
              <input type="date" value={form.date_devis} onChange={(e) => updateField("date_devis", e.target.value)} className={inputClass("date_devis")} />
            </div>
            <div>
              <label className="text-xs text-custom-text-400 mb-1.5 block">Date de livraison prévue</label>
              <input type="date" value={form.date_livraison_prevue} onChange={(e) => updateField("date_livraison_prevue", e.target.value)} className={inputClass("date_livraison_prevue")} />
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-end gap-3 py-4 border-t border-custom-border-200">
          <button onClick={() => router.back()} className="px-4 py-2 rounded-lg text-sm text-custom-text-300 hover:bg-custom-background-90">
            Annuler
          </button>
          <button
            onClick={() => handleSubmit(true)}
            disabled={saving || !form.nom || !form.montant_ht}
            className="px-4 py-2 rounded-lg border border-custom-border-200 text-sm text-custom-text-200 hover:bg-custom-background-90 disabled:opacity-50"
          >
            Enregistrer en brouillon
          </button>
          <button
            onClick={() => handleSubmit(false)}
            disabled={saving || !form.nom || !form.montant_ht}
            className="px-4 py-2 rounded-lg bg-[#BF5D48] text-white text-sm font-medium hover:bg-[#a84d3b] disabled:opacity-50 shadow-sm"
          >
            {saving ? "Envoi..." : "Envoyer en validation →"}
          </button>
        </div>
      </div>
    </div>
  );
}
