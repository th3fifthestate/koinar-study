// app/app/api/auth/login/verify/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { timingSafeEqual } from "crypto";
import { getDb } from "@/lib/db/connection";
import { getUserForAuthById } from "@/lib/db/queries";
import { resetFailedLogins } from "@/lib/auth/password";
import { getSession } from "@/lib/auth/session";
import { createRateLimiter, getClientIp } from "@/lib/rate-limit";

// 10 verify attempts per IP per minute (matches login route). The per-row
// attempt counter (capped at 5) is the primary defense; this limits scan noise.
const isRateLimited = createRateLimiter({ windowMs: 60_000, max: 10 });

const bodySchema = z.object({
  pendingToken: z.string().min(32).max(128),
  code: z.string().length(6),
});

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": "60" } }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid code format" }, { status: 400 });
    }
    const { pendingToken, code } = parsed.data;

    const db = getDb();

    // Atomic: look up the pending login, increment attempts, and only
    // accept a match when attempts (post-increment) is <= 5.
    const match = db.transaction(() => {
      const row = db
        .prepare(
          `SELECT id, user_id, code, expires_at, attempts, consumed
           FROM admin_login_codes
           WHERE pending_token = ?`
        )
        .get(pendingToken) as
          | {
              id: number;
              user_id: number;
              code: string;
              expires_at: string;
              attempts: number;
              consumed: number;
            }
          | undefined;

      if (!row) return null;
      if (row.consumed === 1) return null;
      if (new Date(row.expires_at).getTime() <= Date.now()) return null;
      if (row.attempts >= 5) {
        // Lock this pending login out by marking it consumed; the admin
        // must restart with the password step.
        db.prepare(`UPDATE admin_login_codes SET consumed = 1 WHERE id = ?`).run(row.id);
        return null;
      }

      db.prepare(`UPDATE admin_login_codes SET attempts = attempts + 1 WHERE id = ?`).run(row.id);

      const codeMatch =
        row.code.length === code.length &&
        timingSafeEqual(Buffer.from(row.code, "utf8"), Buffer.from(code, "utf8"));
      if (!codeMatch) return null;

      db.prepare(`UPDATE admin_login_codes SET consumed = 1 WHERE id = ?`).run(row.id);
      return { userId: row.user_id };
    })();

    if (!match) {
      return NextResponse.json({ error: "Invalid or expired code" }, { status: 400 });
    }

    const user = getUserForAuthById(match.userId);
    // Defense in depth: require that the user is still admin at this instant.
    // If an admin was demoted between password-step and verify-step, deny.
    if (!user || user.is_admin !== 1) {
      return NextResponse.json({ error: "Invalid or expired code" }, { status: 400 });
    }

    // Now that 2FA has succeeded, clear the per-user failed-login counter.
    // Deferred from the password step so an attacker with only the admin
    // password cannot keep the lockout pinned at zero.
    resetFailedLogins(user.id);

    db.prepare("UPDATE users SET last_login = datetime('now') WHERE id = ?").run(user.id);

    const session = await getSession();
    session.userId = user.id;
    session.username = user.username;
    session.displayName = user.display_name ?? undefined;
    session.isAdmin = true;
    session.isApproved = user.is_approved === 1;
    session.onboardingCompleted = user.onboarding_completed === 1;
    await session.save();

    return NextResponse.json({ success: true, step: "done" });
  } catch (err) {
    console.error("[POST /api/auth/login/verify]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
