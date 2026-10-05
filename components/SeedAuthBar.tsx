"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AUTH_CHANGED_EVENT } from "@/lib/admin-auth/events";
import type { SeedRole } from "@/lib/admin-auth/domains";

type RoleStatus = { connected: boolean; email: string | null };
type Status = { seed?: Partial<Record<SeedRole, RoleStatus>> };

export const SEED_AUTH_REQUIRED_EVENT = "qa:seed-auth-required";

const ROLES: SeedRole[] = ["buyer", "seller"];
const LABEL: Record<SeedRole, string> = { buyer: "Người mua", seller: "Seller" };

export function SeedAuthBar() {
  const [status, setStatus] = useState<Status | null>(null);
  const [needed, setNeeded] = useState<SeedRole[]>([]);

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
      if (e.origin === window.location.origin && e.data?.type === "SEED_AUTH_SUCCESS") {
        setNeeded((n) => n.filter((r) => r !== e.data.role));
        refresh();
      }
    };
    const onNeeded = (e: Event) => {
      const roles = (e as CustomEvent<{ roles?: SeedRole[] }>).detail?.roles ?? [];
      setNeeded((n) => [...new Set([...n, ...roles])]);
    };
    window.addEventListener("message", onMsg);
    window.addEventListener(SEED_AUTH_REQUIRED_EVENT, onNeeded);
    window.addEventListener(AUTH_CHANGED_EVENT, refresh);
    return () => {
      clearTimeout(first);
      window.removeEventListener("message", onMsg);
      window.removeEventListener(SEED_AUTH_REQUIRED_EVENT, onNeeded);
      window.removeEventListener(AUTH_CHANGED_EVENT, refresh);
    };
  }, [refresh]);

  const connect = (role: SeedRole) =>
    window.open(`/seed-login/${role}`, `bidu-seed-login-${role}`, "popup,width=460,height=520");

  // The logout route clears the whole session record, Admin included, so the button says so.
  const logoutAll = async () => {
    await fetch("/api/admin-auth/logout", { method: "POST" });
    await refresh();
    window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
  };

  const connected = (r: SeedRole) => !!status?.seed?.[r]?.connected;
  if (needed.length === 0 && !ROLES.some(connected)) return null;

  return (
    <div className="flex flex-col gap-1.5 text-sm">
      {ROLES.map((role) => (
        <span
          key={role}
          className={cn(
            "flex items-center justify-between gap-2",
            needed.includes(role) && !connected(role) && "rounded-md outline outline-2 outline-amber-500 px-1.5 py-0.5",
          )}
        >
          <span className="min-w-0 truncate">
            {LABEL[role]}: {connected(role) ? `Connected${status?.seed?.[role]?.email ? ` (${status.seed[role]?.email})` : ""}` : "Not connected"}
          </span>
          <Button size="sm" variant={connected(role) ? "outline" : "default"} onClick={() => connect(role)}>
            {connected(role) ? "Đổi" : "Đăng nhập"}
          </Button>
        </span>
      ))}
      {ROLES.some(connected) && (
        <Button size="sm" variant="outline" onClick={logoutAll}>
          Đăng xuất tất cả
        </Button>
      )}
    </div>
  );
}
