import { clearPending } from "@/lib/admin-auth/pending-otp";
import { clearCookieSid, qaSessionIdFor, readCookieSid } from "@/lib/admin-auth/session";
import { clearAuthSession } from "@/lib/admin-auth/session-persist";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const sid = await readCookieSid();
  const qaSessionId = sid ? qaSessionIdFor(sid) : undefined;
  if (qaSessionId) clearPending(qaSessionId);
  await clearAuthSession(qaSessionId);
  await clearCookieSid();
  return Response.json({ success: true, connected: false });
}
