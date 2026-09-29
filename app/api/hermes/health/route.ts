import { checkHealth } from "@/lib/hermes/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const status = await checkHealth();
  return Response.json(status, { status: status.ok ? 200 : 503 });
}
