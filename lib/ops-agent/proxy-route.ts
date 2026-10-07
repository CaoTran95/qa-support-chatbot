import { callOpsAgentAdmin, parsePreviewToken, requireEcommerceAdminToken } from "./ecommerce";

type Action = "lookup" | "confirm" | "cancel";

const PATH: Record<Action, string> = {
  lookup: "/api/v3/admin/ops-agent/actions/lookup",
  confirm: "/api/v3/admin/ops-agent/actions/confirm",
  cancel: "/api/v3/admin/ops-agent/actions/cancel",
};

function humanizeOpsError(status: number, json: Record<string, unknown>): Record<string, unknown> {
  const raw =
    (typeof json.message === "string" && json.message) ||
    (typeof json.error === "string" && json.error) ||
    "";
  const name = typeof json.error === "string" ? json.error : "";
  let error = raw || `Lỗi HTTP ${status}`;

  if (status === 401 || /not_authorize|un.?auth/i.test(raw + name)) {
    error =
      "JWT Admin không được ecommerce BE chấp nhận. Connect Admin bằng tài khoản ecommerce/CMS đúng môi trường (cùng JWT secret với BE đang preview).";
  } else if (status === 403 || /admin_not_allowed|FORBIDDEN/i.test(raw + name)) {
    error =
      "Tài khoản Admin không nằm trong OPS_AGENT_ADMIN_IDS trên BE. Đổi tài khoản Connect Admin hoặc thêm _id vào allowlist.";
  } else if (status === 404 || /action_not_found|not_found/i.test(raw + name)) {
    error =
      "Không tìm thấy thẻ trên BE này — thường do preview tạo ở BE khác (vd. localhost:8082) trong khi web đang gọi BE staging/Render. Hãy mở QA web local cùng BE đã preview.";
  } else if (status === 409) {
    error = raw || "Thẻ không còn ở trạng thái chờ xác nhận (đã xử lý / hết hạn / đang chạy).";
  } else if (status >= 500 || json.kind === "unavailable") {
    error = raw || "Không gọi được ecommerce BE (ECOMMERCE_BASE_URL / BE tắt).";
  }

  return { ...json, success: false, error, message: error };
}

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
    if (status >= 400 || json.success === false) {
      console.warn(`[ops-agent] ${action} → ${status}`, {
        error: json.error,
        message: json.message,
        base: process.env.ECOMMERCE_BASE_URL,
      });
      return Response.json(humanizeOpsError(status, json), {
        status,
        headers: { "Cache-Control": "no-store" },
      });
    }
    return Response.json(json, { status, headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    const message = e instanceof Error ? e.message : "ECOMMERCE_BASE_URL not configured";
    console.warn(`[ops-agent] ${action} unavailable:`, message);
    return Response.json(
      {
        success: false,
        error: `Ecommerce BE không cấu hình/không tới được: ${message}. Local case-5 cần ECOMMERCE_BASE_URL=http://localhost:8082`,
        kind: "unavailable",
      },
      { status: 503 },
    );
  }
}
