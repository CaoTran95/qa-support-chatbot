import * as local from "./local";
import { HermesError, resolveProfile, type HealthStatus } from "./local";

export { HermesError, resolveProfile, type HealthStatus };

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

const OUTDATED_BRIDGE = "Hermes bridge does not support bot selection; update the bridge";

export async function chat(
  message: string,
  sessionId?: string,
  qaSessionId?: string,
  profile: string = local.HERMES_PROFILE,
) {
  if (!BRIDGE_URL) return local.chat(message, sessionId, qaSessionId, profile);
  const res = await bridgeFetch(
    "/chat",
    { method: "POST", body: JSON.stringify({ message, sessionId, qaSessionId, profile }) },
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
  // An outdated bridge ignores `profile` and would answer as the default bot: never pass that off as the requested one.
  if (profile !== local.HERMES_PROFILE && data.profile !== profile) throw new HermesError(OUTDATED_BRIDGE, "failed");
  return data as { reply: string; sessionId: string | null; profile?: string };
}

export async function checkHealth(profile: string = local.HERMES_PROFILE): Promise<HealthStatus> {
  if (!BRIDGE_URL) return local.checkHealth(profile);
  const base: HealthStatus = { ok: false, cli: false, profile: false, profileName: profile };
  const isDefault = profile === local.HERMES_PROFILE;
  try {
    // The default bot keeps the old, query-less path so an outdated bridge still serves it.
    const path = isDefault ? "/health" : `/health?profile=${encodeURIComponent(profile)}`;
    const res = await bridgeFetch(path, { method: "GET" }, 15_000);
    if (res.status === 401 || res.status === 403) return { ...base, error: "Hermes bridge rejected credentials" };
    if (!isDefault && res.status === 404) return { ...base, error: OUTDATED_BRIDGE };
    const data = await res.json();
    if (!isDefault && data.profileName !== profile) return { ...base, error: OUTDATED_BRIDGE };
    return { ...base, ...data };
  } catch (e) {
    return { ...base, error: e instanceof Error ? e.message : "Unknown error" };
  }
}
