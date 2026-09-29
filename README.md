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

## Limitations

- **Không streaming token**: `hermes chat -Q` chỉ in kết quả cuối, nên UI hiển thị trạng thái "đang trả lời…" rồi hiện cả câu trả lời.
- Mỗi lượt spawn một tiến trình Hermes (khởi động chậm, vài giây đến vài chục giây).
- Reload trang hoặc restart server → mất liên kết session (bắt đầu hội thoại mới). Lịch sử hiển thị chỉ nằm trong memory của tab.
- Nếu server restart mà tab cũ còn mở, lượt kế tiếp báo lỗi `Unknown session`; reload trang để bắt đầu lại.
- Chưa có auth, rate limit, database, tool-call rendering, MCP, Bug Coordinator. Chỉ dùng local.
- Hermes chạy one-shot với approvals tự động bypass (hành vi của `-Q`/non-TTY) theo cấu hình profile.
