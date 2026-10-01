"use client";

import { useEffect, useState } from "react";
import { useAuiState } from "@assistant-ui/react";

function formatElapsed(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  if (totalSec < 60) return `${totalSec}s`;
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}p ${String(s).padStart(2, "0")}s`;
}

/** Shown while Hermes is generating (no token stream — can take many seconds). */
export function ThinkingIndicator({ label }: { label: string }) {
  const createdAt = useAuiState((s) => s.message.createdAt);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);

  const started = createdAt instanceof Date ? createdAt.getTime() : Date.now();
  const elapsed = formatElapsed(now - started);

  return (
    <div
      data-slot="aui_assistant-thinking"
      className="text-muted-foreground flex items-center gap-2 py-1 text-sm"
      role="status"
      aria-live="polite"
      aria-label={`${label} ${elapsed}`}
    >
      <span className="inline-flex gap-1" aria-hidden>
        <span
          className="bg-muted-foreground/70 size-1.5 animate-bounce rounded-full"
          style={{ animationDelay: "0ms" }}
        />
        <span
          className="bg-muted-foreground/70 size-1.5 animate-bounce rounded-full"
          style={{ animationDelay: "150ms" }}
        />
        <span
          className="bg-muted-foreground/70 size-1.5 animate-bounce rounded-full"
          style={{ animationDelay: "300ms" }}
        />
      </span>
      <span>
        {label}
        <span className="text-muted-foreground/70"> · suy nghĩ {elapsed}</span>
      </span>
    </div>
  );
}
