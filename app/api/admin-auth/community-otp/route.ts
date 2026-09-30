import { communityRequestOtp, LoginError } from "@/lib/admin-auth/backends";
import { setPending } from "@/lib/admin-auth/pending-otp";
import { rateLimited } from "@/lib/admin-auth/rate-limit";
import { ensureCookieSid, qaSessionIdFor } from "@/lib/admin-auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Step 1 of the Community Admin login: the backend sends an SMS OTP to the admin.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { email?: unknown; password?: unknown };
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || !password) return Response.json({ success: false, error: "Email và mật khẩu là bắt buộc" }, { status: 400 });

  const qaSessionId = qaSessionIdFor(await ensureCookieSid());
  if (rateLimited(qaSessionId, 5)) return Response.json({ success: false, error: "Thử lại sau ít phút" }, { status: 429 });

  try {
    setPending(qaSessionId, email, await communityRequestOtp(email, password));
    return Response.json({ success: true, otpSent: true });
  } catch (e) {
    if (e instanceof LoginError) {
      return Response.json(
        { success: false, error: e.message, kind: e.kind },
        { status: e.kind === "invalid_credentials" ? 401 : 502 },
      );
    }
    return Response.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
