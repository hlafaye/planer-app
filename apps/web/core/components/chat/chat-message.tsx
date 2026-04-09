// Planer custom: Single chat message component
import type { ChatMessage } from "./hooks/use-chat-messages";

const TYPE_STYLES: Record<string, string> = {
  user: "",
  bot: "bg-[#385835]/10 border-l-2 border-[#385835]",
  system: "bg-[#929F88]/10 italic text-[#929F88]",
  notification: "bg-[#BF5D48]/5 border-l-2 border-[#BF5D48]",
};

export function ChatMessageItem({ message }: { message: ChatMessage }) {
  const isBot = message.message_type === "bot";
  const isSystem = message.message_type === "system" || message.message_type === "notification";
  const timeStr = new Date(message.created_at).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className={`px-4 py-2 hover:bg-custom-background-90/50 ${TYPE_STYLES[message.message_type] || ""}`}>
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="flex-shrink-0 mt-0.5">
          {isBot ? (
            <div className="w-8 h-8 rounded-full bg-[#385835] flex items-center justify-center text-white text-xs font-bold">
              🤖
            </div>
          ) : isSystem ? (
            <div className="w-8 h-8 rounded-full bg-[#929F88]/20 flex items-center justify-center text-xs">
              ℹ️
            </div>
          ) : (
            <div className="w-8 h-8 rounded-full bg-[#BF5D48] flex items-center justify-center text-white text-xs font-bold uppercase">
              {(message.actor_name || "?")[0]}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="font-semibold text-sm text-custom-text-100">
              {isBot ? "@planer" : isSystem ? "Système" : message.actor_name}
            </span>
            <span className="text-xs text-custom-text-400">{timeStr}</span>
            {message.is_edited && (
              <span className="text-xs text-custom-text-400">(modifié)</span>
            )}
          </div>
          <div className="text-sm text-custom-text-200 whitespace-pre-wrap break-words mt-0.5">
            {message.content}
          </div>

          {/* Attachments */}
          {message.attachments?.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {message.attachments.map((att) => (
                <a
                  key={att.id}
                  href={att.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-custom-background-90 text-xs text-custom-text-200 hover:bg-custom-background-80"
                >
                  📎 {att.file_name}
                  <span className="text-custom-text-400">
                    ({Math.round(att.file_size / 1024)}KB)
                  </span>
                </a>
              ))}
            </div>
          )}

          {/* Reactions */}
          {Object.keys(message.reactions || {}).length > 0 && (
            <div className="mt-1 flex gap-1">
              {Object.entries(message.reactions).map(([emoji, users]) => (
                <span
                  key={emoji}
                  className="px-2 py-0.5 rounded-full bg-custom-background-90 text-xs cursor-pointer hover:bg-custom-background-80"
                >
                  {emoji} {(users as string[]).length}
                </span>
              ))}
            </div>
          )}

          {/* Reply count */}
          {message.reply_count > 0 && (
            <div className="mt-1 text-xs text-[#BF5D48] cursor-pointer hover:underline">
              {message.reply_count} réponse{message.reply_count > 1 ? "s" : ""}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
