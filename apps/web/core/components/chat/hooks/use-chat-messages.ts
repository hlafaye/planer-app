// Planer custom: Chat messages hook
import { useState, useEffect, useCallback, useRef } from "react";
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
  const lastMsgIdRef = useRef("");
  const initialLoadDone = useRef(false);

  const fetchMessages = useCallback(async () => {
    if (!channelId) return;
    // Only show loading spinner on initial load
    if (!initialLoadDone.current) setLoading(true);
    try {
      const resp = await fetch(
        `${API_BASE_URL}/api/v1/workspaces/${workspaceSlug}/chat/channels/${channelId}/messages/?all=true`,
        { credentials: "include" }
      );
      if (resp.ok) {
        const data = await resp.json();
        const msgs: ChatMessage[] = Array.isArray(data) ? data : data.results || [];
        const lastId = msgs.length > 0 ? msgs[msgs.length - 1].id : "";
        // Only update state if there are actually new messages
        if (lastId !== lastMsgIdRef.current) {
          lastMsgIdRef.current = lastId;
          setMessages(msgs);
        }
      }
    } catch (err) {
      console.error("Failed to fetch messages:", err);
    } finally {
      setLoading(false);
      initialLoadDone.current = true;
    }
  }, [workspaceSlug, channelId]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  const sendMessage = useCallback(
    async (content: string, files?: File[]) => {
      if (!channelId) return;
      try {
        // 1. Send the message
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

          // 2. Upload attachments if any
          if (files && files.length > 0) {
            for (const file of files) {
              const formData = new FormData();
              formData.append("file", file);
              await fetch(
                `${API_BASE_URL}/api/v1/workspaces/${workspaceSlug}/chat/channels/${channelId}/messages/${msg.id}/attachments/`,
                {
                  method: "POST",
                  credentials: "include",
                  body: formData,
                }
              );
            }
          }

          // 3. Wait for bot reply then refetch
          const hasBotCommand = content.includes("@planer");
          setTimeout(fetchMessages, hasBotCommand ? 5000 : 2000);
        }
      } catch (err) {
        console.error("Failed to send message:", err);
      }
    },
    [workspaceSlug, channelId, fetchMessages]
  );

  const appendMessage = useCallback((msg: ChatMessage) => {
    setMessages((prev) => {
      // Avoid duplicates
      if (prev.some((m) => m.id === msg.id)) return prev;
      lastMsgIdRef.current = msg.id;
      return [...prev, msg];
    });
  }, []);

  return { messages, loading, sendMessage, refresh: fetchMessages, appendMessage };
}
