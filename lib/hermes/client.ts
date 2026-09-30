import * as local from "./local";
import { HermesError, type HealthStatus } from "./local";

export { HermesError, type HealthStatus };

// If HERMES_BRIDGE_URL is set (e.g. web on Render, Hermes on a local machine
// exposed through ngrok), talk to the bridge over HTTP. Otherwise spawn the
// Hermes CLI directly.
const BRIDGE_URL = process.env.HERMES_BRIDGE_URL?.replace(/\/+$/, "");
const BRIDGE_TOKEN = process.env.HERMES_BRIDGE_TOKEN;
const BRIDGE_TIMEOUT_MS = Number(process.env.HERMES_TIMEOUT_MS) || 180_000;

type Code = HermesError["code"];

async function bridgeFetch(path: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  try {
    return await fetch(`${BRIDGE_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        // Skips ngrok's free-tier browser interstitial for API calls.
        "ngrok-skip-browser-warning": "1",
        ...(BRIDGE_TOKEN ? { Authorization: `Bearer ${BRIDGE_TOKEN}` } : {}),
      },
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    const timedOut = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
    throw new HermesError(
      timedOut ? "Hermes bridge timed out" : "Hermes bridge unreachable",
      timedOut ? "timeout" : "not_found",
    );
  }
}

export async function chat(message: string, sessionId?: string, qaSessionId?: string) {
  if (!BRIDGE_URL) return local.chat(message, sessionId, qaSessionId);
  const res = await bridgeFetch(
    "/chat",
    { method: "POST", body: JSON.stringify({ message, sessionId, qaSessionId }) },
    BRIDGE_TIMEOUT_MS + 10_000,
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const code: Code = ["not_found", "timeout", "failed", "bad_session"].includes(data.code)
      ? data.code
      : res.status === 401 || res.status === 403
        ? "not_found"
        : "failed";
    throw new HermesError(
      res.status === 401 || res.status === 403 ? "Hermes bridge rejected credentials" : (data.error ?? `Bridge error (${res.status})`),
      code,
    );
  }
  return data as { reply: string; sessionId: string | null };
}

export async function checkHealth(): Promise<HealthStatus> {
  if (!BRIDGE_URL) return local.checkHealth();
  const base: HealthStatus = { ok: false, cli: false, profile: false, profileName: local.HERMES_PROFILE };
  try {
    const res = await bridgeFetch("/health", { method: "GET" }, 15_000);
    if (res.status === 401 || res.status === 403) return { ...base, error: "Hermes bridge rejected credentials" };
    const data = await res.json();
    return { ...base, ...data };
  } catch (e) {
    return { ...base, error: e instanceof Error ? e.message : "Unknown error" };
  }
}
