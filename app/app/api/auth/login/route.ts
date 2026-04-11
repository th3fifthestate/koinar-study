// app/app/api/auth/login/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getUserForAuth } from "@/lib/db/queries";
import { verifyPassword, isAccountLocked, recordFailedLogin, resetFailedLogins, getLockoutMinutesRemaining } from "@/lib/auth/password";
import { getSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/connection";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

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
      // Constant-time response to prevent user enumeration
      await verifyPassword("$argon2id$v=19$m=65536,t=3,p=4$dummy", password).catch(() => {});
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
