import { isSeedRole, type SeedRole } from "./domains";

const MARKER = /\[\[SEED_AUTH_REQUIRED:([^\]]*)\]\]/g;

/** Finds `[[SEED_AUTH_REQUIRED:buyer,seller]]` markers, returns the reply without them and the valid roles (deduplicated, in order). */
export function parseSeedMarker(reply: string): { reply: string; roles: SeedRole[] } {
  const roles: SeedRole[] = [];
  for (const m of reply.matchAll(MARKER)) {
    for (const part of (m[1] ?? "").split(",")) {
      const role = part.trim();
      if (isSeedRole(role) && !roles.includes(role)) roles.push(role);
    }
  }
  return { reply: reply.replace(MARKER, "").trim(), roles };
}
