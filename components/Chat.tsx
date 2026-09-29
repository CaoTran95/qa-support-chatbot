"use client";

import { useMemo } from "react";
import {
  AssistantRuntimeProvider,
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useLocalRuntime,
  type ChatModelAdapter,
} from "@assistant-ui/react";

const SUGGESTIONS = [
  "Tôi đang test flow refund, hãy hướng dẫn tôi cần kiểm tra những gì.",
  "Xin chào, bạn là ai?",
];

// Adapter between assistant-ui and our /api/chat bridge. The Hermes session id
// lives in this closure (one per browser tab), so sessions are never shared.
function createHermesAdapter(): ChatModelAdapter {
  let sessionId: string | null = null;
  return {
    async run({ messages, abortSignal }) {
      const last = messages[messages.length - 1];
      const message = last.content
        .map((p) => (p.type === "text" ? p.text : ""))
        .join("\n")
        .trim();

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, sessionId }),
        signal: abortSignal,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
      if (data.sessionId) sessionId = data.sessionId;
      return { content: [{ type: "text", text: data.reply }] };
    },
  };
}

function UserMessage() {
  return (
    <MessagePrimitive.Root className="msg msg-user">
      <div className="bubble">
        <MessagePrimitive.Parts />
      </div>
    </MessagePrimitive.Root>
  );
}

function AssistantMessage() {
  return (
    <MessagePrimitive.Root className="msg msg-assistant">
      <div className="bubble">
        <MessagePrimitive.Parts />
        <MessagePrimitive.Error>
          <div className="error-box" role="alert">
            <strong>Lỗi:</strong> Hermes không phản hồi được. Kiểm tra lại kết nối hoặc thử gửi lại.
          </div>
        </MessagePrimitive.Error>
      </div>
    </MessagePrimitive.Root>
  );
}

function Thread() {
  return (
    <ThreadPrimitive.Root className="thread">
      <ThreadPrimitive.Viewport className="viewport">
        <ThreadPrimitive.Empty>
          <div className="empty">
            <p>Hỏi QA Support bất cứ điều gì về kiểm thử.</p>
            <div className="suggestions">
              {SUGGESTIONS.map((s) => (
                <ThreadPrimitive.Suggestion key={s} prompt={s} send className="suggestion">
                  {s}
                </ThreadPrimitive.Suggestion>
              ))}
            </div>
          </div>
        </ThreadPrimitive.Empty>
        <ThreadPrimitive.Messages>
          {({ message }) => (message.role === "user" ? <UserMessage /> : <AssistantMessage />)}
        </ThreadPrimitive.Messages>
        <ThreadPrimitive.If running>
          <div className="typing">QA Support đang trả lời…</div>
        </ThreadPrimitive.If>
      </ThreadPrimitive.Viewport>

      <ComposerPrimitive.Root className="composer">
        <ComposerPrimitive.Input
          className="composer-input"
          placeholder="Nhập câu hỏi cho QA Support…"
          rows={1}
          autoFocus
        />
        <ThreadPrimitive.If running={false}>
          <ComposerPrimitive.Send className="btn">Gửi</ComposerPrimitive.Send>
        </ThreadPrimitive.If>
        <ThreadPrimitive.If running>
          <ComposerPrimitive.Cancel className="btn btn-cancel">Dừng</ComposerPrimitive.Cancel>
        </ThreadPrimitive.If>
      </ComposerPrimitive.Root>
    </ThreadPrimitive.Root>
  );
}

export function Chat() {
  const adapter = useMemo(() => createHermesAdapter(), []);
  const runtime = useLocalRuntime(adapter);
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <Thread />
    </AssistantRuntimeProvider>
  );
}
