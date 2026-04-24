// app/app/api/auth/register-welcome/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { randomBytes } from "crypto";
import { getUserByEmail, getUserByUsername } from "@/lib/db/queries";
import { hashPassword } from "@/lib/auth/password";
import { getSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/connection";
import { createRateLimiter, getClientIp } from "@/lib/rate-limit";

// 5 registration attempts per IP per 5 minutes
const isRateLimited = createRateLimiter({ windowMs: 300_000, max: 5 });

const schema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8),
  welcomeToken: z.string().min(32),
});

function generateUsername(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
}

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": "300" } }
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
      return NextResponse.json(
        { error: "Invalid or incomplete registration data" },
        { status: 400 }
      );
    }
    const { name, email, password, welcomeToken } = parsed.data;

    // Look up the waitlist entry by token first to validate email BEFORE burning the token
    const entry = getDb()
      .prepare(
        `SELECT * FROM waitlist
         WHERE approval_token = ? AND approval_token_expires_at > datetime('now') AND status = 'approved'`
      )
      .get(welcomeToken) as import("@/lib/db/types").WaitlistEntry | undefined;

    if (!entry) {
      return NextResponse.json({ error: "Invalid or expired approval link" }, { status: 400 });
    }

    // Validate email matches the approved entry before consuming the token
    if (entry.email.toLowerCase() !== email.toLowerCase()) {
      return NextResponse.json({ error: "Invalid or expired approval link" }, { status: 400 });
    }

    // Atomically claim the approval token. If two requests race, only one sees changes === 1.
    const claimed = getDb()
      .prepare(
        `UPDATE waitlist SET approval_token = NULL
         WHERE id = ? AND approval_token = ?`
      )
      .run(entry.id, welcomeToken);

    if (claimed.changes === 0) {
      return NextResponse.json({ error: "Invalid or expired approval link" }, { status: 400 });
    }

    const existing = getUserByEmail(email);
    if (existing) {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    }

    let username = generateUsername(name);
    if (!username) username = "user";
    if (getUserByUsername(username)) {
      username = `${username}_${randomBytes(3).toString("hex")}`;
    }

    const passwordHash = await hashPassword(password);

    // Wrap user creation in a transaction to ensure atomicity
    const db = getDb();
    const userId = db.transaction(() => {
      return db
        .prepare(
          `INSERT INTO users (username, email, password_hash, display_name, is_approved)
           VALUES (?, ?, ?, ?, ?)`
        )
        .run(username, email, passwordHash, entry.name, 1)
        .lastInsertRowid as number;
    })();

    const session = await getSession();
    session.userId = userId;
    session.username = username;
    session.displayName = entry.name;
    session.isAdmin = false;
    session.isApproved = true;
    session.onboardingCompleted = false;
    await session.save();

    return NextResponse.json({
      success: true,
      user: { username, displayName: entry.name },
    });
  } catch (err) {
    console.error("[POST /api/auth/register-welcome]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
