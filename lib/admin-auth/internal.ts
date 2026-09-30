import { createHmac, timingSafeEqual } from "node:crypto";
import { internalSecret } from "./session";

const MAX_SKEW_MS = 60_000;

export function signInternal(ts: string, qaSessionId: string, domain: string): string {
  return createHmac("sha256", internalSecret()).update(`${ts}.${qaSessionId}.${domain}`).digest("hex");
}

/** Verifies the short-lived HMAC that the MCP attaches to an internal call. */
export function verifyInternal(req: Request, qaSessionId: string, domain: string): boolean {
  const ts = req.headers.get("x-qa-timestamp") ?? "";
  const sig = req.headers.get("x-qa-signature") ?? "";
  const t = Number(ts);
  if (!Number.isFinite(t) || Math.abs(Date.now() - t) > MAX_SKEW_MS) return false;
  const expected = Buffer.from(signInternal(ts, qaSessionId, domain));
  const got = Buffer.from(sig);
  return got.length === expected.length && timingSafeEqual(got, expected);
}
