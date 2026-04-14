// Planer custom: Dashboard page with project selector
"use client";

import { useParams } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { DashboardPanel } from "@/components/dashboard";

type ProjectInfo = {
  id: string;
  name: string;
  identifier: string;
  total_members?: number;
};

const LS_KEY = "dashboard_selected_project_id";

export default function DashboardPage() {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const selectorRef = useRef<HTMLDivElement>(null);

  // Fetch projects
  useEffect(() => {
    async function fetchProjects() {
      try {
        const resp = await fetch(
          `/api/workspaces/${workspaceSlug}/projects/`,
          { credentials: "include" }
        );
        if (!resp.ok) {
          setError("Impossible de charger les projets");
          return;
        }
        const data = await resp.json();
        let list: any[] = [];
        if (Array.isArray(data)) list = data;
        else if (data.results && Array.isArray(data.results)) list = data.results;
        else {
          for (const val of Object.values(data)) {
            if (Array.isArray(val)) { list = val; break; }
          }
        }

        if (list.length === 0) {
          setError("Aucun projet trouvé");
          return;
        }

        setProjects(list.map((p: any) => ({
          id: p.id,
          name: p.name,
          identifier: p.identifier || "",
          total_members: p.total_members,
        })));

        // Restore from localStorage or use first project
        const saved = typeof window !== "undefined" ? localStorage.getItem(LS_KEY) : null;
        const validSaved = saved && list.some((p: any) => p.id === saved);
        setSelectedProjectId(validSaved ? saved! : list[0].id);
      } catch (err) {
        console.error("Dashboard: failed to fetch projects", err);
        setError("Erreur de chargement");
      }
    }
    fetchProjects();
  }, [workspaceSlug]);

  // Save selection to localStorage
  useEffect(() => {
    if (selectedProjectId && typeof window !== "undefined") {
      localStorage.setItem(LS_KEY, selectedProjectId);
    }
  }, [selectedProjectId]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (selectorRef.current && !selectorRef.current.contains(e.target as Node)) {
        setSelectorOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-custom-text-400 gap-2">
        <span className="text-2xl">📊</span>
        <p className="text-sm">{error}</p>
        <button onClick={() => window.location.reload()} className="text-xs text-[#BF5D48] hover:underline mt-2">
          Réessayer
        </button>
      </div>
    );
  }

  if (!selectedProjectId) {
    return (
      <div className="flex items-center justify-center h-full text-custom-text-400">
        <span className="animate-pulse">Chargement du dashboard...</span>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col">
      {/* Project selector */}
      <div className="px-6 pt-4 pb-2">
        <div ref={selectorRef} className="relative inline-block">
          <button
            onClick={() => setSelectorOpen(!selectorOpen)}
            className="flex items-center gap-3 px-4 py-3 rounded-xl border border-custom-border-200 bg-custom-background-100 hover:border-[#BF5D48] transition-colors shadow-sm min-w-[320px]"
          >
            <span className="text-2xl">🎯</span>
            <div className="text-left">
              <div className="text-[10px] uppercase tracking-widest text-custom-text-400">Projet affiché</div>
              <div className="text-sm font-semibold text-custom-text-100">
                {selectedProject?.name || "Sélectionner..."}
              </div>
            </div>
            <span className={`ml-auto text-custom-text-400 transition-transform ${selectorOpen ? "rotate-180" : ""}`}>▾</span>
          </button>

          {selectorOpen && (
            <div className="absolute top-full left-0 mt-1 min-w-[400px] rounded-xl border border-custom-border-200 bg-custom-background-100 shadow-xl z-50 py-1 overflow-hidden">
              <div className="px-3 py-2 text-[10px] uppercase tracking-widest text-custom-text-400">
                Mes projets
              </div>
              {projects.map((project) => (
                <button
                  key={project.id}
                  onClick={() => { setSelectedProjectId(project.id); setSelectorOpen(false); }}
                  className={`w-full text-left px-4 py-2.5 flex items-center justify-between hover:bg-[#BF5D48]/5 transition-colors ${
                    project.id === selectedProjectId ? "bg-[#BF5D48]/10 text-[#BF5D48]" : "text-custom-text-200"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span>🎯</span>
                    <span className="text-sm font-medium">{project.name}</span>
                  </div>
                  <span className="text-xs text-custom-text-400">{project.identifier}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Dashboard panel */}
      <div className="flex-1 min-h-0">
        <DashboardPanel workspaceSlug={workspaceSlug} projectId={selectedProjectId} />
      </div>
    </div>
  );
}
