// Planer custom: Chat message input with file upload
import { useState, useRef, useCallback } from "react";

type SelectedFile = {
  file: File;
  preview: string | null;
};

type Props = {
  onSend: (content: string, files?: File[]) => void;
  disabled?: boolean;
  placeholder?: string;
};

export function ChatInput({ onSend, disabled, placeholder = "Écrire un message..." }: Props) {
  const [value, setValue] = useState("");
  const [files, setFiles] = useState<SelectedFile[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSend = useCallback(() => {
    const text = value.trim();
    if ((!text && files.length === 0) || disabled) return;
    onSend(text || "(pièce jointe)", files.map((f) => f.file));
    setValue("");
    setFiles([]);
    inputRef.current?.focus();
  }, [value, files, disabled, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files;
    if (!selected) return;
    const newFiles: SelectedFile[] = [];
    for (let i = 0; i < selected.length; i++) {
      const f = selected[i];
      const isImage = f.type.startsWith("image/");
      newFiles.push({
        file: f,
        preview: isImage ? URL.createObjectURL(f) : null,
      });
    }
    setFiles((prev) => [...prev, ...newFiles]);
    // Reset input so same file can be selected again
    e.target.value = "";
  };

  const removeFile = (index: number) => {
    setFiles((prev) => {
      const f = prev[index];
      if (f.preview) URL.revokeObjectURL(f.preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const dropped = e.dataTransfer.files;
    if (!dropped) return;
    const newFiles: SelectedFile[] = [];
    for (let i = 0; i < dropped.length; i++) {
      const f = dropped[i];
      newFiles.push({
        file: f,
        preview: f.type.startsWith("image/") ? URL.createObjectURL(f) : null,
      });
    }
    setFiles((prev) => [...prev, ...newFiles]);
  }, []);

  return (
    <div
      className="border-t border-custom-border-200 p-3"
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      {/* File previews */}
      {files.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {files.map((f, i) => (
            <div
              key={i}
              className="relative flex items-center gap-2 rounded-md bg-custom-background-90 px-2 py-1.5 text-xs"
            >
              {f.preview ? (
                <img
                  src={f.preview}
                  alt={f.file.name}
                  className="h-10 w-10 rounded object-cover"
                />
              ) : (
                <span>📄</span>
              )}
              <div className="max-w-[120px]">
                <div className="truncate text-custom-text-200">{f.file.name}</div>
                <div className="text-custom-text-400">
                  {Math.round(f.file.size / 1024)} KB
                </div>
              </div>
              <button
                onClick={() => removeFile(i)}
                className="ml-1 rounded-full bg-custom-background-80 px-1.5 py-0.5 text-xs text-custom-text-300 hover:bg-red-500/20 hover:text-red-500"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2">
        {/* File upload button */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          className="flex-shrink-0 rounded-lg border border-custom-border-200 p-2 text-custom-text-300 hover:bg-custom-background-90 hover:text-custom-text-100 disabled:opacity-50 transition-colors"
          title="Joindre un fichier"
        >
          📎
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileSelect}
          className="hidden"
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
        />

        <textarea
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className="flex-1 resize-none rounded-lg border border-custom-border-200 bg-custom-background-100 px-3 py-2 text-sm text-custom-text-100 placeholder:text-custom-text-400 focus:border-[#BF5D48] focus:outline-none focus:ring-1 focus:ring-[#BF5D48]"
          style={{ minHeight: 38, maxHeight: 120 }}
          onInput={(e) => {
            const target = e.target as HTMLTextAreaElement;
            target.style.height = "38px";
            target.style.height = Math.min(target.scrollHeight, 120) + "px";
          }}
        />
        <button
          onClick={handleSend}
          disabled={(!value.trim() && files.length === 0) || disabled}
          className="flex-shrink-0 rounded-lg bg-[#BF5D48] px-4 py-2 text-sm font-medium text-white hover:bg-[#a84d3b] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Envoyer
        </button>
      </div>
      <div className="mt-1 text-xs text-custom-text-400">
        📎 Glissez-déposez ou cliquez pour joindre &middot; <code className="bg-custom-background-90 px-1 rounded">@planer ocr</code> pour extraire le texte d'une image
      </div>
    </div>
  );
}
