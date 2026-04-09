// Planer custom: Chat channels hook
import { useState, useEffect, useCallback } from "react";
import { API_BASE_URL } from "@plane/constants";

export type ChatChannel = {
  id: string;
  name: string;
  description: string;
  channel_type: "general" | "project" | "module" | "direct";
  workspace: string;
  project: string | null;
  module: string | null;
  is_archived: boolean;
  member_count: number;
  last_message: {
    content: string;
    actor_name: string;
    created_at: string;
  } | null;
  unread_count: number;
};

export function useChatChannels(workspaceSlug: string) {
  const [channels, setChannels] = useState<ChatChannel[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchChannels = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await fetch(
        `${API_BASE_URL}/api/v1/workspaces/${workspaceSlug}/chat/channels/`,
        { credentials: "include" }
      );
      if (resp.ok) {
        const data = await resp.json();
        setChannels(Array.isArray(data) ? data : data.results || []);
      }
    } catch (err) {
      console.error("Failed to fetch channels:", err);
    } finally {
      setLoading(false);
    }
  }, [workspaceSlug]);

  useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

  return { channels, loading, refresh: fetchChannels };
}
