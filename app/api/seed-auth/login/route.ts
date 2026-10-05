import { ecommerceLogin, LoginError } from "@/lib/admin-auth/backends";
import { isSeedRole } from "@/lib/admin-auth/domains";
import { mergeSeedLogin } from "@/lib/admin-auth/merge";
import { rateLimited } from "@/lib/admin-auth/rate-limit";
import { ensureCookieSid, qaSessionIdFor } from "@/lib/admin-auth/session";
import { publicStatus } from "@/lib/admin-auth/status";
import { adminTokenStore } from "@/lib/admin-auth/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Buyer/seller test accounts for the seed tool. Same dev login as the Admin one; the password is used once
// and never stored, logged or returned. Only the token and the email (display) are kept server-side.
export async function POST(req: Request) {
  let body: { role?: unknown; email?: unknown; password?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }
  if (!isSeedRole(body.role)) {
    return Response.json({ success: false, error: "Vai trò không hợp lệ" }, { status: 400 });
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
    const token = await ecommerceLogin(email, password);
    const prev = await adminTokenStore.get(qaSessionId);
    await adminTokenStore.set(qaSessionId, mergeSeedLogin(prev, { role: body.role, email, token, now: Date.now() }));
    return Response.json({ success: true, ...(await publicStatus(qaSessionId)) });
  } catch (e) {
    if (e instanceof LoginError) {
      const status = e.kind === "invalid_credentials" ? 401 : 502;
      return Response.json({ success: false, error: e.message, kind: e.kind }, { status });
    }
    console.error("seed login failed:", e instanceof Error ? e.message : "unknown");
    return Response.json({ success: false, error: "Server không thể đăng nhập", kind: "unavailable" }, { status: 500 });
  }
}
