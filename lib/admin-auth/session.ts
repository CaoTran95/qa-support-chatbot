import { createHmac, randomBytes } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE = "qa_sid";
const COOKIE_MAX_AGE_S = 12 * 60 * 60;
const SID_RE = /^[0-9a-f]{64}$/;

export function internalSecret(): string {
  const s = process.env.QA_INTERNAL_SECRET;
  if (!s || s.length < 32) throw new Error("QA_INTERNAL_SECRET (min 32 chars) is not configured");
  return s;
}

/**
 * The id that Hermes/MCP know. It is derived from the browser cookie value with
 * HMAC, so a leaked qaSessionId cannot be replayed as a cookie.
 */
export function qaSessionIdFor(cookieSid: string): string {
  return createHmac("sha256", internalSecret()).update(`qa-session:${cookieSid}`).digest("hex");
}

export async function readCookieSid(): Promise<string | undefined> {
  const v = (await cookies()).get(COOKIE)?.value;
  return v && SID_RE.test(v) ? v : undefined;
}

/** Returns the existing browser session id or creates (and sets) a new one. */
export async function ensureCookieSid(): Promise<string> {
  const existing = await readCookieSid();
  if (existing) return existing;
  const sid = randomBytes(32).toString("hex");
  (await cookies()).set(COOKIE, sid, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE_S,
  });
  return sid;
}

export async function clearCookieSid(): Promise<void> {
  (await cookies()).delete(COOKIE);
}
