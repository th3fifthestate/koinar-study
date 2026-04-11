// app/app/api/auth/register-welcome/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { randomBytes } from "crypto";
import { getWaitlistByApprovalToken, getUserByEmail, getUserByUsername, createUser } from "@/lib/db/queries";
import { hashPassword } from "@/lib/auth/password";
import { getSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/connection";

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
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", fields: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const { name, email, password, welcomeToken } = parsed.data;

    const entry = getWaitlistByApprovalToken(welcomeToken);
    if (!entry) {
      return NextResponse.json({ error: "Invalid or expired approval link" }, { status: 400 });
    }

    if (entry.email.toLowerCase() !== email.toLowerCase()) {
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
    const userId = createUser({
      username,
      email,
      password_hash: passwordHash,
      display_name: entry.name,
      is_approved: 1,
    });

    // Invalidate the approval token to prevent reuse
    getDb()
      .prepare("UPDATE waitlist SET approval_token = NULL WHERE id = ?")
      .run(entry.id);

    const session = await getSession();
    session.userId = userId;
    session.username = username;
    session.isAdmin = false;
    session.isApproved = true;
    await session.save();

    return NextResponse.json({
      success: true,
      user: { id: userId, username, displayName: entry.name },
    });
  } catch (err) {
    console.error("[POST /api/auth/register-welcome]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
