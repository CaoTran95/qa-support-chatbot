import { clearPending } from "@/lib/admin-auth/pending-otp";
import { clearCookieSid, qaSessionIdFor, readCookieSid } from "@/lib/admin-auth/session";
import { adminTokenStore } from "@/lib/admin-auth/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const sid = await readCookieSid();
  if (sid) {
    const id = qaSessionIdFor(sid);
    await adminTokenStore.delete(id);
    clearPending(id);
  }
  await clearCookieSid();
  return Response.json({ success: true, connected: false });
}
