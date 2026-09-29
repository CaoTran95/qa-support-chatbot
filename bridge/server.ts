import { createServer } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { chat, checkHealth, HermesError } from "../lib/hermes/local";

const PORT = Number(process.env.BRIDGE_PORT) || 8787;
const TOKEN = process.env.BRIDGE_TOKEN;
const MAX_BODY = 64 * 1024;
const MAX_CONCURRENT = Number(process.env.BRIDGE_MAX_CONCURRENT) || 4;
const MAX_PER_MINUTE = Number(process.env.BRIDGE_MAX_PER_MINUTE) || 30;

if (!TOKEN || TOKEN.length < 16) {
  console.error("BRIDGE_TOKEN is required (min 16 chars). Generate one: openssl rand -hex 24");
  process.exit(1);
}
const expected = Buffer.from(`Bearer ${TOKEN}`);

let inFlight = 0;
let windowStart = Date.now();
let windowCount = 0;

function authorized(header: string | undefined): boolean {
  const got = Buffer.from(header ?? "");
  return got.length === expected.length && timingSafeEqual(got, expected);
}

function readBody(req: import("node:http").IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new Error("too_large"));
        req.destroy();
      } else chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString()));
    req.on("error", reject);
  });
}

createServer(async (req, res) => {
  const send = (status: number, body: unknown) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
  };

  if (!authorized(req.headers.authorization)) return send(401, { error: "Unauthorized" });

  try {
    if (req.method === "GET" && req.url === "/health") {
      const s = await checkHealth();
      return send(s.ok ? 200 : 503, s);
    }

    if (req.method === "POST" && req.url === "/chat") {
      const now = Date.now();
      if (now - windowStart > 60_000) [windowStart, windowCount] = [now, 0];
      if (++windowCount > MAX_PER_MINUTE || inFlight >= MAX_CONCURRENT) {
        return send(429, { error: "Too many requests", code: "failed" });
      }

      let body: { message?: unknown; sessionId?: unknown };
      try {
        body = JSON.parse(await readBody(req));
      } catch {
        return send(400, { error: "Invalid JSON body" });
      }
      const message = typeof body.message === "string" ? body.message.trim() : "";
      if (!message || message.length > 20_000) return send(400, { error: "Invalid message" });
      const sessionId = typeof body.sessionId === "string" && body.sessionId ? body.sessionId : undefined;

      inFlight++;
      try {
        return send(200, await chat(message, sessionId));
      } finally {
        inFlight--;
      }
    }

    send(404, { error: "Not found" });
  } catch (e) {
    if (e instanceof HermesError) {
      const status = { not_found: 503, timeout: 504, bad_session: 409, failed: 502 }[e.code];
      return send(status, { error: e.message, code: e.code });
    }
    send(500, { error: "Unexpected bridge error" });
  }
}).listen(PORT, "127.0.0.1", () => {
  console.log(`hermes-bridge listening on http://127.0.0.1:${PORT}`);
});
