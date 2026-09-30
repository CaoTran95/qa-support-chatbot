import { checkHealth, resolveProfile } from "@/lib/hermes/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const profile = resolveProfile(new URL(req.url).searchParams.get("profile"));
  if (!profile) return Response.json({ error: "Unknown profile" }, { status: 400 });
  const status = await checkHealth(profile);
  return Response.json(status, { status: status.ok ? 200 : 503 });
}
