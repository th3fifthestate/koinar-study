// app/lib/rate-limit.ts
// In-memory IP-based rate limiter.
// Note: state is lost on container restart — Cloudflare WAF provides persistent layer.

const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_MAX_REQUESTS = 5;
const MAX_ENTRIES = 10_000;

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

export function createRateLimiter(opts?: { windowMs?: number; max?: number }) {
  const windowMs = opts?.windowMs ?? DEFAULT_WINDOW_MS;
  const max = opts?.max ?? DEFAULT_MAX_REQUESTS;
  const store = new Map<string, RateLimitEntry>();

  return function isRateLimited(key: string): boolean {
    const now = Date.now();

    // Evict expired entries if map is getting large
    if (store.size > MAX_ENTRIES) {
      for (const [k, entry] of store) {
        if (now > entry.resetTime) store.delete(k);
      }
    }

    const entry = store.get(key);
    if (!entry || now > entry.resetTime) {
      store.set(key, { count: 1, resetTime: now + windowMs });
      return false;
    }
    entry.count++;
    return entry.count > max;
  };
}

/**
 * Extract the real client IP.
 * Priority: cf-connecting-ip (Cloudflare) > x-forwarded-for (proxy) > "unknown"
 */
export function getClientIp(request: Request | { headers: { get(name: string): string | null } }): string {
  const cfIp = request.headers.get("cf-connecting-ip");
  if (cfIp) return cfIp.trim();

  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? "unknown";

  return "unknown";
}
