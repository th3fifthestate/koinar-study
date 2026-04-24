// app/app/api/auth/forgot-password/route.ts
//
// Link-based password reset — request phase.
//
// Always returns 200 regardless of whether the email resolves to a real
// user. A distinct 404/400 would let an attacker enumerate accounts; the
// rate-limiter and the lack of a delivery-side signal keep enumeration
// attacks unattractive.
//
// Security notes:
//   - Token: 32 random bytes → 256-bit entropy. Stored as sha256 hash
//     in the DB so a row leak (logs, backups, accidental SELECT *) is
//     not usable without the original token.
//   - TTL: 30 minutes. Single-use, enforced by consumed_at column +
//     transactional WHERE consumed_at IS NULL on claim.
//   - Two rate gates:
//       1. Per-IP burst: 5 / 15 min. Stops mass-enumeration loops.
//       2. Per-user: 3 / 15 min. Stops inbox flooding.
//   - Admin accounts: reset works, but the user still has to complete
//     the email-2FA challenge on their next login. Nothing here bypasses
//     that. This is by design — a leaked reset email alone cannot grant
//     admin access.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { randomBytes, createHash } from "crypto";
import {
  getUserByEmail,
  createPasswordResetToken,
  countRecentPasswordResetTokens,
} from "@/lib/db/queries";
import { sendPasswordResetEmail } from "@/lib/email/resend";
import { config } from "@/lib/config";
import { createRateLimiter, getClientIp } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

// 5 requests per IP per 15 minutes. Deliberately looser than the login
// rate-limit because legitimate users fat-finger emails and there's no
// branching on the response anyway — a miss is as cheap as a hit.
const ipRateLimited = createRateLimiter({ windowMs: 15 * 60_000, max: 5 });

const schema = z.object({
  email: z.string().email().max(254),
});

/** Generic success body. Must not vary on whether the user exists. */
const OK = { success: true } as const;

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    if (ipRateLimited(ip)) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": "900" } }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      // Malformed email shape: give a clear 400 (not enumeration — a
      // real attacker wouldn't send a non-RFC-5322 address by mistake).
      return NextResponse.json(
        { error: "Please enter a valid email address." },
        { status: 400 }
      );
    }
    const { email } = parsed.data;

    // queries.normalizeEmail runs inside getUserByEmail so "Josh@..." and
    // "josh@..." resolve identically.
    const user = getUserByEmail(email);

    // If the email isn't registered, return 200 without doing any work.
    // Yes, this creates a minor timing channel (no argon2 hash, no email
    // send) — but we're not verifying a password here, so the hash-timing
    // defense used in /api/auth/login doesn't apply. The stronger mitigation
    // is the per-IP rate-limit above.
    if (!user) {
      return NextResponse.json(OK);
    }

    // Banned users get the same silent-success response. No signal about
    // account status leaks back to the requester.
    // (is_banned isn't on SafeUser; fetch it separately would leak info
    // via timing anyway — accept that banned accounts can still request
    // reset emails they can't act on. The reset route also blocks ban.)

    // Per-user gate: 3 per 15 min. Prevents a motivated attacker who
    // already knows the email from flooding the user's inbox as a harassment
    // or sender-rep attack vector.
    const recent = countRecentPasswordResetTokens(user.id, 15);
    if (recent >= 3) {
      return NextResponse.json(OK); // same opaque response
    }

    // Generate + store. Raw token only lives in memory for the duration
    // of this request + the email we're about to send.
    const rawToken = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    createPasswordResetToken(user.id, tokenHash, expiresAt);

    const resetLink = `${config.app.url}/reset/${rawToken}`;

    try {
      await sendPasswordResetEmail({
        to: user.email,
        displayName: user.display_name ?? user.username,
        resetLink,
      });
    } catch (err) {
      // Email delivery failed. The token is already written; we log and
      // still return 200 so the client doesn't branch on delivery state.
      // The user will either retry (within the rate-limit) or contact us.
      logger.error(
        { route: "/api/auth/forgot-password", event: "email_delivery_failed", err },
        "Forgot password email delivery failed"
      );
    }

    console.info(
      `[security] password reset requested for userId=${user.id}`
    );
    return NextResponse.json(OK);
  } catch (err) {
    logger.error({ route: "/api/auth/forgot-password", err }, "Forgot password failed");
    // Still return 200 on unexpected errors to preserve the enumeration
    // defense. The server-side log is the canonical signal.
    return NextResponse.json(OK);
  }
}
