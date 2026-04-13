// Planer custom: Main chat panel (channel list + messages)
import { useState, useEffect, useRef } from "react";
import { useChatChannels, type ChatChannel } from "./hooks/use-chat-channels";
import { useChatMessages } from "./hooks/use-chat-messages";
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
};

export function ChatPanel({ workspaceSlug }: Props) {
  const { channels, loading: channelsLoading } = useChatChannels(workspaceSlug);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const { messages, loading: messagesLoading, sendMessage, refresh } =
    useChatMessages(workspaceSlug, activeChannelId);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-select first channel
  useEffect(() => {
    if (channels.length > 0 && !activeChannelId) {
      setActiveChannelId(channels[0].id);
    }
  }, [channels, activeChannelId]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // No polling — messages refresh after send + bot reply only
  // Future: replace with WebSocket push via plane-live

  const activeChannel = channels.find((c) => c.id === activeChannelId);

  return (
    <div className="flex h-full">
      {/* Channel sidebar */}
      <div className="w-64 flex-shrink-0 border-r border-custom-border-200 bg-custom-sidebar-background-100 overflow-y-auto">
        <div className="p-4 border-b border-custom-border-200">
          <h3 className="font-semibold text-sm text-custom-text-100">Chat</h3>
        </div>
        <div className="p-2">
          {channelsLoading ? (
            <div className="text-xs text-custom-text-400 p-2">Chargement...</div>
          ) : channels.length === 0 ? (
            <div className="text-xs text-custom-text-400 p-2">Aucun channel</div>
          ) : (
            channels.map((channel) => (
              <button
                key={channel.id}
                onClick={() => setActiveChannelId(channel.id)}
                className={`w-full text-left px-3 py-2 rounded-md text-sm flex items-center gap-2 transition-colors ${
                  channel.id === activeChannelId
                    ? "bg-[#BF5D48]/10 text-[#BF5D48] font-medium"
                    : "text-custom-text-200 hover:bg-custom-background-90"
                }`}
              >
                <span>{TYPE_ICONS[channel.channel_type] || "#"}</span>
                <span className="truncate">#{channel.name}</span>
                {channel.unread_count > 0 && (
                  <span className="ml-auto flex-shrink-0 rounded-full bg-[#BF5D48] px-1.5 py-0.5 text-xs text-white font-medium">
                    {channel.unread_count}
                  </span>
                )}
              </button>
            ))
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
            <div className="ml-auto text-xs text-custom-text-400">
              {activeChannel.member_count} membre{activeChannel.member_count !== 1 ? "s" : ""}
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
