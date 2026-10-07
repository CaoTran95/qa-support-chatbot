import { assertStagingBase } from "@/lib/admin-auth/guardrail";
import { ensureCookieSid, hasInternalSecret, qaSessionIdFor, readCookieSid } from "@/lib/admin-auth/session";
import { loadAuthSession } from "@/lib/admin-auth/session-persist";
import { liveToken } from "@/lib/admin-auth/status";

const TIMEOUT_MS = 20_000;

export function ecommerceBaseUrl(): string {
  return assertStagingBase("ECOMMERCE_BASE_URL", process.env.ECOMMERCE_BASE_URL);
}

export type AdminAuthOk = { ok: true; accessToken: string; qaSessionId: string };
export type AdminAuthErr = { ok: false; response: Response };

/** Admin JWT from Connect Admin (Community token also covers ecommerce tools). */
export async function requireEcommerceAdminToken(): Promise<AdminAuthOk | AdminAuthErr> {
  if (!hasInternalSecret()) {
    return {
      ok: false,
      response: Response.json({ success: false, error: "Admin auth not configured", kind: "unavailable" }, { status: 503 }),
    };
  }
  const sid = (await readCookieSid()) ?? (await ensureCookieSid());
  const qaSessionId = qaSessionIdFor(sid);
  const token = liveToken(await loadAuthSession(qaSessionId), "ecommerce");
  if (!token?.accessToken) {
    return {
      ok: false,
      response: Response.json({ success: false, error: "Connect Admin trước", kind: "auth_required" }, { status: 401 }),
    };
  }
  return { ok: true, accessToken: token.accessToken, qaSessionId };
}

export async function callOpsAgentAdmin(
  path: string,
  accessToken: string,
  body?: Record<string, unknown>,
): Promise<{ status: number; json: Record<string, unknown> }> {
  const base = ecommerceBaseUrl();
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  try {
    const res = await fetch(url, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "Accept-Language": "vi",
        Authorization: `Bearer ${accessToken}`,
        from: "qa-support-web-ops-agent",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { status: res.status, json };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Backend unreachable";
    return {
      status: 502,
      json: { success: false, error: message, kind: "unavailable" },
    };
  }
}

const TOKEN_RE = /^[0-9a-f]{64}$/i;

export function parsePreviewToken(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  return TOKEN_RE.test(t) ? t.toLowerCase() : null;
}
