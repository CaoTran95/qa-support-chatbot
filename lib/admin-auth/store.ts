// Server-side cache of Admin / seed credentials, keyed by qaSessionId.
// Source of truth is encrypted HttpOnly cookies on the browser (Bidu-style).
// This store is filled from cookies on each browser request so MCP can fetch by qaSessionId.

import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import type { Domain, SeedRole } from "./domains";

export type DomainToken = {
  accessToken: string;
  /** epoch ms; undefined = backend did not report an expiry */
  expiresAt?: number;
  refreshToken?: string;
};

export type AdminTokenData = {
  /** Admin email, display only (never a secret). Empty when only test-account logins exist. */
  email: string;
  createdAt: number;
  tokens: Partial<Record<Domain, DomainToken>>;
  /** Display only: the test accounts behind the buyer/seller tokens. */
  seedEmails?: Partial<Record<SeedRole, string>>;
};

export interface AdminTokenStore {
  get(sessionId: string): Promise<AdminTokenData | undefined>;
  set(sessionId: string, data: AdminTokenData): Promise<void>;
  delete(sessionId: string): Promise<void>;
}

const MAX_ENTRIES = 1000;
/** Safety cap when a JWT has no exp claim (Community tokens normally include exp). */
export const MAX_SESSION_AGE_MS = 365 * 24 * 60 * 60 * 1000;

function tokenLive(t: DomainToken | undefined): boolean {
  if (!t?.accessToken) return false;
  if (t.expiresAt === undefined) return true;
  return t.expiresAt > Date.now();
}

/** Keep the record while any token is still live, or (no exp claims) within the safety cap. */
export function sessionStillValid(v: AdminTokenData, now = Date.now()): boolean {
  const tokens = Object.values(v.tokens).filter(Boolean) as DomainToken[];
  if (tokens.length === 0) return now - v.createdAt < MAX_SESSION_AGE_MS;
  if (tokens.some(tokenLive)) return true;
  // All tokens have exp and are expired.
  if (tokens.every((t) => t.expiresAt !== undefined)) return false;
  return now - v.createdAt < MAX_SESSION_AGE_MS;
}

class MemoryAdminTokenStore implements AdminTokenStore {
  private map = new Map<string, AdminTokenData>();

  async get(sessionId: string) {
    const v = this.map.get(sessionId);
    if (!v) return undefined;
    if (!sessionStillValid(v)) {
      this.map.delete(sessionId);
      return undefined;
    }
    return v;
  }

  async set(sessionId: string, data: AdminTokenData) {
    if (this.map.size >= MAX_ENTRIES && !this.map.has(sessionId)) {
      const oldest = this.map.keys().next().value;
      if (oldest !== undefined) this.map.delete(oldest);
    }
    this.map.set(sessionId, data);
  }

  async delete(sessionId: string) {
    this.map.delete(sessionId);
  }
}

class FileAdminTokenStore implements AdminTokenStore {
  private map = new Map<string, AdminTokenData>();
  private loaded = false;

  constructor(private readonly filePath: string) {}

  private ensureLoaded() {
    if (this.loaded) return;
    this.loaded = true;
    try {
      if (!existsSync(this.filePath)) return;
      const raw = JSON.parse(readFileSync(this.filePath, "utf8")) as Record<string, AdminTokenData>;
      for (const [k, v] of Object.entries(raw)) {
        if (v && typeof v === "object" && typeof v.createdAt === "number" && v.tokens) {
          if (sessionStillValid(v)) this.map.set(k, v);
        }
      }
    } catch {
      this.map.clear();
    }
  }

  private persist() {
    mkdirSync(dirname(this.filePath), { recursive: true });
    const obj: Record<string, AdminTokenData> = {};
    for (const [k, v] of this.map) obj[k] = v;
    writeFileSync(this.filePath, JSON.stringify(obj), { mode: 0o600 });
  }

  async get(sessionId: string) {
    this.ensureLoaded();
    const v = this.map.get(sessionId);
    if (!v) return undefined;
    if (!sessionStillValid(v)) {
      this.map.delete(sessionId);
      this.persist();
      return undefined;
    }
    return v;
  }

  async set(sessionId: string, data: AdminTokenData) {
    this.ensureLoaded();
    if (this.map.size >= MAX_ENTRIES && !this.map.has(sessionId)) {
      const oldest = this.map.keys().next().value;
      if (oldest !== undefined) this.map.delete(oldest);
    }
    this.map.set(sessionId, data);
    this.persist();
  }

  async delete(sessionId: string) {
    this.ensureLoaded();
    if (this.map.delete(sessionId)) this.persist();
  }
}

function createStore(): AdminTokenStore {
  if (process.env.NODE_ENV === "test") return new MemoryAdminTokenStore();
  const path = process.env.ADMIN_TOKEN_STORE_PATH?.trim() || `${process.cwd()}/.data/admin-token-store.json`;
  return new FileAdminTokenStore(path);
}

// Survives Next.js dev HMR / module re-evaluation.
const g = globalThis as unknown as { __adminTokenStore?: AdminTokenStore };
export const adminTokenStore: AdminTokenStore = (g.__adminTokenStore ??= createStore());
