# QA Support Web

Prototype web chat cho Hermes profile `qa-support`. UI dùng [assistant-ui](https://www.assistant-ui.com/) (`@assistant-ui/react` 0.15.x), backend là Next.js App Router bridge sang Hermes CLI.

## Kiến trúc

```
Browser (assistant-ui: Thread / Message / Composer, useLocalRuntime + ChatModelAdapter)
   │  POST /api/chat {message, sessionId?}
   ▼
app/api/chat/route.ts            (validate input)
   ▼
lib/hermes/client.ts             (spawn, không qua shell)
   ▼
hermes -p qa-support chat -Q --source web --query-file - [--resume <id>]
   ▼
reply + session_id  ──► Browser
```

- `GET /api/hermes/health` kiểm tra Hermes CLI (`hermes --version`) và profile (`hermes profile list`). UI hiển thị `Hermes: Connected / Unavailable`.
- Tin nhắn của user được gửi qua **stdin** (`--query-file -`), argv cố định, không dùng shell → không inject command được.
- Có timeout (mặc định 180s), giới hạn output, giới hạn độ dài message (20k ký tự).

## Yêu cầu

- Node.js 20+ (đã test với 25), npm
- Hermes CLI trong `PATH` (`hermes --version`)
- Profile `qa-support` đã cài (`hermes profile list`) và đã cấu hình provider/auth sẵn. Web **không** sửa profile và **không** đọc `~/.hermes`.

## Chạy

```bash
npm install
cp .env.example .env.local   # tuỳ chọn
npm run dev                  # http://localhost:3000
# hoặc
npm run build && npm start
```

Biến môi trường (tuỳ chọn): `HERMES_PROFILE` (mặc định `qa-support`), `HERMES_BIN` (`hermes`), `HERMES_TIMEOUT_MS` (`180000`).

## Test

```bash
curl -s localhost:3000/api/hermes/health
curl -s -X POST localhost:3000/api/chat -H 'content-type: application/json' \
  -d '{"message":"Xin chào, bạn là ai?"}'
```

Sau đó mở trình duyệt, gõ: "Tôi đang test flow refund, hãy hướng dẫn tôi cần kiểm tra những gì."

## Session / context

Lần chat đầu Hermes tạo session và trả `session_id`. Adapter phía client giữ id trong bộ nhớ của tab và gửi lại ở các lượt sau (`--resume`). Mỗi tab một session, không trộn giữa các user. Server chỉ cho resume các session do chính nó tạo (lưu trong RAM), nên browser không thể gắn vào session tuỳ ý.

## Deploy: web trên Render, Hermes chạy local qua ngrok

```
Browser → Web (Render) ──HTTPS──► ngrok ──► bridge (127.0.0.1:8787, máy local) ──► hermes CLI
```

Khi đặt `HERMES_BRIDGE_URL`, web không spawn CLI mà gọi bridge qua HTTP. Nếu không đặt, web chạy CLI trực tiếp như chế độ local.

**1. Trên máy local (có Hermes):**

```bash
export BRIDGE_TOKEN=$(openssl rand -hex 24)   # lưu lại giá trị này
npm run bridge                                # lắng nghe 127.0.0.1:8787
ngrok http 8787                               # nên dùng domain cố định: ngrok http --url=<domain> 8787
```

Bridge từ chối khởi động nếu thiếu `BRIDGE_TOKEN`. Mọi request phải có `Authorization: Bearer <BRIDGE_TOKEN>`; giới hạn 4 tiến trình đồng thời và 30 request/phút (`BRIDGE_MAX_CONCURRENT`, `BRIDGE_MAX_PER_MINUTE`).

**2. Trên Render (Web Service):**
- Build command: `npm install && npm run build`, Start command: `npm start`
- Environment: `HERMES_BRIDGE_URL=https://<domain>.ngrok-free.app`, `HERMES_BRIDGE_TOKEN=<cùng giá trị BRIDGE_TOKEN>`, `HERMES_TIMEOUT_MS=180000`
- Token và URL chỉ nằm ở server, browser không thấy.

**Lưu ý:** máy local phải bật cùng bridge và ngrok. Link ngrok free đổi sau mỗi lần restart (phải sửa lại env trên Render). Link ngrok là public: giữ kín `BRIDGE_TOKEN`, và vì Hermes chạy với approvals tự bypass nên không chia sẻ token rộng rãi.

## Limitations

- **Không streaming token**: `hermes chat -Q` chỉ in kết quả cuối, nên UI hiển thị trạng thái "đang trả lời…" rồi hiện cả câu trả lời.
- Mỗi lượt spawn một tiến trình Hermes (khởi động chậm, vài giây đến vài chục giây).
- Reload trang hoặc restart server → mất liên kết session (bắt đầu hội thoại mới). Lịch sử hiển thị chỉ nằm trong memory của tab.
- Nếu server restart mà tab cũ còn mở, lượt kế tiếp báo lỗi `Unknown session`; reload trang để bắt đầu lại.
- Chưa có auth, rate limit, database, tool-call rendering, MCP, Bug Coordinator. Chỉ dùng local.
- Hermes chạy one-shot với approvals tự động bypass (hành vi của `-Q`/non-TTY) theo cấu hình profile.

## Admin auth bridge (tra cứu dữ liệu Ecommerce / Community)

QA Support tra cứu dữ liệu staging qua MCP `bidu-admin-mcp` bằng **chính phiên Admin của QA**. Token nằm server-side, không bao giờ tới browser, Hermes hay LLM.

```
QA Browser ── chat ──► /api/chat ──► Hermes (env QA_SESSION_ID=<qaSessionId>) ──► bidu-admin-mcp (stdio)
    │                                                                             │  POST /api/internal/admin-auth/token
    │ popup /admin-login hoặc /seed-login/{buyer|seller}                          │  (HMAC bằng QA_INTERNAL_SECRET)
    ▼                                                                             ▼
/api/admin-auth/community-login ──► Community /v1/auth/login ──► AdminTokenStore ◄── qa-support-web
/api/admin-auth/community-otp|verify ──► Community CMS OTP
/api/seed-auth/login ──► Community /v1/auth/login (lưu slot ecommerce_buyer|seller cho MCP)
```

**Routes**

| Route | Việc |
|---|---|
| `GET /api/admin-auth/status` | `{connected, ecommerce, community, email, seed}` — chỉ boolean, không token |
| `POST /api/admin-auth/login` | alias Community password login (không còn Ecommerce) |
| `POST /api/admin-auth/community-login` | email+password → Community (`POST /v1/auth/login`) |
| `POST /api/admin-auth/community-otp` | bước 1 Community CMS: BE gửi OTP SMS |
| `POST /api/admin-auth/community-verify` | bước 2: nhập OTP |
| `POST /api/seed-auth/login` | buyer/seller → Community password login; token lưu `ecommerce_buyer`/`ecommerce_seller` |
| `POST /api/admin-auth/logout` | xoá token + cookie |
| `POST /api/internal/admin-auth/token` | **chỉ MCP** (HMAC), không cho browser |
| `/admin-login` | popup Admin; `/seed-login/{role}` popup buyer/seller |

Web **chỉ login Community**. Token Community của Admin cũng phục vụ MCP domain `ecommerce` (fallback trong `liveToken`). MCP vẫn gọi Ecommerce API bằng token đó; web không cần `ECOMMERCE_BASE_URL`.

**Session & token ownership**

- Cookie `qa_sid` (256-bit random, `HttpOnly`, `SameSite=Lax`, `Secure` ở production).
- `qaSessionId = HMAC-SHA256(QA_INTERNAL_SECRET, "qa-session:" + qa_sid)`: đây là id duy nhất Hermes/MCP biết, nên lộ id này không thể dùng làm cookie.
- Cookie `qa_sid` (id phiên) + cookie JWT đã mã hóa (`qa_tok_*`, giống Bidu cookie `bidu`): token nằm trên browser (HttpOnly), không đưa vào JS/LLM.
- Mỗi request chat/status: web đọc cookie → đồng bộ cache server theo `qaSessionId` để MCP (stdio, không có cookie browser) vẫn lấy token qua HMAC.
- `AdminTokenStore` chỉ là cache MCP (memory/file); nguồn đúng là cookie. Disconnect xoá cookie + cache.
- Password chỉ đi qua server tới backend rồi bỏ; OTP step 1 chỉ giữ `email + session_code` 5 phút.

**Internal auth contract (lựa chọn thiết kế)**: MCP lấy token thật qua `/api/internal/admin-auth/token` với header `x-qa-timestamp` + `x-qa-signature = HMAC(secret, ts.qaSessionId.domain)`, lệch giờ tối đa 60s. Chọn "trả token cho MCP" thay vì proxy vì MCP là tiến trình tin cậy, chạy local và cần gọi hai backend; secret dùng chung đơn giản hơn ký JWT cho prototype. Token không bị log, không trả cho model. Nếu web ở Render còn MCP ở máy local thì token đi qua HTTPS Render→local: dùng HTTPS bắt buộc.

**AUTH_REQUIRED**: khi MCP báo `AUTH_REQUIRED`, QA Support trả lời yêu cầu Connect Admin và kết thúc bằng `[[ADMIN_AUTH_REQUIRED]]`; UI gỡ marker, highlight nút **Connect Admin**.

**Env** (xem `.env.example`): `QA_INTERNAL_SECRET` (≥32 ký tự), `COMMUNITY_BASE_URL`, `BIDU_STAGING_HOSTS`. Chỉ staging: host phải nằm trong `BIDU_STAGING_HOSTS`, các host production đã biết luôn bị từ chối. Web không dùng `ECOMMERCE_BASE_URL`.

**Kết nối Hermes**: mọi request chat truyền `qaSessionId` qua env `QA_SESSION_ID` của tiến trình `hermes` (cả local lẫn qua `bridge/`). `.env` của profile qa-support phải có cùng `QA_INTERNAL_SECRET` và `QA_WEB_INTERNAL_URL` (URL mà MCP gọi được tới web này; web trên Render thì đặt URL Render).

**Troubleshooting**: `503` ở internal route = thiếu `QA_INTERNAL_SECRET`; `502 unavailable` khi login = BE không tới được hoặc host chưa nằm trong `BIDU_STAGING_HOSTS`; bot nói "không có công cụ Admin MCP" = Hermes chưa kịp khởi động MCP (nâng `mcp_single_query_discovery_timeout`, xem README `bidu-admin-mcp`).
