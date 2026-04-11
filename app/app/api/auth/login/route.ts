// app/app/api/auth/login/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getUserForAuth } from "@/lib/db/queries";
import { verifyPassword, isAccountLocked, recordFailedLogin, resetFailedLogins, getLockoutMinutesRemaining, hashPassword } from "@/lib/auth/password";
import { getSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/connection";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// Pre-computed valid argon2id hash for timing-safe non-existent user path.
// Initialized at module load time so it's ready on first request.
let DUMMY_HASH: string | null = null;
async function getDummyHash(): Promise<string> {
  if (!DUMMY_HASH) {
    DUMMY_HASH = await hashPassword("__koinar_dummy_password__");
  }
  return DUMMY_HASH;
}

export async function POST(request: NextRequest) {
  try {
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
      const minutesRemaining = getLockoutMinutesRemaining(user.id);
      return NextResponse.json(
        { error: `Account temporarily locked. Try again in ${minutesRemaining} minute${minutesRemaining !== 1 ? "s" : ""}.` },
        { status: 423 }
      );
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
    session.isAdmin = user.is_admin === 1;
    session.isApproved = user.is_approved === 1;
    await session.save();

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
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
