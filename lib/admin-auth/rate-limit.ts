// Tiny per-session limiter for login attempts (per minute).
const g = globalThis as unknown as { __loginHits?: Map<string, number[]> };
const hits: Map<string, number[]> = (g.__loginHits ??= new Map());

export function rateLimited(key: string, max = 10): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t: number) => now - t < 60_000);
  recent.push(now);
  hits.set(key, recent);
  return recent.length > max;
}
