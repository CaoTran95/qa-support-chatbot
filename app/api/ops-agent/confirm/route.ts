import { proxyOpsAgentAction } from "@/lib/ops-agent/proxy-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return proxyOpsAgentAction("confirm", req);
}
