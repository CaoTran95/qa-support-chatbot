import { randomBytes } from "node:crypto";
import { assertStagingBase } from "./guardrail";
import type { DomainToken } from "./store";

// Contracts below come from the backend source:
//  - Ecommerce: POST /api/v1/dev/auth/login {email,password} -> {success,data:<jwt>}  (routes/auth.ts, controllers/api/auth.ts)
//  - Community: POST /v1/cms/auth/login-otp {email,password,session_code} sends an SMS OTP,
//               POST /v1/cms/auth/verify-otp {email,session_code,code} -> {success,data:<jwt>} (routes/cms/auth.js)

export class LoginError extends Error {
  constructor(
    message: string,
    public readonly kind: "invalid_credentials" | "invalid_otp" | "forbidden" | "unavailable",
  ) {
    super(message);
  }
}

const TIMEOUT_MS = 15_000;

async function post(url: string, body: unknown): Promise<{ status: number; json: Record<string, unknown> }> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept-Language": "vi" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { status: res.status, json };
  } catch {
    throw new LoginError("Backend unreachable", "unavailable");
  }
}

/** Reads `exp` (seconds) from a JWT payload without verifying it. Used for expiry display only. */
export function jwtExpiryMs(jwt: string): number | undefined {
  try {
    const payload = JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString());
    return typeof payload.exp === "number" ? payload.exp * 1000 : undefined;
  } catch {
    return undefined;
  }
}

function tokenFrom(json: Record<string, unknown>): DomainToken {
  const jwt = json.data;
  if (json.success !== true || typeof jwt !== "string" || jwt.split(".").length !== 3) {
    throw new LoginError("Unexpected login response", "unavailable");
  }
  return { accessToken: jwt, expiresAt: jwtExpiryMs(jwt) };
}

export async function ecommerceLogin(email: string, password: string): Promise<DomainToken> {
  const base = assertStagingBase("ECOMMERCE_BASE_URL", process.env.ECOMMERCE_BASE_URL);
  const { status, json } = await post(`${base}/api/v1/dev/auth/login`, { email, password });
  if (status === 404 || status === 403 || status === 401 || status === 400) {
    throw new LoginError("Sai email hoặc mật khẩu", "invalid_credentials");
  }
  if (status >= 500) throw new LoginError("Backend error", "unavailable");
  return tokenFrom(json);
}

/** Community login with email + password only (POST /v1/auth/login): no SMS OTP. Used on staging. */
export async function communityPasswordLogin(email: string, password: string): Promise<DomainToken> {
  const base = assertStagingBase("COMMUNITY_BASE_URL", process.env.COMMUNITY_BASE_URL);
  const { status, json } = await post(`${base}/v1/auth/login`, { email, password });
  if (status >= 500) throw new LoginError("Backend error", "unavailable");
  if (status !== 200 || json.success !== true) throw new LoginError("Sai email hoặc mật khẩu", "invalid_credentials");
  return tokenFrom(json);
}

/** Step 1 of Community login. Returns the session_code needed by step 2. The password is not kept. */
export async function communityRequestOtp(email: string, password: string): Promise<string> {
  const base = assertStagingBase("COMMUNITY_BASE_URL", process.env.COMMUNITY_BASE_URL);
  const sessionCode = randomBytes(16).toString("hex");
  const { status, json } = await post(`${base}/v1/cms/auth/login-otp`, {
    email,
    password,
    session_code: sessionCode,
    ip_address: "qa-support-web",
  });
  if (status >= 500) throw new LoginError("Backend error", "unavailable");
  if (status !== 200 || json.success !== true) throw new LoginError("Sai email/mật khẩu hoặc tài khoản không phải Admin", "invalid_credentials");
  return sessionCode;
}

export async function communityVerifyOtp(email: string, sessionCode: string, code: string): Promise<DomainToken> {
  const base = assertStagingBase("COMMUNITY_BASE_URL", process.env.COMMUNITY_BASE_URL);
  const { status, json } = await post(`${base}/v1/cms/auth/verify-otp`, { email, session_code: sessionCode, code });
  if (status >= 500) throw new LoginError("Backend error", "unavailable");
  if (status !== 200 || json.success !== true) throw new LoginError("OTP không đúng hoặc đã hết hạn", "invalid_otp");
  return tokenFrom(json);
}
