import { Resend } from "resend";
import { env } from "@/lib/env";
import { createRateLimiter, getClientIp } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

const resend = new Resend(env.RESEND_API_KEY);

function getAudienceId(): string {
  const id = env.RESEND_AUDIENCE_ID;
  if (!id && env.NODE_ENV === "production") {
    throw new Error("RESEND_AUDIENCE_ID is required in production");
  }
  return id ?? "";
}

// RFC 5321: max 254 chars total, max 64 chars local part
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 254;
const MAX_BODY_SIZE = 1024; // 1KB

// Method gating is handled by Next.js itself — only the POST export is
// reachable. Non-POST verbs return 405 with no handler invocation.

const isRateLimited = createRateLimiter({ windowMs: 60_000, max: 5 });

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
      logger.error(
        { route: "/api/waitlist/notify", method: "POST", errName: error.name, errMessage: error.message },
        "Resend contact create failed"
      );
      return Response.json({ error: "Failed to subscribe" }, { status: 500 });
    }

    return Response.json({ success: true }, { status: 201 });
  } catch (err) {
    // Catches getAudienceId() throw (missing env var) or unexpected Resend failures
    logger.error(
      { route: "/api/waitlist/notify", method: "POST", err },
      "Waitlist notify unexpected error"
    );
    return Response.json({ error: "Failed to subscribe" }, { status: 500 });
  }
}
