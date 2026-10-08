"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { AUTH_REQUIRED_EVENT } from "@/components/AdminAuthBar";
import { AUTH_CHANGED_EVENT } from "@/lib/admin-auth/events";
import { cn } from "@/lib/utils";

type Check = { label?: string; ok?: boolean };
type Change = { field?: string; from?: string; to?: string };
type Confirmation = { key?: string; label?: string };

type CardData = {
  status?: string;
  summary?: string;
  action_type?: string;
  expires_at?: string | null;
  checks?: Check[];
  changes?: Change[];
  confirmations?: Confirmation[];
  result_message?: string | null;
  result_code?: string | null;
};

function errMessage(data: Record<string, unknown>, fallback: string): string {
  if (typeof data.error === "string" && data.error) return data.error;
  if (typeof data.message === "string" && data.message) return data.message;
  return fallback;
}

/** Confirm card embedded under a bot message that includes a preview token. */
export function OpsAgentInlineCard({ token }: { token: string }) {
  const [card, setCard] = useState<CardData | null>(null);
  const [ticked, setTicked] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<"lookup" | "confirm" | "cancel" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loadedFor = useRef<string | null>(null);

  const post = useCallback(async (path: string, body: Record<string, unknown>) => {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { ok: res.ok, status: res.status, data };
  }, []);

  const lookup = useCallback(async () => {
    setBusy("lookup");
    setError(null);
    try {
      const { ok, status, data } = await post("/api/ops-agent/lookup", { preview_token: token });
      if (status === 401 || data.kind === "auth_required") {
        // Chưa (hoặc mất) cookie Admin — cho phép lookup lại sau khi Connect.
        loadedFor.current = null;
        window.dispatchEvent(new Event(AUTH_REQUIRED_EVENT));
        setError("Connect Admin (cột trái) — thẻ sẽ tự tải lại sau khi đăng nhập.");
        return;
      }
      if (!ok || data.success === false) {
        loadedFor.current = null;
        setError(errMessage(data, "Không mở được thẻ"));
        return;
      }
      loadedFor.current = token;
      const payload = (data.data ?? data) as CardData;
      setCard(payload);
      const next: Record<string, boolean> = {};
      for (const c of payload.confirmations ?? []) {
        if (c.key) next[c.key] = false;
      }
      setTicked(next);
    } catch {
      loadedFor.current = null;
      setError("Lỗi mạng. Thử lại.");
    } finally {
      setBusy(null);
    }
  }, [post, token]);

  useEffect(() => {
    if (loadedFor.current === token) return;
    void lookup();
  }, [token, lookup]);

  // Sau Connect Admin / Disconnect: tự lookup lại (tránh kẹt lỗi "chưa kết nối").
  useEffect(() => {
    const retry = () => {
      if (card?.status === "pending" || card?.status === "succeeded") return;
      loadedFor.current = null;
      void lookup();
    };
    const onMsg = (e: MessageEvent) => {
      if (e.origin === window.location.origin && e.data?.type === "ADMIN_AUTH_SUCCESS") retry();
    };
    window.addEventListener(AUTH_CHANGED_EVENT, retry);
    window.addEventListener("message", onMsg);
    return () => {
      window.removeEventListener(AUTH_CHANGED_EVENT, retry);
      window.removeEventListener("message", onMsg);
    };
  }, [lookup, card?.status]);

  const confirm = async () => {
    if (!card) return;
    const keys = (card.confirmations ?? []).map((c) => c.key).filter((k): k is string => !!k);
    if (keys.some((k) => !ticked[k])) {
      setError("Tick đủ các ô xác nhận trước khi bấm Xác nhận.");
      return;
    }
    setBusy("confirm");
    setError(null);
    try {
      const { ok, status, data } = await post("/api/ops-agent/confirm", {
        preview_token: token,
        confirmations: keys,
      });
      if (status === 401 || data.kind === "auth_required") {
        window.dispatchEvent(new Event(AUTH_REQUIRED_EVENT));
        setError("Connect Admin trước khi xác nhận.");
        return;
      }
      if (!ok || data.success === false) {
        setError(errMessage(data, "Xác nhận thất bại"));
        const payload = data.data as CardData | undefined;
        if (payload?.status) setCard((prev) => ({ ...prev, ...payload }));
        return;
      }
      const next = (data.data ?? data) as CardData;
      setCard(next);
      // BE có thể HTTP 200 nhưng status failed (vd. action_type_unavailable trên staging).
      if (next.status === "failed" || next.status === "rejected_on_recheck") {
        setError(
          [next.result_code ? `[${next.result_code}]` : null, next.result_message].filter(Boolean).join(" ") ||
            "Xác nhận thất bại",
        );
      }
    } catch {
      setError("Lỗi mạng. Thử lại.");
    } finally {
      setBusy(null);
    }
  };

  const cancel = async () => {
    setBusy("cancel");
    setError(null);
    try {
      const { ok, status, data } = await post("/api/ops-agent/cancel", { preview_token: token });
      if (status === 401 || data.kind === "auth_required") {
        window.dispatchEvent(new Event(AUTH_REQUIRED_EVENT));
        setError("Connect Admin trước khi huỷ.");
        return;
      }
      if (!ok || data.success === false) {
        setError(errMessage(data, "Huỷ thất bại"));
        return;
      }
      setCard((data.data ?? data) as CardData);
    } catch {
      setError("Lỗi mạng. Thử lại.");
    } finally {
      setBusy(null);
    }
  };

  const pending = card?.status === "pending";
  const requiredKeys = (card?.confirmations ?? []).map((c) => c.key).filter((k): k is string => !!k);
  const missingTicks = requiredKeys.filter((k) => !ticked[k]);
  const canConfirm = pending && missingTicks.length === 0;

  return (
    <div
      data-slot="ops-agent-inline-card"
      className="border-border bg-card mt-3 overflow-hidden rounded-xl border shadow-sm"
    >
      <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/40 px-3 py-2">
        <span className="text-sm font-semibold tracking-tight">Thẻ Ops Agent</span>
        {card?.status ? (
          <span
            className={cn(
              "rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
              pending ? "bg-amber-500/15 text-amber-800 dark:text-amber-300" : "bg-muted text-muted-foreground",
            )}
          >
            {card.status}
          </span>
        ) : busy === "lookup" ? (
          <span className="text-muted-foreground text-xs">Đang tải…</span>
        ) : null}
      </div>

      <div className="space-y-3 p-3">
        {error ? (
          <div className="space-y-2">
            <p className="text-destructive text-sm leading-snug">{error}</p>
            <Button size="sm" variant="outline" onClick={() => void lookup()} disabled={busy !== null}>
              Thử lại
            </Button>
          </div>
        ) : null}

        {card ? (
          <>
            {card.summary ? <p className="text-sm leading-snug font-medium">{card.summary}</p> : null}
            {card.action_type ? (
              <p className="text-muted-foreground text-xs">
                {card.action_type}
                {card.expires_at ? ` · hết hạn ${new Date(card.expires_at).toLocaleString("vi-VN")}` : ""}
              </p>
            ) : null}

            {(card.checks?.length ?? 0) > 0 ? (
              <ul className="space-y-1.5 text-sm">
                {card.checks!.map((c, i) => (
                  <li key={i} className="flex gap-2 leading-snug">
                    <span className={c.ok ? "text-emerald-600" : "text-destructive"}>{c.ok ? "✓" : "✗"}</span>
                    <span>{c.label}</span>
                  </li>
                ))}
              </ul>
            ) : null}

            {(card.changes?.length ?? 0) > 0 ? (
              <ul className="text-muted-foreground space-y-1 text-xs">
                {card.changes!.map((c, i) => (
                  <li key={i}>
                    <span className="text-foreground">{c.field}</span>: {c.from} → {c.to}
                  </li>
                ))}
              </ul>
            ) : null}

            {pending && (card.confirmations?.length ?? 0) > 0 ? (
              <div className="space-y-2 border-t border-border pt-3">
                {card.confirmations!.map((c) =>
                  c.key ? (
                    <label
                      key={c.key}
                      className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border bg-background px-3 py-2.5 text-sm leading-snug"
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5 size-4 accent-primary"
                        checked={!!ticked[c.key]}
                        onChange={(e) => setTicked((prev) => ({ ...prev, [c.key!]: e.target.checked }))}
                      />
                      <span>{c.label ?? c.key}</span>
                    </label>
                  ) : null,
                )}
              </div>
            ) : null}

            {card.result_message ? (
              <p className="text-sm leading-snug">
                {card.result_code ? <span className="text-muted-foreground">[{card.result_code}] </span> : null}
                {card.result_message}
              </p>
            ) : null}
          </>
        ) : !error && busy === "lookup" ? (
          <p className="text-muted-foreground text-sm">Đang tải thẻ xem trước…</p>
        ) : null}
      </div>

      {pending ? (
        <div className="space-y-2 border-t border-border bg-muted/30 p-3">
          {missingTicks.length > 0 ? (
            <p className="text-muted-foreground text-xs">Tick đủ ô xác nhận phía trên rồi mới bấm Xác nhận.</p>
          ) : null}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" className="min-h-10 sm:min-w-24" onClick={() => void cancel()} disabled={busy !== null}>
              {busy === "cancel" ? "Đang huỷ…" : "Huỷ"}
            </Button>
            <Button
              className="min-h-10 font-semibold sm:min-w-36"
              onClick={() => void confirm()}
              disabled={busy !== null || !canConfirm}
            >
              {busy === "confirm" ? "Đang xác nhận…" : "Xác nhận"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
