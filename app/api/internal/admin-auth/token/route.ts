import { verifyInternal } from "@/lib/admin-auth/internal";
import { parseTokenDomain } from "@/lib/admin-auth/domains";
import { liveToken } from "@/lib/admin-auth/status";
import { adminTokenStore } from "@/lib/admin-auth/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Trusted callers only (the Admin MCP). Requires an HMAC signed with QA_INTERNAL_SECRET,
// so a browser cannot call it. The raw token is returned to the MCP and is never logged.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { qaSessionId?: unknown; domain?: unknown };
  const qaSessionId = typeof body.qaSessionId === "string" ? body.qaSessionId : "";
  const domain = parseTokenDomain(body.domain);
  if (!/^[0-9a-f]{64}$/.test(qaSessionId) || !domain) return Response.json({ error: "Bad request" }, { status: 400 });

  let ok = false;
  try {
    ok = verifyInternal(req, qaSessionId, domain);
  } catch {
    return Response.json({ error: "Internal auth not configured" }, { status: 503 });
  }
  if (!ok) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const t = liveToken(await adminTokenStore.get(qaSessionId), domain);
  if (!t) return Response.json({ status: "AUTH_REQUIRED", domain }, { headers: { "Cache-Control": "no-store" } });
  return Response.json(
    { status: "OK", domain, accessToken: t.accessToken, expiresAt: t.expiresAt ?? null },
    { headers: { "Cache-Control": "no-store" } },
  );
}
