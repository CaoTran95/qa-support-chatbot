import { communityPasswordLogin, LoginError } from "@/lib/admin-auth/backends";
import { mergeAdminLogin } from "@/lib/admin-auth/merge";
import { rateLimited } from "@/lib/admin-auth/rate-limit";
import { ensureCookieSid, qaSessionIdFor } from "@/lib/admin-auth/session";
import { loadAuthSession, saveAuthSession } from "@/lib/admin-auth/session-persist";
import { publicStatus } from "@/lib/admin-auth/status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { email?: unknown; password?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || !password || email.length > 254 || password.length > 256) {
    return Response.json({ success: false, error: "Email và mật khẩu là bắt buộc" }, { status: 400 });
  }

  const qaSessionId = qaSessionIdFor(await ensureCookieSid());
  if (rateLimited(qaSessionId)) {
    return Response.json({ success: false, error: "Thử lại sau ít phút" }, { status: 429 });
  }

  try {
    const token = await communityPasswordLogin(email, password);
    const prev = await loadAuthSession(qaSessionId);
    await saveAuthSession(
      qaSessionId,
      mergeAdminLogin(prev, { email, domain: "community", token, createdAt: prev?.createdAt ?? Date.now() }),
    );
    return Response.json({ success: true, ...(await publicStatus(qaSessionId)) });
  } catch (e) {
    if (e instanceof LoginError) {
      const status = e.kind === "invalid_credentials" ? 401 : 502;
      return Response.json({ success: false, error: e.message, kind: e.kind }, { status });
    }
    console.error("admin community login failed:", e instanceof Error ? e.message : "unknown");
    return Response.json({ success: false, error: "Server không thể đăng nhập Admin", kind: "unavailable" }, { status: 500 });
  }
}
