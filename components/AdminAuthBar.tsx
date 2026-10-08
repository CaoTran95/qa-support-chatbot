"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AUTH_CHANGED_EVENT } from "@/lib/admin-auth/events";

type Status = { connected: boolean; ecommerce: boolean; community: boolean; email: string | null };

export const AUTH_REQUIRED_EVENT = "qa:admin-auth-required";

export function AdminAuthBar() {
  const [status, setStatus] = useState<Status | null>(null);
  const [needed, setNeeded] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/admin-auth/status", { cache: "no-store" });
      setStatus(res.ok ? await res.json() : null);
    } catch {
      setStatus(null);
    }
  }, []);

  useEffect(() => {
    const first = setTimeout(refresh, 0);
    const onMsg = (e: MessageEvent) => {
      if (e.origin === window.location.origin && e.data?.type === "ADMIN_AUTH_SUCCESS") {
        setNeeded(false);
        refresh();
        // Sync other UI (Ops Agent card) — same as Disconnect path.
        window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
      }
    };
    const onNeeded = () => setNeeded(true);
    window.addEventListener("message", onMsg);
    window.addEventListener(AUTH_REQUIRED_EVENT, onNeeded);
    window.addEventListener(AUTH_CHANGED_EVENT, refresh);
    return () => {
      clearTimeout(first);
      window.removeEventListener("message", onMsg);
      window.removeEventListener(AUTH_REQUIRED_EVENT, onNeeded);
      window.removeEventListener(AUTH_CHANGED_EVENT, refresh);
    };
  }, [refresh]);

  const connect = () => window.open("/admin-login", "bidu-admin-login", "popup,width=460,height=640");
  const disconnect = async () => {
    await fetch("/api/admin-auth/logout", { method: "POST" });
    refresh();
    window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
  };

  const connected = !!status?.connected;
  return (
    <div
      className={cn(
        "flex items-center gap-2 text-sm",
        needed && !connected && "rounded-md outline outline-2 outline-amber-500 px-1.5 py-0.5",
      )}
    >
      <span>
        Admin: {connected ? "Connected" : "Not connected"}
        {connected && status?.email ? ` (${status.email})` : ""}
        {connected
          ? status?.community
            ? " · Community ✓"
            : ""
          : ""}
      </span>
      {connected ? (
        <Button size="sm" variant="outline" onClick={disconnect}>
          Disconnect
        </Button>
      ) : (
        <Button size="sm" onClick={connect}>
          Connect Admin
        </Button>
      )}
    </div>
  );
}
