// Planer custom: Dashboard page
"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { DashboardPanel } from "@/components/dashboard";

export default function DashboardPage() {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const [projectId, setProjectId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProject() {
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
        // Handle various response formats
        let projects: any[] = [];
        if (Array.isArray(data)) {
          projects = data;
        } else if (data.results && Array.isArray(data.results)) {
          projects = data.results;
        } else if (typeof data === "object") {
          // Might be grouped — flatten
          for (const val of Object.values(data)) {
            if (Array.isArray(val)) {
              projects = val;
              break;
            }
          }
        }

        if (projects.length > 0) {
          setProjectId(projects[0].id);
        } else {
          setError("Aucun projet trouvé");
        }
      } catch (err) {
        console.error("Dashboard: failed to fetch projects", err);
        setError("Erreur de chargement");
      }
    }
    fetchProject();
  }, [workspaceSlug]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-custom-text-400 gap-2">
        <span className="text-2xl">📊</span>
        <p className="text-sm">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="text-xs text-[#BF5D48] hover:underline mt-2"
        >
          Réessayer
        </button>
      </div>
    );
  }

  if (!projectId) {
    return (
      <div className="flex items-center justify-center h-full text-custom-text-400">
        <span className="animate-pulse">Chargement du dashboard...</span>
      </div>
    );
  }

  return (
    <div className="h-full w-full">
      <DashboardPanel workspaceSlug={workspaceSlug} projectId={projectId} />
    </div>
  );
}
