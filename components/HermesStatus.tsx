"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type State = "checking" | "connected" | "error";

export function HermesStatus({ profile }: { profile: string }) {
  const [state, setState] = useState<State>("checking");
  const [detail, setDetail] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/hermes/health?profile=${encodeURIComponent(profile)}`, { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json();
        if (cancelled) return;
        setState(data.ok ? "connected" : "error");
        setDetail(data.ok ? `profile: ${data.profileName}` : data.error ?? "Unavailable");
      })
      .catch(() => {
        if (cancelled) return;
        setState("error");
        setDetail("Health check failed");
      });
    return () => {
      cancelled = true;
    };
  }, [profile]);

  const label = state === "checking" ? "Checking…" : state === "connected" ? "Connected" : "Unavailable";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-sm",
        state === "connected" && "text-emerald-600 dark:text-emerald-400",
        state === "error" && "text-destructive",
        state === "checking" && "text-muted-foreground",
      )}
      title={detail}
    >
      <span
        className={cn(
          "size-2 rounded-full",
          state === "connected" && "bg-emerald-600 dark:bg-emerald-400",
          state === "error" && "bg-destructive",
          state === "checking" && "bg-muted-foreground",
        )}
      />
      Hermes: {label}
    </span>
  );
}
