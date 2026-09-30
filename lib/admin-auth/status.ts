import { adminTokenStore, type AdminTokenData, type DomainToken } from "./store";

export type Domain = "ecommerce" | "community";

export function liveToken(data: AdminTokenData | undefined, domain: Domain): DomainToken | undefined {
  const t = data?.tokens[domain];
  if (!t) return undefined;
  if (t.expiresAt && t.expiresAt <= Date.now()) return undefined;
  return t;
}

/** Browser-safe view: booleans and display data only, never a token. */
export async function publicStatus(qaSessionId: string | undefined) {
  const data = qaSessionId ? await adminTokenStore.get(qaSessionId) : undefined;
  const ecommerce = !!liveToken(data, "ecommerce");
  const community = !!liveToken(data, "community");
  return { connected: ecommerce || community, ecommerce, community, email: data?.email ?? null };
}
