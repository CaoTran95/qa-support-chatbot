import { SEED_ROLES, seedDomain, type Domain, type SeedRole } from "./domains";
import type { AdminTokenData, DomainToken } from "./store";

const SEED_DOMAINS: Domain[] = SEED_ROLES.map(seedDomain);

function split(tokens: AdminTokenData["tokens"] | undefined) {
  const seed: AdminTokenData["tokens"] = {};
  const admin: AdminTokenData["tokens"] = {};
  for (const [k, v] of Object.entries(tokens ?? {}) as [Domain, DomainToken][]) {
    (SEED_DOMAINS.includes(k) ? seed : admin)[k] = v;
  }
  return { seed, admin };
}

/** Admin login (Ecommerce, Community password or Community OTP). Buyer/seller tokens always survive. */
export function mergeAdminLogin(
  prev: AdminTokenData | undefined,
  p: { email: string; domain: "ecommerce" | "community"; token: DomainToken; createdAt: number },
): AdminTokenData {
  const { seed, admin } = split(prev?.tokens);
  const sameAdmin = !!prev && prev.email === p.email;
  return {
    email: p.email,
    createdAt: p.createdAt,
    tokens: { ...(sameAdmin ? admin : {}), ...seed, [p.domain]: p.token },
    ...(prev?.seedEmails ? { seedEmails: prev.seedEmails } : {}),
  };
}

/** Buyer/seller login. Never touches the Admin email, createdAt or tokens. */
export function mergeSeedLogin(
  prev: AdminTokenData | undefined,
  p: { role: SeedRole; email: string; token: DomainToken; now: number },
): AdminTokenData {
  return {
    email: prev?.email ?? "",
    createdAt: prev?.createdAt ?? p.now,
    tokens: { ...(prev?.tokens ?? {}), [seedDomain(p.role)]: p.token },
    seedEmails: { ...(prev?.seedEmails ?? {}), [p.role]: p.email },
  };
}
