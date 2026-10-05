"use client";

import { useMemo, type FC } from "react";
import {
  AssistantRuntimeProvider,
  ThreadPrimitive,
  useLocalRuntime,
  type ChatModelAdapter,
} from "@assistant-ui/react";
import { Thread } from "@/components/assistant-ui/elements/thread.aui";
import { ThreadList } from "@/components/assistant-ui/elements/thread-list.aui";
import type { Bot } from "@/lib/hermes/profiles";
import { ThinkingIndicator } from "./ThinkingIndicator";
import { AdminAuthBar, AUTH_REQUIRED_EVENT } from "./AdminAuthBar";
import { SeedAuthBar, SEED_AUTH_REQUIRED_EVENT } from "./SeedAuthBar";
import { parseSeedMarker } from "@/lib/admin-auth/seed-marker";
import { BotSwitcher } from "./BotSwitcher";
import { HermesStatus } from "./HermesStatus";

const AUTH_MARKER = "[[ADMIN_AUTH_REQUIRED]]";

// Adapter between assistant-ui and our /api/chat bridge.
// One Hermes session per assistant-ui thread id (tab-local Map).
function createHermesAdapter(profile: string): ChatModelAdapter {
  const sessions = new Map<string, string>();
  return {
    async run({ messages, abortSignal, unstable_threadId }) {
      const threadKey = unstable_threadId ?? "default";
      let sessionId = sessions.get(threadKey) ?? null;
      const last = messages[messages.length - 1];
      const message = last.content
        .map((p) => (p.type === "text" ? p.text : ""))
        .join("\n")
        .trim();

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, sessionId, profile }),
        signal: abortSignal,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
      if (data.sessionId) sessions.set(threadKey, data.sessionId);
      const needsAuth =
        typeof data.reply === "string" &&
        (data.reply.includes(AUTH_MARKER) || /connect admin/i.test(data.reply));
      const adminReply = needsAuth ? data.reply.replaceAll(AUTH_MARKER, "").trim() : data.reply;
      if (needsAuth) window.dispatchEvent(new Event(AUTH_REQUIRED_EVENT));
      const seed = typeof adminReply === "string" ? parseSeedMarker(adminReply) : { reply: adminReply, roles: [] };
      if (seed.roles.length) window.dispatchEvent(new CustomEvent(SEED_AUTH_REQUIRED_EVENT, { detail: { roles: seed.roles } }));
      return { content: [{ type: "text", text: seed.reply }] };
    },
  };
}

function BotWelcome({ bot }: { bot: Bot }) {
  return (
    <div className="aui-thread-welcome-root mb-6 flex flex-col px-2">
      <p className="aui-thread-welcome-message-inner fade-in slide-in-from-bottom-1 animate-in fill-mode-both text-2xl font-medium tracking-tight duration-200 sm:text-3xl">
        {bot.emptyText}
      </p>
    </div>
  );
}

function BotSuggestions({ bot }: { bot: Bot }) {
  return (
    <div className="flex w-full flex-wrap justify-center gap-2 px-1">
      {bot.suggestions.map((s) => (
        <ThreadPrimitive.Suggestion
          key={s}
          prompt={s}
          send
          className="bg-muted/50 hover:bg-muted text-foreground max-w-full rounded-full border border-border px-3.5 py-1.5 text-left text-sm transition-colors"
        >
          <span className="line-clamp-1">{s}</span>
        </ThreadPrimitive.Suggestion>
      ))}
    </div>
  );
}

export function Chat({ bot }: { bot: Bot }) {
  const adapter = useMemo(() => createHermesAdapter(bot.profile), [bot.profile]);
  const runtime = useLocalRuntime(adapter);
  const Welcome: FC = useMemo(() => {
    const Comp: FC = () => <BotWelcome bot={bot} />;
    Comp.displayName = "BotWelcome";
    return Comp;
  }, [bot]);
  const EmptySuggestions: FC = useMemo(() => {
    const Comp: FC = () => <BotSuggestions bot={bot} />;
    Comp.displayName = "BotSuggestions";
    return Comp;
  }, [bot]);
  const Thinking: FC = useMemo(() => {
    const Comp: FC = () => <ThinkingIndicator label={bot.typing} />;
    Comp.displayName = "BotThinking";
    return Comp;
  }, [bot]);

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div className="bg-background flex h-dvh w-full overflow-hidden">
        <aside className="bg-muted/40 flex w-[260px] shrink-0 flex-col border-r border-border">
          <div className="flex flex-col gap-3 border-b border-border p-3">
            <div className="flex items-center justify-between gap-2 px-1">
              <h1 className="truncate text-sm font-semibold tracking-tight">{bot.label}</h1>
            </div>
            <BotSwitcher current={bot} />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            <ThreadList />
          </div>
          <div className="flex flex-col gap-2 border-t border-border p-3">
            <HermesStatus key={bot.profile} profile={bot.profile} />
            <AdminAuthBar />
            <SeedAuthBar />
          </div>
        </aside>
        <main className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
            <span className="text-muted-foreground text-sm">New chat</span>
          </header>
          <div className="min-h-0 flex-1">
            <Thread
              components={{
                Welcome,
                EmptySuggestions,
                ThinkingIndicator: Thinking,
              }}
            />
          </div>
        </main>
      </div>
    </AssistantRuntimeProvider>
  );
}
