// STAGING ONLY. The backend hosts must be listed in BIDU_STAGING_HOSTS
// (comma-separated hostnames), and known production hosts are always refused.
const PROD_DENY = new Set(["bidu.vn", "www.bidu.vn", "api.bidu.vn", "commerce.bidu.vn", "bidu.asia", "www.bidu.asia"]);

export function assertStagingBase(name: string, raw: string | undefined): string {
  if (!raw) throw new Error(`${name} is not configured`);
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error(`${name} is not a valid URL`);
  }
  const host = u.hostname.toLowerCase();
  const allowed = (process.env.BIDU_STAGING_HOSTS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (PROD_DENY.has(host)) throw new Error(`${name} points at a production host (${host}); refused`);
  if (!allowed.includes(host)) throw new Error(`${name} host ${host} is not in BIDU_STAGING_HOSTS`);
  return raw.replace(/\/+$/, "");
}
