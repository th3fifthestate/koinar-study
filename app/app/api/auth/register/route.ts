// app/app/api/auth/register/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { randomBytes } from "crypto";
import { getInviteCode, getUserByEmail, getUserByUsername, createUser, markInviteCodeUsed } from "@/lib/db/queries";
import { hashPassword } from "@/lib/auth/password";
import { getSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/connection";

const registerSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8),
  inviteToken: z.string().length(32),
});

function generateUsername(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", fields: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const { name, email, password, inviteToken } = parsed.data;

    const invite = getInviteCode(inviteToken);
    if (!invite || !invite.is_active || invite.used_by !== null) {
      return NextResponse.json({ error: "Invalid or expired invite" }, { status: 400 });
    }

    // Check email verification completed
    const verified = getDb()
      .prepare(
        `SELECT id FROM email_verification_codes
         WHERE invite_code_id = ? AND verified = 1`
      )
      .get(invite.id);
    if (!verified) {
      return NextResponse.json({ error: "Email verification not completed" }, { status: 400 });
    }

    if (invite.invitee_email.toLowerCase() !== email.toLowerCase()) {
      return NextResponse.json({ error: "Invalid or expired invite" }, { status: 400 });
    }

    const existing = getUserByEmail(email);
    if (existing) {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    }

    // Generate unique username
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
      display_name: invite.invitee_name,
      invited_by: invite.created_by,
      is_approved: 1,
    });

    markInviteCodeUsed(inviteToken, userId);

    const session = await getSession();
    session.userId = userId;
    session.username = username;
    session.isAdmin = false;
    session.isApproved = true;
    await session.save();

    return NextResponse.json({
      success: true,
      user: { id: userId, username, displayName: invite.invitee_name },
    });
  } catch (err) {
    console.error("[POST /api/auth/register]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
