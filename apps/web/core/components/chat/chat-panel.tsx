// Planer custom: Main chat panel (grouped channels + messages + WebSocket)
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useChatChannels, type ChatChannel } from "./hooks/use-chat-channels";
import { useChatMessages, type ChatMessage } from "./hooks/use-chat-messages";
import { ChatMessageItem } from "./chat-message";
import { ChatInput } from "./chat-input";

type Props = {
  workspaceSlug: string;
};

const TYPE_ICONS: Record<string, string> = {
  general: "🏠",
  project: "📁",
  module: "📦",
  direct: "💬",
  group: "👥",
};

const GROUP_LABELS: Record<string, string> = {
  general: "Général",
  project: "Projet",
  module: "Modules",
  direct: "Messages privés",
  group: "Groupes",
};

const GROUP_ORDER = ["general", "project", "module", "direct", "group"];

function ChannelGroup({
  type,
  channels,
  activeChannelId,
  onSelect,
}: {
  type: string;
  channels: ChatChannel[];
  activeChannelId: string | null;
  onSelect: (id: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  if (channels.length === 0) return null;

  return (
    <div className="mb-1">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-custom-text-400 hover:text-custom-text-200 uppercase tracking-wider"
      >
        <span className={`transition-transform ${collapsed ? "" : "rotate-90"}`}>▶</span>
        <span>{TYPE_ICONS[type]} {GROUP_LABELS[type] || type}</span>
        <span className="ml-auto text-custom-text-400">{channels.length}</span>
      </button>
      {!collapsed &&
        channels.map((channel) => (
          <button
            key={channel.id}
            onClick={() => onSelect(channel.id)}
            className={`w-full text-left px-3 py-1.5 rounded-md text-sm flex items-center gap-2 transition-colors ml-2 ${
              channel.id === activeChannelId
                ? "bg-[#BF5D48]/10 text-[#BF5D48] font-medium"
                : "text-custom-text-200 hover:bg-custom-background-90"
            }`}
          >
            <span className="truncate">#{channel.name}</span>
            {channel.unread_count > 0 && (
              <span className="ml-auto flex-shrink-0 rounded-full bg-[#BF5D48] px-1.5 py-0.5 text-xs text-white font-medium">
                {channel.unread_count}
              </span>
            )}
          </button>
        ))}
    </div>
  );
}

export function ChatPanel({ workspaceSlug }: Props) {
  const { channels, loading: channelsLoading } = useChatChannels(workspaceSlug);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const { messages, loading: messagesLoading, sendMessage, refresh, appendMessage } =
    useChatMessages(workspaceSlug, activeChannelId);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Group channels: workspace-level first, then by project
  const { workspaceChannels, projectGroups } = useMemo(() => {
    const ws: ChatChannel[] = [];
    const byProject: Record<string, { name: string; main: ChatChannel[]; modules: ChatChannel[] }> = {};

    for (const ch of channels) {
      if (!ch.project) {
        ws.push(ch);
      } else {
        if (!byProject[ch.project]) {
          byProject[ch.project] = { name: "", main: [], modules: [] };
        }
        if (ch.channel_type === "project") {
          byProject[ch.project].main.push(ch);
          byProject[ch.project].name = ch.name;
        } else {
          byProject[ch.project].modules.push(ch);
        }
      }
    }
    return { workspaceChannels: ws, projectGroups: Object.entries(byProject) };
  }, [channels]);

  // Auto-select first channel
  useEffect(() => {
    if (channels.length > 0 && !activeChannelId) {
      setActiveChannelId(channels[0].id);
    }
  }, [channels, activeChannelId]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // WebSocket connection for real-time messages
  useEffect(() => {
    if (!activeChannelId) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws/chat/${activeChannelId}/`;

    const connect = () => {
      const ws = new WebSocket(wsUrl);

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "message.new" && data.message) {
            appendMessage(data.message);
          }
        } catch (e) {
          // ignore parse errors
        }
      };

      ws.onclose = () => {
        // Reconnect after 3s
        setTimeout(() => {
          if (wsRef.current === ws) connect();
        }, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };

      wsRef.current = ws;
    };

    connect();

    return () => {
      if (wsRef.current) {
        const ws = wsRef.current;
        wsRef.current = null;
        ws.close();
      }
    };
  }, [activeChannelId, appendMessage]);

  const activeChannel = channels.find((c) => c.id === activeChannelId);

  return (
    <div className="flex h-full">
      {/* Channel sidebar — grouped */}
      <div className="w-64 flex-shrink-0 border-r border-custom-border-200 bg-custom-sidebar-background-100 overflow-y-auto">
        <div className="p-4 border-b border-custom-border-200">
          <h3 className="font-semibold text-sm text-custom-text-100">💬 Chat</h3>
        </div>
        <div className="py-2">
          {channelsLoading ? (
            <div className="text-xs text-custom-text-400 p-3">Chargement...</div>
          ) : channels.length === 0 ? (
            <div className="text-xs text-custom-text-400 p-3">Aucun channel</div>
          ) : (
            <>
              {/* Workspace-level channels */}
              {workspaceChannels.length > 0 && (
                <ChannelGroup type="general" channels={workspaceChannels} activeChannelId={activeChannelId} onSelect={setActiveChannelId} />
              )}

              {/* Project-grouped channels */}
              {projectGroups.map(([projId, group]) => (
                <div key={projId} className="mb-1">
                  <div className="px-3 py-1.5 text-xs font-semibold text-custom-text-400 uppercase tracking-wider flex items-center gap-1">
                    📁 {group.name || "Projet"}
                  </div>
                  {/* Project main channel */}
                  {group.main.map((ch) => (
                    <button key={ch.id} onClick={() => setActiveChannelId(ch.id)} className={`w-full text-left px-3 py-1.5 rounded-md text-sm flex items-center gap-2 transition-colors ml-2 ${ch.id === activeChannelId ? "bg-[#BF5D48]/10 text-[#BF5D48] font-medium" : "text-custom-text-200 hover:bg-custom-background-90"}`}>
                      <span className="truncate">#{ch.name}</span>
                      {ch.unread_count > 0 && <span className="ml-auto rounded-full bg-[#BF5D48] px-1.5 py-0.5 text-xs text-white font-medium">{ch.unread_count}</span>}
                    </button>
                  ))}
                  {/* Module channels */}
                  {group.modules.length > 0 && (
                    <ChannelGroup type="module" channels={group.modules} activeChannelId={activeChannelId} onSelect={setActiveChannelId} />
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Channel header */}
        {activeChannel && (
          <div className="flex items-center gap-3 px-4 py-3 border-b border-custom-border-200">
            <span className="text-lg">{TYPE_ICONS[activeChannel.channel_type]}</span>
            <div>
              <h4 className="font-semibold text-sm text-custom-text-100">
                #{activeChannel.name}
              </h4>
              {activeChannel.description && (
                <p className="text-xs text-custom-text-400">{activeChannel.description}</p>
              )}
            </div>
            <div className="ml-auto flex items-center gap-3">
              <button
                onClick={refresh}
                className="text-xs text-custom-text-400 hover:text-[#BF5D48] transition-colors"
                title="Rafraîchir les messages"
              >
                🔄
              </button>
              <span className="text-xs text-custom-text-400">
                {activeChannel.member_count} membre{activeChannel.member_count !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          {messagesLoading ? (
            <div className="flex items-center justify-center h-full text-sm text-custom-text-400">
              Chargement...
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-custom-text-400">
              <span className="text-3xl mb-2">💬</span>
              <p className="text-sm">Aucun message</p>
              <p className="text-xs mt-1">
                Tapez <code className="bg-custom-background-90 px-1 rounded">@planer aide</code> pour commencer
              </p>
            </div>
          ) : (
            <div>
              {messages.map((msg) => (
                <ChatMessageItem key={msg.id} message={msg} />
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input */}
        {activeChannel && (
          <ChatInput
            onSend={sendMessage}
            disabled={!activeChannelId}
            placeholder={`Message #${activeChannel.name}...`}
          />
        )}
      </div>
    </div>
  );
}
