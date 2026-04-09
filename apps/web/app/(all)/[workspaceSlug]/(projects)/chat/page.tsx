// Planer custom: Chat page
"use client";

import { useParams } from "next/navigation";
import { ChatPanel } from "@/components/chat";

export default function ChatPage() {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();

  return (
    <div className="h-full w-full">
      <ChatPanel workspaceSlug={workspaceSlug} />
    </div>
  );
}
