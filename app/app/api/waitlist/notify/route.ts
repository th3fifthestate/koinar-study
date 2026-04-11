import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

function getAudienceId(): string {
  const id = process.env.RESEND_AUDIENCE_ID;
  if (!id && process.env.NODE_ENV === "production") {
    throw new Error("RESEND_AUDIENCE_ID is required in production");
  }
  return id ?? "";
}

// RFC 5321: max 254 chars total, max 64 chars local part
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 254;
const MAX_BODY_SIZE = 1024; // 1KB

// Allowed HTTP methods
const ALLOWED_METHODS = new Set(["POST"]);

// In-memory rate limiter (IP-based, 5 requests per minute)
// Note: state is lost on container restart — Cloudflare WAF provides persistent layer
const rateLimit = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60_000;
const RATE_LIMIT_MAX = 5;
// Prevent unbounded Map growth under sustained attack
const RATE_LIMIT_MAX_ENTRIES = 10_000;

function isRateLimited(ip: string): boolean {
  const now = Date.now();

  // Evict expired entries if map is getting large
  if (rateLimit.size > RATE_LIMIT_MAX_ENTRIES) {
    for (const [key, entry] of rateLimit) {
      if (now > entry.resetTime) rateLimit.delete(key);
    }
  }

  const entry = rateLimit.get(ip);
  if (!entry || now > entry.resetTime) {
    rateLimit.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT_MAX;
}

/**
 * Extract the real client IP.
 * Priority: cf-connecting-ip (Cloudflare) > x-forwarded-for (proxy) > "unknown"
 */
function getClientIp(request: Request): string {
  // Cloudflare sets this to the true client IP — most reliable behind CF
  const cfIp = request.headers.get("cf-connecting-ip");
  if (cfIp) return cfIp.trim();

  // Fallback: first entry in x-forwarded-for chain
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? "unknown";

  return "unknown";
}

export async function POST(request: Request) {
  // Rate limit by IP
  const ip = getClientIp(request);
  if (isRateLimited(ip)) {
    return Response.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  // Reject wrong content type
  const contentType = request.headers.get("content-type");
  if (!contentType?.includes("application/json")) {
    return Response.json({ error: "Content-Type must be application/json" }, { status: 415 });
  }

  // Reject oversized bodies
  const contentLength = request.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > MAX_BODY_SIZE) {
    return Response.json({ error: "Request too large" }, { status: 413 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Validate body is a plain object (not array, not null)
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const email = "email" in body ? (body as { email: unknown }).email : undefined;

  if (
    !email ||
    typeof email !== "string" ||
    email.length > MAX_EMAIL_LENGTH ||
    !EMAIL_REGEX.test(email)
  ) {
    return Response.json({ error: "Valid email is required" }, { status: 400 });
  }

  // Normalize email to lowercase to prevent case-based duplicates
  const normalizedEmail = email.toLowerCase().trim();

  try {
    const { error } = await resend.contacts.create({
      email: normalizedEmail,
      audienceId: getAudienceId(),
      unsubscribed: false,
    });

    if (error) {
      if (
        error.name === "validation_error" &&
        error.message?.toLowerCase().includes("already exists")
      ) {
        return Response.json({ error: "Already subscribed" }, { status: 409 });
      }
      // Log error name/message only — never log API keys or full error objects
      console.error("[waitlist] Resend error:", error.name, error.message);
      return Response.json({ error: "Failed to subscribe" }, { status: 500 });
    }

    return Response.json({ success: true }, { status: 201 });
  } catch (err) {
    // Catches getAudienceId() throw (missing env var) or unexpected Resend failures
    console.error("[waitlist] Unexpected error:", err instanceof Error ? err.message : "unknown");
    return Response.json({ error: "Failed to subscribe" }, { status: 500 });
  }
}
