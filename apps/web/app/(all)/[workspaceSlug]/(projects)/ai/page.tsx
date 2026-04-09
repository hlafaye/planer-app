// Planer custom: AI page (Open WebUI iframe)
"use client";

export default function AIPage() {
  return (
    <div className="h-full w-full flex flex-col">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-custom-border-200">
        <span className="text-lg">🤖</span>
        <div>
          <h4 className="font-semibold text-sm text-custom-text-100">
            Assistant IA — EMPREINTES
          </h4>
          <p className="text-xs text-custom-text-400">
            llama3.1 (chat) &middot; llava (OCR/vision)
          </p>
        </div>
      </div>
      <iframe
        src="https://ai.parsight.fr"
        className="flex-1 w-full border-none"
        allow="microphone; camera; clipboard-write"
        title="EMPREINTES IA"
      />
    </div>
  );
}
