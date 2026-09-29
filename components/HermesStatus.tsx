"use client";

import { useEffect, useState } from "react";

type State = "checking" | "connected" | "error";

export function HermesStatus() {
  const [state, setState] = useState<State>("checking");
  const [detail, setDetail] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/hermes/health", { cache: "no-store" })
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
  }, []);

  const label = state === "checking" ? "Checking…" : state === "connected" ? "Connected" : "Unavailable";
  return (
    <span className={`status status-${state}`} title={detail}>
      <span className="dot" /> Hermes: {label}
    </span>
  );
}
