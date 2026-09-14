"use client";

import { MessageCircle, X } from "lucide-react";
import { useState } from "react";

export default function AssistButton() {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {open && (
        <div className="mb-3 w-64 rounded-md border border-border bg-panel p-4 shadow-lg">
          <p className="text-xs text-secondary">
            The SentinelOS assistant isn&apos;t wired up in this build yet — findings, patches, and
            risk data are all real, this chat panel is just a placeholder surface.
          </p>
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex h-12 w-12 items-center justify-center rounded-full bg-mint text-app shadow-lg transition hover:bg-mint/90"
        aria-label="Assistant"
      >
        {open ? <X size={20} strokeWidth={2.5} /> : <MessageCircle size={20} strokeWidth={2.25} />}
      </button>
    </div>
  );
}
