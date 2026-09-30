import { spawn } from "node:child_process";
import { findBot } from "./profiles";

export const HERMES_PROFILE = process.env.HERMES_PROFILE || "qa-support";
const HERMES_BIN = process.env.HERMES_BIN || "hermes";
const DEFAULT_TIMEOUT_MS = Number(process.env.HERMES_TIMEOUT_MS) || 180_000;
const MAX_OUTPUT_BYTES = 1_000_000;
const SESSION_ID_RE = /^\d{8}_\d{6}_[0-9a-f]+$/;

// Only sessions created by this server may be resumed, so a browser can't
// attach to arbitrary Hermes sessions (CLI, gateway, other users).
// A session is bound to the profile that created it: it can't be resumed under another bot.
const g = globalThis as unknown as { __hermesSessionProfiles?: Map<string, string> };
const knownSessions = (g.__hermesSessionProfiles ??= new Map<string, string>());

/** `undefined`/empty means the default profile; a name outside the bot allowlist is refused (`null`). */
export function resolveProfile(input: unknown): string | null {
  if (input === undefined || input === null || input === "") return HERMES_PROFILE;
  return findBot(input) ? (input as string) : null;
}

export class HermesError extends Error {
  constructor(
    message: string,
    public readonly code: "not_found" | "timeout" | "failed" | "bad_session",
  ) {
    super(message);
  }
}

type RunResult = { stdout: string; stderr: string; exitCode: number | null };

function run(
  args: string[],
  stdin?: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  extraEnv: Record<string, string> = {},
): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    // No shell: args are passed as an argv array, user text goes through stdin.
    const child = spawn(/*turbopackIgnore: true*/ HERMES_BIN, args, {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, NO_COLOR: "1", ...extraEnv },
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);

    child.stdout.on("data", (d) => {
      if (stdout.length < MAX_OUTPUT_BYTES) stdout += d.toString();
    });
    child.stderr.on("data", (d) => {
      if (stderr.length < MAX_OUTPUT_BYTES) stderr += d.toString();
    });
    child.on("error", (err: NodeJS.ErrnoException) => {
      clearTimeout(timer);
      reject(
        err.code === "ENOENT"
          ? new HermesError("Hermes CLI not found in PATH", "not_found")
          : new HermesError(`Failed to start Hermes: ${err.message}`, "failed"),
      );
    });
    child.on("close", (exitCode) => {
      clearTimeout(timer);
      if (timedOut) reject(new HermesError(`Hermes timed out after ${timeoutMs / 1000}s`, "timeout"));
      else resolve({ stdout, stderr, exitCode });
    });
    child.stdin.on("error", () => {});
    child.stdin.end(stdin ?? "");
  });
}

export type HealthStatus = {
  ok: boolean;
  cli: boolean;
  profile: boolean;
  profileName: string;
  version?: string;
  error?: string;
};

export async function checkHealth(profileName: string = HERMES_PROFILE): Promise<HealthStatus> {
  const base: HealthStatus = { ok: false, cli: false, profile: false, profileName };
  try {
    const v = await run(["--version"], undefined, 15_000);
    if (v.exitCode !== 0) return { ...base, error: "Hermes CLI returned an error" };
    base.cli = true;
    base.version = v.stdout.split("\n")[0]?.trim();
    const list = await run(["profile", "list"], undefined, 15_000);
    const escaped = profileName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`^[\\s◆*]*${escaped}(\\s|$)`, "m");
    base.profile = list.exitCode === 0 && re.test(list.stdout);
    if (!base.profile) return { ...base, error: `Profile "${profileName}" not found` };
    return { ...base, ok: true };
  } catch (e) {
    return { ...base, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

const QA_SESSION_RE = /^[0-9a-f]{64}$/;

export async function chat(
  message: string,
  sessionId?: string,
  qaSessionId?: string,
  profile: string = HERMES_PROFILE,
): Promise<{ reply: string; sessionId: string | null; profile: string }> {
  const args = ["-p", profile, "chat", "-Q", "--source", "web", "--query-file", "-"];
  if (sessionId) {
    if (!SESSION_ID_RE.test(sessionId) || knownSessions.get(sessionId) !== profile) {
      throw new HermesError("Unknown session", "bad_session");
    }
    args.push("--resume", sessionId);
  }

  // The Admin MCP (stdio child of Hermes) reads QA_SESSION_ID from its config env.
  // Only the opaque id is passed; tokens are fetched by the MCP from the web server.
  const extraEnv = qaSessionId && QA_SESSION_RE.test(qaSessionId) ? { QA_SESSION_ID: qaSessionId } : { QA_SESSION_ID: "" };
  const { stdout, stderr, exitCode } = await run(args, message, DEFAULT_TIMEOUT_MS, extraEnv);
  if (exitCode !== 0) {
    const detail = (stderr || stdout).trim().split("\n").slice(-3).join(" ").slice(0, 300);
    throw new HermesError(`Hermes exited with code ${exitCode}${detail ? `: ${detail}` : ""}`, "failed");
  }

  // -Q prints the reply on stdout and "session_id: <id>" on stderr (or stdout on some versions).
  const idRe = /^session_id:\s*(\S+)\s*$/m;
  const m = stderr.match(idRe) ?? stdout.match(idRe);
  const newSession = m && SESSION_ID_RE.test(m[1]) ? m[1] : null;
  const reply = stdout.replace(idRe, "").trim();
  if (newSession) knownSessions.set(newSession, profile);
  if (!reply) throw new HermesError("Hermes returned an empty response", "failed");
  return { reply, sessionId: newSession, profile };
}
