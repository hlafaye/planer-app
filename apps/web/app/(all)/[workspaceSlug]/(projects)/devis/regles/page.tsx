// Planer custom: Validation rules config page
"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";

type Rule = {
  id: string;
  type_devis: string;
  max_amount: number | null;
  mode: string;
  validators: { id: string; display_name: string; email: string }[];
  order: number;
};

type Member = { id: string; display_name: string; email: string; member: { id: string; display_name: string; email: string } };

const TYPE_TABS = [
  { key: "fournisseur", label: "📦 Fournisseurs" },
  { key: "sous_traitant", label: "🔧 Sous-traitants" },
  { key: "personnel", label: "👥 Personnel" },
  { key: "client", label: "💼 Clients" },
];

const MODE_LABELS: Record<string, { label: string; color: string }> = {
  auto: { label: "Auto-approuvé", color: "bg-emerald-500/10 text-emerald-400" },
  one: { label: "1 validateur", color: "bg-blue-500/10 text-blue-400" },
  chain: { label: "Chaîne", color: "bg-orange-500/10 text-orange-400" },
  all: { label: "Tous", color: "bg-purple-500/10 text-purple-400" },
};

const formatAmount = (n: number | null) => {
  if (n === null) return "Pas de limite";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
};

export default function ReglesValidationPage() {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const router = useRouter();
  const [projectId, setProjectId] = useState<string | null>(null);
  const [activeType, setActiveType] = useState("fournisseur");
  const [rules, setRules] = useState<Rule[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  // Modal form state
  const [modalForm, setModalForm] = useState({
    max_amount: "",
    mode: "one",
    validator_ids: [] as string[],
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

  // Fetch workspace members
  useEffect(() => {
    async function fetchMembers() {
      const resp = await fetch(`/api/workspaces/${workspaceSlug}/members/`, { credentials: "include" });
      if (resp.ok) {
        const data = await resp.json();
        setMembers(Array.isArray(data) ? data : data.results || []);
      }
    }
    fetchMembers();
  }, [workspaceSlug]);

  // Fetch rules
  const fetchRules = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const resp = await fetch(
        `/api/v1/workspaces/${workspaceSlug}/projects/${projectId}/devis/validation-rules/?type_devis=${activeType}`,
        { credentials: "include" }
      );
      if (resp.ok) {
        const data = await resp.json();
        setRules(Array.isArray(data) ? data : data.results || []);
      }
    } catch (err) {
      console.error("Fetch rules error:", err);
    } finally {
      setLoading(false);
    }
  }, [workspaceSlug, projectId, activeType]);

  useEffect(() => { fetchRules(); }, [fetchRules]);

  const handleCreateRule = async () => {
    if (!projectId) return;
    try {
      const resp = await fetch(
        `/api/v1/workspaces/${workspaceSlug}/projects/${projectId}/devis/validation-rules/`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            type_devis: activeType,
            max_amount: modalForm.max_amount ? parseFloat(modalForm.max_amount) : null,
            mode: modalForm.mode,
            validators: modalForm.validator_ids,
          }),
        }
      );
      if (resp.ok) {
        setShowModal(false);
        setModalForm({ max_amount: "", mode: "one", validator_ids: [] });
        fetchRules();
      }
    } catch (err) {
      console.error("Create rule error:", err);
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (!projectId || !confirm("Supprimer cette règle ?")) return;
    await fetch(
      `/api/v1/workspaces/${workspaceSlug}/projects/${projectId}/devis/validation-rules/${ruleId}/`,
      { method: "DELETE", credentials: "include" }
    );
    fetchRules();
  };

  const toggleValidator = (id: string) => {
    setModalForm((prev) => ({
      ...prev,
      validator_ids: prev.validator_ids.includes(id)
        ? prev.validator_ids.filter((v) => v !== id)
        : [...prev.validator_ids, id],
    }));
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="mb-6">
          <button onClick={() => router.back()} className="text-xs text-custom-text-400 hover:text-custom-text-200 mb-1">
            ← Retour aux devis
          </button>
          <h1 className="text-lg font-bold text-custom-text-100">⚙️ Règles de Validation</h1>
          <p className="text-xs text-custom-text-400 mt-0.5">Configuration des seuils et validateurs par type de devis</p>
        </div>

        {/* Info box */}
        <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 mb-6 text-xs text-blue-300">
          💡 Pour chaque type de devis, définissez des seuils de montant. Au-delà de chaque seuil, les validateurs configurés doivent approuver le devis avant qu'il puisse être commandé.
        </div>

        {/* Type tabs */}
        <div className="flex items-center gap-1 mb-6 border-b border-custom-border-200 pb-2">
          {TYPE_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveType(tab.key)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                activeType === tab.key
                  ? "bg-[#BF5D48]/10 text-[#BF5D48]"
                  : "text-custom-text-400 hover:text-custom-text-200 hover:bg-custom-background-90"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Rules list */}
        <div className="rounded-xl border border-custom-border-200 bg-custom-background-100 shadow-sm overflow-hidden mb-4">
          {loading ? (
            <div className="p-8 text-center text-sm text-custom-text-400">Chargement...</div>
          ) : rules.length === 0 ? (
            <div className="p-8 text-center">
              <span className="text-3xl block mb-2">⚙️</span>
              <p className="text-sm text-custom-text-400">Aucune règle configurée pour les devis {TYPE_TABS.find((t) => t.key === activeType)?.label}</p>
              <p className="text-xs text-custom-text-400 mt-1">Ajoutez un seuil pour activer la validation</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-custom-border-200" style={{ backgroundColor: "rgba(90,85,82,0.1)" }}>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-custom-text-400 uppercase">Seuil max HT</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-custom-text-400 uppercase">Mode</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-custom-text-400 uppercase">Validateurs</th>
                  <th className="text-right px-4 py-3 text-[10px] font-semibold text-custom-text-400 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((rule) => {
                  const modeStyle = MODE_LABELS[rule.mode] || MODE_LABELS.one;
                  return (
                    <tr key={rule.id} className="border-b border-custom-border-100">
                      <td className="px-4 py-3 font-mono font-medium text-custom-text-100">
                        {formatAmount(rule.max_amount)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${modeStyle.color}`}>
                          {modeStyle.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {rule.validators && rule.validators.length > 0 ? (
                            rule.validators.map((v: any) => (
                              <span key={v.id || v} className="text-xs px-2 py-0.5 rounded bg-custom-background-90 text-custom-text-200">
                                {v.display_name || v.email || v}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-custom-text-400">—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleDeleteRule(rule.id)}
                          className="text-xs text-red-400 hover:text-red-300"
                        >
                          Supprimer
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Add rule button */}
        <button
          onClick={() => setShowModal(true)}
          className="w-full rounded-xl border border-dashed border-custom-border-200 py-3 text-sm text-custom-text-400 hover:text-[#BF5D48] hover:border-[#BF5D48] transition-colors"
        >
          + Ajouter un seuil
        </button>

        {/* Modal — solid background, filtered validators */}
        {showModal && (
          <div
            className="fixed inset-0 flex items-center justify-center"
            style={{ zIndex: 9999, backgroundColor: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
            onClick={() => setShowModal(false)}
          >
            <div
              className="w-full max-w-md rounded-xl"
              style={{
                backgroundColor: "#1f1d1b",
                border: "1px solid #3a3633",
                boxShadow: "0 20px 50px rgba(0,0,0,0.6), 0 2px 8px rgba(0,0,0,0.4)",
                padding: "24px 28px",
                color: "#e8e0d8",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-base font-semibold mb-5 pb-3" style={{ borderBottom: "1px solid #3a3633" }}>
                Nouveau seuil de validation
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-[11px] uppercase tracking-wider font-semibold mb-1.5" style={{ color: "#8a837d" }}>
                    Seuil maximum HT (EUR) — vide = pas de limite
                  </label>
                  <input
                    type="number"
                    value={modalForm.max_amount}
                    onChange={(e) => setModalForm({ ...modalForm, max_amount: e.target.value })}
                    placeholder="Ex: 10000"
                    className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
                    style={{ backgroundColor: "#1a1a1a", border: "1.5px solid #3a3633", color: "#e8e0d8" }}
                    onFocus={(e) => (e.target.style.borderColor = "#BF5D48")}
                    onBlur={(e) => (e.target.style.borderColor = "#3a3633")}
                  />
                </div>

                <div>
                  <label className="block text-[11px] uppercase tracking-wider font-semibold mb-1.5" style={{ color: "#8a837d" }}>
                    Mode de validation *
                  </label>
                  <select
                    value={modalForm.mode}
                    onChange={(e) => setModalForm({ ...modalForm, mode: e.target.value })}
                    className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
                    style={{ backgroundColor: "#1a1a1a", border: "1.5px solid #3a3633", color: "#e8e0d8" }}
                  >
                    <option value="auto">Auto-approuvé</option>
                    <option value="one">Un validateur suffit</option>
                    <option value="chain">Chaîne (dans l'ordre)</option>
                    <option value="all">Tous doivent approuver</option>
                  </select>
                </div>

                {modalForm.mode !== "auto" && (
                  <div>
                    <label className="block text-[11px] uppercase tracking-wider font-semibold mb-1.5" style={{ color: "#8a837d" }}>
                      Validateurs * {modalForm.validator_ids.length > 0 && `(${modalForm.validator_ids.length} sélectionné${modalForm.validator_ids.length > 1 ? "s" : ""})`}
                    </label>
                    <div
                      className="space-y-1 max-h-44 overflow-y-auto rounded-lg p-2"
                      style={{ backgroundColor: "#1a1a1a", border: "1px solid #3a3633" }}
                    >
                      {members
                        .filter((m) => {
                          const user = m.member || m;
                          const email = (user.email || "").toLowerCase();
                          const name = (user.display_name || "").toLowerCase();
                          // Filter out bots and system users
                          return !["plane", "bot", "system", "planer"].some(
                            (s) => email.includes(s) || name === s
                          );
                        })
                        .map((m) => {
                          const user = m.member || m;
                          const userId = user.id;
                          const isSelected = modalForm.validator_ids.includes(userId);
                          return (
                            <button
                              key={userId}
                              onClick={() => toggleValidator(userId)}
                              className="w-full text-left px-3 py-2 rounded-md text-sm flex items-center gap-2.5 transition-colors"
                              style={{
                                backgroundColor: isSelected ? "rgba(191,93,72,0.15)" : "transparent",
                                color: isSelected ? "#BF5D48" : "#c0b8b0",
                              }}
                              onMouseEnter={(e) => { if (!isSelected) (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.04)"); }}
                              onMouseLeave={(e) => { if (!isSelected) (e.currentTarget.style.backgroundColor = "transparent"); }}
                            >
                              <div
                                className="w-[18px] h-[18px] rounded flex items-center justify-center text-[10px] flex-shrink-0"
                                style={{
                                  border: isSelected ? "none" : "1.5px solid #3a3633",
                                  backgroundColor: isSelected ? "#BF5D48" : "transparent",
                                  color: isSelected ? "white" : "transparent",
                                }}
                              >
                                ✓
                              </div>
                              <span>{user.display_name || user.email}</span>
                            </button>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 mt-6 pt-4" style={{ borderTop: "1px solid #3a3633" }}>
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-lg text-sm hover:opacity-80"
                  style={{ color: "#8a837d" }}
                >
                  Annuler
                </button>
                <button
                  onClick={handleCreateRule}
                  disabled={modalForm.mode !== "auto" && modalForm.validator_ids.length === 0}
                  className="px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ backgroundColor: "#BF5D48", color: "white" }}
                >
                  Enregistrer
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
