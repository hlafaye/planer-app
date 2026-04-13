// Planer custom: Dashboard page
"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { API_BASE_URL } from "@plane/constants";
import { DashboardPanel } from "@/components/dashboard";

export default function DashboardPage() {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const [projectId, setProjectId] = useState<string | null>(null);

  // Fetch first project in workspace
  useEffect(() => {
    async function fetchProject() {
      try {
        // Use internal API (session auth) instead of v1 (API key)
        const resp = await fetch(
          `${API_BASE_URL}/api/workspaces/${workspaceSlug}/projects/`,
          { credentials: "include" }
        );
        if (resp.ok) {
          const data = await resp.json();
          const projects = data.results || data;
          if (Array.isArray(projects) && projects.length > 0) {
            setProjectId(projects[0].id);
          }
        }
      } catch (err) {
        console.error("Failed to fetch project:", err);
      }
    }
    fetchProject();
  }, [workspaceSlug]);

  if (!projectId) {
    return (
      <div className="flex items-center justify-center h-full text-custom-text-400">
        Chargement du dashboard...
      </div>
    );
  }

  return (
    <div className="h-full w-full">
      <DashboardPanel workspaceSlug={workspaceSlug} projectId={projectId} />
    </div>
  );
}
