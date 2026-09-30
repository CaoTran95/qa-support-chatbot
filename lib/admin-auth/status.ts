import { adminTokenStore, type AdminTokenData, type DomainToken } from "./store";

export type Domain = "ecommerce" | "community";

const isLive = (t: DomainToken | undefined): t is DomainToken => !!t && !(t.expiresAt && t.expiresAt <= Date.now());

export function liveToken(data: AdminTokenData | undefined, domain: Domain): DomainToken | undefined {
  const own = data?.tokens[domain];
  if (isLive(own)) return own;
  // An Admin account has one JWT for both backends (per the operator), so a Community login (SMS OTP) also
  // serves the Ecommerce tools. If the Ecommerce backend rejects it, the MCP gets a 401 and reports AUTH_REQUIRED.
  const shared = domain === "ecommerce" ? data?.tokens.community : undefined;
  return isLive(shared) ? shared : undefined;
}

/** Browser-safe view: booleans and display data only, never a token. */
export async function publicStatus(qaSessionId: string | undefined) {
  const data = qaSessionId ? await adminTokenStore.get(qaSessionId) : undefined;
  const ecommerce = !!liveToken(data, "ecommerce");
  const community = !!liveToken(data, "community");
  return { connected: ecommerce || community, ecommerce, community, email: data?.email ?? null };
}
