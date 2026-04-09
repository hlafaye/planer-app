// Planer custom: Chat messages hook
import { useState, useEffect, useCallback } from "react";
import { API_BASE_URL } from "@plane/constants";

export type ChatMessage = {
  id: string;
  channel: string;
  actor: string | null;
  actor_name: string;
  actor_avatar: string;
  content: string;
  message_type: "user" | "bot" | "system" | "notification";
  parent: string | null;
  is_edited: boolean;
  edited_at: string | null;
  reactions: Record<string, string[]>;
  metadata: Record<string, unknown>;
  issue: string | null;
  attachments: Array<{
    id: string;
    file_name: string;
    file_url: string;
    file_size: number;
    file_type: string;
    ocr_text: string;
  }>;
  reply_count: number;
  created_at: string;
};

export function useChatMessages(workspaceSlug: string, channelId: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchMessages = useCallback(async () => {
    if (!channelId) return;
    setLoading(true);
    try {
      const resp = await fetch(
        `${API_BASE_URL}/api/v1/workspaces/${workspaceSlug}/chat/channels/${channelId}/messages/`,
        { credentials: "include" }
      );
      if (resp.ok) {
        const data = await resp.json();
        setMessages(Array.isArray(data) ? data : data.results || []);
      }
    } catch (err) {
      console.error("Failed to fetch messages:", err);
    } finally {
      setLoading(false);
    }
  }, [workspaceSlug, channelId]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!channelId) return;
      try {
        const resp = await fetch(
          `${API_BASE_URL}/api/v1/workspaces/${workspaceSlug}/chat/channels/${channelId}/messages/`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ content }),
          }
        );
        if (resp.ok) {
          const msg = await resp.json();
          setMessages((prev) => [...prev, msg]);
          // Refetch to get bot replies
          setTimeout(fetchMessages, 2000);
        }
      } catch (err) {
        console.error("Failed to send message:", err);
      }
    },
    [workspaceSlug, channelId, fetchMessages]
  );

  return { messages, loading, sendMessage, refresh: fetchMessages };
}
