"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AUTH_REQUIRED_EVENT } from "@/components/AdminAuthBar";
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

export function OpsAgentConfirmCard() {
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState("");
  const [card, setCard] = useState<CardData | null>(null);
  const [ticked, setTicked] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<"lookup" | "confirm" | "cancel" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resetCard = () => {
    setCard(null);
    setTicked({});
  };

  const post = useCallback(async (path: string, body: Record<string, unknown>) => {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { ok: res.ok, status: res.status, data };
  }, []);

  const lookup = async () => {
    setBusy("lookup");
    setError(null);
    resetCard();
    try {
      const { ok, status, data } = await post("/api/ops-agent/lookup", { preview_token: token.trim() });
      if (status === 401 || data.kind === "auth_required") {
        window.dispatchEvent(new Event(AUTH_REQUIRED_EVENT));
        setError("Connect Admin trước khi mở thẻ.");
        return;
      }
      if (!ok || data.success === false) {
        setError(errMessage(data, "Không mở được thẻ"));
        return;
      }
      const payload = (data.data ?? data) as CardData;
      setCard(payload);
      const next: Record<string, boolean> = {};
      for (const c of payload.confirmations ?? []) {
        if (c.key) next[c.key] = false;
      }
      setTicked(next);
    } catch {
      setError("Lỗi mạng. Thử lại.");
    } finally {
      setBusy(null);
    }
  };

  const confirm = async () => {
    if (!card) return;
    const keys = (card.confirmations ?? []).map((c) => c.key).filter((k): k is string => !!k);
    const missing = keys.filter((k) => !ticked[k]);
    if (missing.length) {
      setError("Tick đủ các ô xác nhận trước khi bấm Xác nhận.");
      return;
    }
    setBusy("confirm");
    setError(null);
    try {
      const { ok, status, data } = await post("/api/ops-agent/confirm", {
        preview_token: token.trim(),
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
      setCard((data.data ?? data) as CardData);
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
      const { ok, status, data } = await post("/api/ops-agent/cancel", { preview_token: token.trim() });
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
  const canConfirm =
    pending && (card.confirmations ?? []).every((c) => !c.key || ticked[c.key]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm" variant="outline" className="w-full justify-center text-xs font-medium" />
        }
      >
        Mở thẻ thủ công
      </DialogTrigger>

      <DialogContent
        className="flex max-h-[min(90dvh,640px)] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg"
        showCloseButton
      >
        <DialogHeader className="shrink-0 space-y-1 border-b border-border px-4 py-3 pr-12">
          <DialogTitle>Thẻ xác nhận Ops Agent</DialogTitle>
          <DialogDescription>
            Dán mã xem trước từ chat, mở thẻ, rồi bấm Xác nhận hoặc Huỷ.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
          <div className="flex gap-2">
            <Input
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Mã xem trước (64 hex)"
              spellCheck={false}
              className="font-mono text-xs"
              onKeyDown={(e) => {
                if (e.key === "Enter" && token.trim() && !busy) void lookup();
              }}
            />
            <Button size="sm" onClick={lookup} disabled={!token.trim() || busy !== null} className="shrink-0">
              {busy === "lookup" ? "…" : "Mở thẻ"}
            </Button>
          </div>

          {error ? <p className="text-destructive text-sm leading-snug">{error}</p> : null}

          {card ? (
            <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-foreground text-sm leading-snug font-medium">{card.summary}</p>
                {card.status ? (
                  <span
                    className={cn(
                      "shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
                      pending
                        ? "bg-amber-500/15 text-amber-800 dark:text-amber-300"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {card.status}
                  </span>
                ) : null}
              </div>

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
                  <p className="text-xs font-medium">Xác nhận trước khi duyệt</p>
                  {card.confirmations!.map((c) =>
                    c.key ? (
                      <label
                        key={c.key}
                        className="flex cursor-pointer items-start gap-2.5 rounded-md border border-border bg-background px-2.5 py-2 text-sm leading-snug"
                      >
                        <input
                          type="checkbox"
                          className="mt-1 size-4 accent-primary"
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
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">Chưa có thẻ. Dán mã rồi bấm Mở thẻ.</p>
          )}
        </div>

        <DialogFooter className="shrink-0 sm:justify-between">
          {pending ? (
            <>
              <Button
                variant="outline"
                onClick={cancel}
                disabled={busy !== null}
                className="min-h-10 w-full sm:w-auto"
              >
                {busy === "cancel" ? "Đang huỷ…" : "Huỷ thẻ"}
              </Button>
              <Button
                onClick={confirm}
                disabled={busy !== null || !canConfirm}
                className="min-h-10 w-full font-semibold sm:min-w-40 sm:flex-1"
              >
                {busy === "confirm" ? "Đang xác nhận…" : "Xác nhận"}
              </Button>
            </>
          ) : card ? (
            <Button
              variant="secondary"
              onClick={() => {
                resetCard();
                setError(null);
              }}
              className="min-h-10 w-full"
            >
              Xóa thẻ / mở mã khác
            </Button>
          ) : (
            <p className="text-muted-foreground w-full text-center text-xs sm:text-left">
              Nút Xác nhận hiện sau khi mở thẻ còn hạn (pending).
            </p>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
