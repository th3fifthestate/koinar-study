// app/app/api/auth/login/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { randomBytes } from "crypto";
import { getUserForAuth } from "@/lib/db/queries";
import { verifyPassword, isAccountLocked, recordFailedLogin, resetFailedLogins, hashPassword } from "@/lib/auth/password";
import { getSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/connection";
import { createRateLimiter, getClientIp } from "@/lib/rate-limit";
import { sendAdminLoginCode } from "@/lib/email/resend";

// 10 login attempts per IP per minute
const isRateLimited = createRateLimiter({ windowMs: 60_000, max: 10 });

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// Pre-computed valid argon2id hash for timing-safe non-existent user path.
// Eagerly initialized at module load so no timing difference on first request.
let DUMMY_HASH: string | null = null;
const dummyHashReady = hashPassword("__koinar_dummy_password__").then((h) => {
  DUMMY_HASH = h;
});
async function getDummyHash(): Promise<string> {
  if (!DUMMY_HASH) await dummyHashReady;
  return DUMMY_HASH!;
}

function generateSixDigitCode(): string {
  const bytes = randomBytes(3);
  const num = ((bytes[0] << 16) | (bytes[1] << 8) | bytes[2]) % 1000000;
  return num.toString().padStart(6, "0");
}

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": "60" } }
      );
    }

    const body = await request.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 400 }
      );
    }
    const { email, password } = parsed.data;

    const user = getUserForAuth(email);
    if (!user) {
      // Constant-time response to prevent user enumeration via timing
      const dummyHash = await getDummyHash();
      await verifyPassword(dummyHash, password);
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    if (isAccountLocked(user.id)) {
      // Return generic 401 to prevent user enumeration via distinct lockout status
      const dummyHash = await getDummyHash();
      await verifyPassword(dummyHash, password);
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const valid = await verifyPassword(user.password_hash, password);
    if (!valid) {
      recordFailedLogin(user.id);
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    // For non-admin users, a correct password is the full authentication.
    // For admin users, do NOT reset failed-login counter here — reset it only
    // after the 2FA code verifies, so an attacker holding a correct admin
    // password can't keep the lockout counter pinned to zero.
    if (user.is_admin !== 1) {
      resetFailedLogins(user.id);
    }

    // Admin accounts require a second factor (6-digit code by email) before a
    // session is created. This runs even if the password was correct, so a
    // stolen password alone can't sign in as an admin.
    if (user.is_admin === 1) {
      const db = getDb();

      // Rate-limit per user: at most 3 codes per 15 minutes. Prevents
      // attackers from flooding the admin's inbox via the password-known
      // path (which this branch is gated behind anyway).
      const recent = db
        .prepare(
          `SELECT COUNT(*) AS c FROM admin_login_codes
           WHERE user_id = ? AND created_at > datetime('now', '-15 minutes')`
        )
        .get(user.id) as { c: number };
      if (recent.c >= 3) {
        return NextResponse.json(
          { error: "Too many sign-in codes requested. Please wait a few minutes and try again." },
          { status: 429 }
        );
      }

      const code = generateSixDigitCode();
      const pendingToken = randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      db.transaction(() => {
        // Invalidate any prior outstanding codes for this user; a password
        // re-submission replaces the active pending login entirely.
        db.prepare(
          `UPDATE admin_login_codes SET consumed = 1
           WHERE user_id = ? AND consumed = 0`
        ).run(user.id);
        db.prepare(
          `INSERT INTO admin_login_codes (user_id, pending_token, code, expires_at)
           VALUES (?, ?, ?, ?)`
        ).run(user.id, pendingToken, code, expiresAt);
      })();

      try {
        await sendAdminLoginCode({ to: user.email, code });
      } catch (err) {
        // If email fails, leave the row so the admin can retry without racking
        // up the rate-limit counter; but surface a generic failure to the client.
        console.error("[POST /api/auth/login] failed to send admin code", err);
        return NextResponse.json(
          { error: "We couldn't send your sign-in code. Please try again shortly." },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        step: "verify_login",
        pendingToken,
      });
    }

    // Update last_login (non-admin path only; admin's is updated after 2FA).
    getDb()
      .prepare("UPDATE users SET last_login = datetime('now') WHERE id = ?")
      .run(user.id);

    const session = await getSession();
    session.userId = user.id;
    session.username = user.username;
    session.displayName = user.display_name ?? undefined;
    session.isAdmin = false;
    session.isApproved = user.is_approved === 1;
    session.onboardingCompleted = user.onboarding_completed === 1;
    await session.save();

    // Minimal response — same top-level shape as the admin path. User
    // profile is fetched separately via /api/auth/me after redirect so we
    // don't leak is_admin here and don't expose user row fields.
    return NextResponse.json({ success: true, step: "done" });
  } catch (err) {
    console.error("[POST /api/auth/login]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
