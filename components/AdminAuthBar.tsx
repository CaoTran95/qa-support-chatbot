"use client";

import { useCallback, useEffect, useState } from "react";

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
      }
    };
    const onNeeded = () => setNeeded(true);
    window.addEventListener("message", onMsg);
    window.addEventListener(AUTH_REQUIRED_EVENT, onNeeded);
    return () => {
      clearTimeout(first);
      window.removeEventListener("message", onMsg);
      window.removeEventListener(AUTH_REQUIRED_EVENT, onNeeded);
    };
  }, [refresh]);

  const connect = () => window.open("/admin-login", "bidu-admin-login", "popup,width=460,height=640");
  const disconnect = async () => {
    await fetch("/api/admin-auth/logout", { method: "POST" });
    refresh();
  };

  const connected = !!status?.connected;
  return (
    <div className="admin-bar" data-needed={needed && !connected}>
      <span>
        Admin: {connected ? "Connected" : "Not connected"}
        {connected && status?.email ? ` (${status.email})` : ""}
        {connected ? ` · Ecommerce ${status?.ecommerce ? "✓" : "✗"} · Community ${status?.community ? "✓" : "✗"}` : ""}
      </span>
      {connected ? (
        <button className="btn btn-small" onClick={disconnect}>Disconnect</button>
      ) : (
        <button className="btn btn-small" onClick={connect}>Connect Admin</button>
      )}
    </div>
  );
}
