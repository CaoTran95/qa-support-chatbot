import { callOpsAgentAdmin, parsePreviewToken, requireEcommerceAdminToken } from "./ecommerce";

type Action = "lookup" | "confirm" | "cancel";

const PATH: Record<Action, string> = {
  lookup: "/api/v3/admin/ops-agent/actions/lookup",
  confirm: "/api/v3/admin/ops-agent/actions/confirm",
  cancel: "/api/v3/admin/ops-agent/actions/cancel",
};

export async function proxyOpsAgentAction(action: Action, req: Request): Promise<Response> {
  let body: { preview_token?: unknown; confirmations?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const preview_token = parsePreviewToken(body.preview_token);
  if (!preview_token) {
    return Response.json({ success: false, error: "preview_token phải là 64 ký tự hex" }, { status: 400 });
  }

  const confirmations =
    action === "confirm" && Array.isArray(body.confirmations)
      ? body.confirmations.filter((c): c is string => typeof c === "string" && c.length > 0 && c.length <= 40).slice(0, 10)
      : undefined;

  const auth = await requireEcommerceAdminToken();
  if (!auth.ok) return auth.response;

  let payload: Record<string, unknown> = { preview_token };
  if (action === "confirm") payload = { ...payload, confirmations: confirmations ?? [] };

  try {
    const { status, json } = await callOpsAgentAdmin(PATH[action], auth.accessToken, payload);
    return Response.json(json, { status, headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    const message = e instanceof Error ? e.message : "ECOMMERCE_BASE_URL not configured";
    return Response.json({ success: false, error: message, kind: "unavailable" }, { status: 503 });
  }
}
