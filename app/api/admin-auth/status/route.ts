import { publicStatus } from "@/lib/admin-auth/status";
import { qaSessionIdFor, readCookieSid } from "@/lib/admin-auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const sid = await readCookieSid();
  return Response.json(await publicStatus(sid ? qaSessionIdFor(sid) : undefined), {
    headers: { "Cache-Control": "no-store" },
  });
}
