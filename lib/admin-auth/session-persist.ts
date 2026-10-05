import { clearAuthCookies, readAuthCookies, writeAuthCookies } from "./token-cookies";
import { adminTokenStore, type AdminTokenData } from "./store";

/** Persist like Bidu webapp: encrypted cookies on the browser + server cache for MCP. */
export async function saveAuthSession(qaSessionId: string, data: AdminTokenData): Promise<void> {
  await writeAuthCookies(data);
  await adminTokenStore.set(qaSessionId, data);
}

/**
 * Cookies are the source of truth when present (browser request).
 * Sync into the server store so MCP can fetch by qaSessionId on a later stdio call.
 */
export async function loadAuthSession(qaSessionId: string | undefined): Promise<AdminTokenData | undefined> {
  let fromCookies: AdminTokenData | undefined;
  try {
    fromCookies = await readAuthCookies();
  } catch {
    // Outside a Next.js request (unit tests) — fall back to the server cache only.
    fromCookies = undefined;
  }
  if (fromCookies) {
    if (qaSessionId) await adminTokenStore.set(qaSessionId, fromCookies);
    return fromCookies;
  }
  return qaSessionId ? adminTokenStore.get(qaSessionId) : undefined;
}

export async function clearAuthSession(qaSessionId: string | undefined): Promise<void> {
  await clearAuthCookies();
  if (qaSessionId) await adminTokenStore.delete(qaSessionId);
}
