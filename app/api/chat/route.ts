import { qaSessionIdFor, ensureCookieSid, hasInternalSecret } from "@/lib/admin-auth/session";
import { loadAuthSession } from "@/lib/admin-auth/session-persist";
import { chat, HermesError, resolveProfile } from "@/lib/hermes/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_MESSAGE_CHARS = 20_000;

export async function POST(req: Request) {
  let body: { message?: unknown; sessionId?: unknown; profile?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) return Response.json({ error: "`message` is required" }, { status: 400 });
  if (message.length > MAX_MESSAGE_CHARS) {
    return Response.json({ error: "Message too long" }, { status: 413 });
  }
  const sessionId = typeof body.sessionId === "string" && body.sessionId ? body.sessionId : undefined;
  const profile = resolveProfile(body.profile);
  if (!profile) return Response.json({ error: "Unknown profile" }, { status: 400 });

  try {
    // Without QA_INTERNAL_SECRET there is no admin session to bind: chat still works, admin lookups answer AUTH_REQUIRED.
    const qaSessionId = hasInternalSecret() ? qaSessionIdFor(await ensureCookieSid()) : undefined;
    // Sync encrypted browser cookies → server cache so MCP can fetch tokens mid-turn.
    if (qaSessionId) await loadAuthSession(qaSessionId);
    const result = await chat(message, sessionId, qaSessionId, profile);
    return Response.json(result);
  } catch (e) {
    if (e instanceof HermesError) {
      const status = { not_found: 503, timeout: 504, bad_session: 409, failed: 502 }[e.code];
      return Response.json({ error: e.message, code: e.code }, { status });
    }
    return Response.json({ error: "Unexpected server error" }, { status: 500 });
  }
}
