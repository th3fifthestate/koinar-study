// app/app/api/auth/reset-password/route.ts
//
// Link-based password reset — consume phase.
//
// Accepts { token, newPassword }, validates the token is live + unconsumed,
// hashes the new password, updates users.password_hash, and destroys every
// session for that user (DB rows + the current iron-session cookie).
//
// Security notes:
//   - Token never leaves the client unless the user pastes it; we match
//     against sha256(token) in the DB.
//   - The transactional claim (consumePasswordResetToken) prevents two
//     racing POSTs from both succeeding.
//   - On success, EVERY outstanding reset token for this user is also
//     consumed, so a second reset email already in the inbox can't be
//     used afterward.
//   - Admin accounts: the password change works, but next login still
//     requires the email-2FA code. Reset does NOT create a session.
//   - failed_login_attempts / locked_until are cleared as part of
//     updateUserPassword — sensible: a successful reset proves ownership
//     and should unstick an accidentally-locked account.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createHash } from "crypto";
import {
  findActivePasswordResetToken,
  consumePasswordResetToken,
  updateUserPassword,
  deleteUserSessions,
  getUserForAuthById,
} from "@/lib/db/queries";
import { hashPassword } from "@/lib/auth/password";
import { getSession } from "@/lib/auth/session";
import { createRateLimiter, getClientIp } from "@/lib/rate-limit";

// 10 attempts per IP per 15 minutes. Each attempt costs an argon2 hash
// (slow by design), so this is generous but caps runaway automation.
const ipRateLimited = createRateLimiter({ windowMs: 15 * 60_000, max: 10 });

// Token: 32 random bytes base64url-encoded = 43 chars. Accept a tight range
// around that to reject obviously bogus input without a DB round-trip.
const schema = z.object({
  token: z.string().min(40).max(64),
  newPassword: z.string().min(8).max(200),
});

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
      const firstIssue = parsed.error.issues[0];
      // Surface password-length errors specifically so the UI can show
      // them to the user; everything else collapses to "invalid link".
      const isPassword = firstIssue?.path.includes("newPassword");
      return NextResponse.json(
        {
          error: isPassword
            ? "Password must be at least 8 characters."
            : "This reset link is invalid or expired.",
        },
        { status: 400 }
      );
    }
    const { token, newPassword } = parsed.data;

    const tokenHash = createHash("sha256").update(token).digest("hex");
    const row = findActivePasswordResetToken(tokenHash);
    if (!row) {
      return NextResponse.json(
        { error: "This reset link is invalid or expired." },
        { status: 400 }
      );
    }

    const user = getUserForAuthById(row.user_id);
    if (!user) {
      // User was deleted between request and reset. Treat as invalid
      // rather than surfacing a "user not found" — no point confusing
      // anyone with that state.
      return NextResponse.json(
        { error: "This reset link is invalid or expired." },
        { status: 400 }
      );
    }

    // Claim the token atomically. If another tab already consumed it
    // (or the user clicked the email link twice), bail without making
    // any changes to the password.
    const claimed = consumePasswordResetToken(row.id, row.user_id);
    if (!claimed) {
      return NextResponse.json(
        { error: "This reset link was already used or has expired." },
        { status: 400 }
      );
    }

    // Hash BEFORE the DB writes so a crash here leaves the password
    // untouched (token is already consumed, which is correct — a broken
    // reset shouldn't leave a live token in the DB).
    const newHash = await hashPassword(newPassword);

    try {
      updateUserPassword(user.id, newHash);
      // Invalidate every session for this user. If someone else had
      // stolen the password, they're kicked out now.
      deleteUserSessions(user.id);
    } catch (err) {
      console.error("[POST /api/auth/reset-password] DB write failed", err);
      return NextResponse.json(
        { error: "We couldn't reset your password. Please try again." },
        { status: 500 }
      );
    }

    // Belt-and-suspenders: nuke the current request's iron-session cookie
    // too. Even if no row existed in sessions (iron-session is the primary
    // store), this guarantees the requester can't carry a cookie forward.
    const session = await getSession();
    await session.destroy();

    console.info(
      `[security] password reset completed for userId=${user.id}`
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[POST /api/auth/reset-password]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
