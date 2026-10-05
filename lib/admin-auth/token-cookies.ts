// Encrypted auth cookies on the browser (Bidu-webapp style). Source of truth for JWTs;
// the server store is a cache so MCP can fetch by qaSessionId without browser cookies.

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { internalSecret } from "./session";
import type { AdminTokenData, DomainToken } from "./store";

/** Match Bidu-scale session lifetime (~1 year JWT). */
export const AUTH_COOKIE_MAX_AGE_S = 365 * 24 * 60 * 60;

const META = "qa_auth_meta";
const TOK_COMMUNITY = "qa_tok_community";
const TOK_BUYER = "qa_tok_buyer";
const TOK_SELLER = "qa_tok_seller";
export const AUTH_COOKIE_NAMES = [META, TOK_COMMUNITY, TOK_BUYER, TOK_SELLER] as const;

function keyBuf(): Buffer {
  return createHash("sha256").update(internalSecret()).digest();
}

/** AES-256-GCM pack: iv(12) + tag(16) + ciphertext, base64url. Exported for unit tests. */
export function sealString(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyBuf(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64url");
}

export function unsealString(packed: string): string | undefined {
  try {
    const buf = Buffer.from(packed, "base64url");
    if (buf.length < 28) return undefined;
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const data = buf.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", keyBuf(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch {
    return undefined;
  }
}

function cookieOpts() {
  return {
    httpOnly: true as const,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: AUTH_COOKIE_MAX_AGE_S,
  };
}

function parseToken(json: string): DomainToken | undefined {
  try {
    const t = JSON.parse(json) as DomainToken;
    return typeof t?.accessToken === "string" && t.accessToken ? t : undefined;
  } catch {
    return undefined;
  }
}

/** Write Admin + seed JWTs into HttpOnly encrypted cookies (like Bidu `bidu` cookie). */
export async function writeAuthCookies(data: AdminTokenData): Promise<void> {
  const jar = await cookies();
  const opts = cookieOpts();
  jar.set(
    META,
    sealString(
      JSON.stringify({
        email: data.email,
        createdAt: data.createdAt,
        seedEmails: data.seedEmails ?? {},
      }),
    ),
    opts,
  );

  const setTok = (name: string, t: DomainToken | undefined) => {
    if (t?.accessToken) jar.set(name, sealString(JSON.stringify(t)), opts);
    else jar.delete(name);
  };
  setTok(TOK_COMMUNITY, data.tokens.community);
  setTok(TOK_BUYER, data.tokens.ecommerce_buyer);
  setTok(TOK_SELLER, data.tokens.ecommerce_seller);
}

/** Read sealed auth cookies. Returns undefined if missing or tampered. */
export async function readAuthCookies(): Promise<AdminTokenData | undefined> {
  const jar = await cookies();
  const metaRaw = jar.get(META)?.value;
  if (!metaRaw) return undefined;
  const metaJson = unsealString(metaRaw);
  if (!metaJson) return undefined;
  let meta: { email?: unknown; createdAt?: unknown; seedEmails?: AdminTokenData["seedEmails"] };
  try {
    meta = JSON.parse(metaJson) as typeof meta;
  } catch {
    return undefined;
  }
  if (typeof meta.createdAt !== "number") return undefined;

  const readTok = (name: string): DomainToken | undefined => {
    const raw = jar.get(name)?.value;
    if (!raw) return undefined;
    const json = unsealString(raw);
    return json ? parseToken(json) : undefined;
  };

  return {
    email: typeof meta.email === "string" ? meta.email : "",
    createdAt: meta.createdAt,
    tokens: {
      community: readTok(TOK_COMMUNITY),
      ecommerce_buyer: readTok(TOK_BUYER),
      ecommerce_seller: readTok(TOK_SELLER),
    },
    ...(meta.seedEmails ? { seedEmails: meta.seedEmails } : {}),
  };
}

export async function clearAuthCookies(): Promise<void> {
  const jar = await cookies();
  for (const name of AUTH_COOKIE_NAMES) jar.delete(name);
}
