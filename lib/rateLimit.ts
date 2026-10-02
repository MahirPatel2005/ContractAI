// Per-instance, in-memory limiter. It slows accidental loops on a single server; on
// serverless hosts use a shared store (Redis/Upstash) for a real limit.
const hits = new Map<string, number[]>();

export function isRateLimited(key: string, limit = 10, windowMs = 60_000): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  recent.push(now);
  hits.set(key, recent);
  return recent.length > limit;
}

export function clientKey(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}
