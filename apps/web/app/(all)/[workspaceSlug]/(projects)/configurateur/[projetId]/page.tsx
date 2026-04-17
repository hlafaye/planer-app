// Planer custom: Configurateur AO — redirect to vue-ensemble
"use client";

import { useParams, Navigate } from "react-router";

export default function ProjetAORedirect() {
  const { workspaceSlug, projetId } = useParams<{ workspaceSlug: string; projetId: string }>();
  return <Navigate to={`/${workspaceSlug}/configurateur/${projetId}/vue-ensemble`} replace />;
}
