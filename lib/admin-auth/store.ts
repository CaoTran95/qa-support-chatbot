// Server-side holder of Admin credentials, keyed by qaSessionId.
// The in-memory implementation is a prototype: swap it for Redis/DB by
// implementing AdminTokenStore and changing createStore() below.

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
const MAX_AGE_MS = 12 * 60 * 60 * 1000;

class MemoryAdminTokenStore implements AdminTokenStore {
  private map = new Map<string, AdminTokenData>();

  async get(sessionId: string) {
    const v = this.map.get(sessionId);
    if (v && Date.now() - v.createdAt > MAX_AGE_MS) {
      this.map.delete(sessionId);
      return undefined;
    }
    return v;
  }

  async set(sessionId: string, data: AdminTokenData) {
    if (this.map.size >= MAX_ENTRIES) {
      const oldest = this.map.keys().next().value;
      if (oldest !== undefined) this.map.delete(oldest);
    }
    this.map.set(sessionId, data);
  }

  async delete(sessionId: string) {
    this.map.delete(sessionId);
  }
}

function createStore(): AdminTokenStore {
  return new MemoryAdminTokenStore();
}

// Survives Next.js dev HMR / module re-evaluation.
const g = globalThis as unknown as { __adminTokenStore?: AdminTokenStore };
export const adminTokenStore: AdminTokenStore = (g.__adminTokenStore ??= createStore());
