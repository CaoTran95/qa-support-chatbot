// Community OTP step-1 state (email + session_code, never the password), keyed by qaSessionId.
const TTL_MS = 5 * 60 * 1000;
const g = globalThis as unknown as { __pendingOtp?: Map<string, { email: string; sessionCode: string; at: number }> };
const map = (g.__pendingOtp ??= new Map());

export function setPending(qaSessionId: string, email: string, sessionCode: string) {
  map.set(qaSessionId, { email, sessionCode, at: Date.now() });
}
export function takePending(qaSessionId: string) {
  const v = map.get(qaSessionId);
  if (!v || Date.now() - v.at > TTL_MS) {
    map.delete(qaSessionId);
    return undefined;
  }
  return v;
}
export function clearPending(qaSessionId: string) {
  map.delete(qaSessionId);
}
