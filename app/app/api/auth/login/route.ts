// app/app/api/auth/login/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getUserForAuth } from "@/lib/db/queries";
import { verifyPassword, isAccountLocked, recordFailedLogin, resetFailedLogins, hashPassword } from "@/lib/auth/password";
import { getSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/connection";
import { createRateLimiter, getClientIp } from "@/lib/rate-limit";

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

    resetFailedLogins(user.id);

    // Update last_login
    getDb()
      .prepare("UPDATE users SET last_login = datetime('now') WHERE id = ?")
      .run(user.id);

    const session = await getSession();
    session.userId = user.id;
    session.username = user.username;
    session.displayName = user.display_name ?? undefined;
    session.isAdmin = user.is_admin === 1;
    session.isApproved = user.is_approved === 1;
    session.onboardingCompleted = user.onboarding_completed === 1;
    await session.save();

    return NextResponse.json({
      success: true,
      user: {
        username: user.username,
        displayName: user.display_name,
        isAdmin: user.is_admin === 1,
      },
    });
  } catch (err) {
    console.error("[POST /api/auth/login]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
