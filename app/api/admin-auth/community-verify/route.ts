import { communityVerifyOtp, LoginError } from "@/lib/admin-auth/backends";
import { clearPending, takePending } from "@/lib/admin-auth/pending-otp";
import { mergeAdminLogin } from "@/lib/admin-auth/merge";
import { rateLimited } from "@/lib/admin-auth/rate-limit";
import { qaSessionIdFor, readCookieSid } from "@/lib/admin-auth/session";
import { publicStatus } from "@/lib/admin-auth/status";
import { adminTokenStore } from "@/lib/admin-auth/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { code?: unknown };
  const code = typeof body.code === "string" ? body.code.trim() : "";
  if (!/^\d{4,8}$/.test(code)) return Response.json({ success: false, error: "OTP không hợp lệ" }, { status: 400 });

  const sid = await readCookieSid();
  const qaSessionId = sid ? qaSessionIdFor(sid) : undefined;
  const pending = qaSessionId ? takePending(qaSessionId) : undefined;
  if (!qaSessionId || !pending) {
    return Response.json({ success: false, error: "Phiên OTP đã hết hạn, hãy yêu cầu mã mới", kind: "invalid_otp" }, { status: 409 });
  }
  if (rateLimited(qaSessionId, 10)) return Response.json({ success: false, error: "Thử lại sau ít phút" }, { status: 429 });

  try {
    const token = await communityVerifyOtp(pending.email, pending.sessionCode, code);
    clearPending(qaSessionId);
    const prev = await adminTokenStore.get(qaSessionId);
    await adminTokenStore.set(
      qaSessionId,
      mergeAdminLogin(prev, { email: pending.email, domain: "community", token, createdAt: prev?.createdAt ?? Date.now() }),
    );
    return Response.json({ success: true, ...(await publicStatus(qaSessionId)) });
  } catch (e) {
    if (e instanceof LoginError) {
      return Response.json(
        { success: false, error: e.message, kind: e.kind },
        { status: e.kind === "invalid_otp" ? 401 : 502 },
      );
    }
    return Response.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
