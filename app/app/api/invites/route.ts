// app/app/api/invites/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { randomBytes } from "crypto";
import { requireAuth } from "@/lib/auth/middleware";
import { getInviteCountForUser, createInviteCode, getStudyById } from "@/lib/db/queries";
import { sendInviteEmail } from "@/lib/email/resend";
import { config } from "@/lib/config";
import { createRateLimiter } from "@/lib/rate-limit";
import { getDb } from "@/lib/db/connection";
import type { InviteCode } from "@/lib/db/types";
import { logger } from "@/lib/logger";

const createInviteSchema = z.object({
  inviteeName: z.string().min(2).max(100),
  inviteeEmail: z.string().email(),
  linkedStudyId: z.number().int().positive(),
});

// Per-user burst guard (30-day quota is enforced separately in handler below).
const isUserRateLimited = createRateLimiter({ windowMs: 60_000, max: 5 });

export async function POST(request: NextRequest) {
  const { user, response } = await requireAuth();
  if (response) return response;

  if (isUserRateLimited(`user-${user.userId}`)) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const parsed = createInviteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", fields: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const { inviteeName, inviteeEmail, linkedStudyId } = parsed.data;

    // Rate limit: non-admins get 2 per rolling 30 days
    if (!user.isAdmin) {
      const count = getInviteCountForUser(user.userId, 30);
      if (count >= 2) {
        return NextResponse.json(
          { error: "Invite limit reached. You can send 2 invites per 30 days." },
          { status: 429 }
        );
      }
    }

    const study = getStudyById(linkedStudyId);
    if (!study) {
      return NextResponse.json({ error: "Study not found" }, { status: 400 });
    }

    const token = randomBytes(24).toString("base64url");
    createInviteCode({
      code: token,
      created_by: user.userId,
      invitee_name: inviteeName,
      invitee_email: inviteeEmail,
      linked_study_id: linkedStudyId,
    });

    const inviteLink = `${config.app.url}/join/${token}`;

    // Get inviter display name
    const inviter = getDb()
      .prepare("SELECT display_name, username FROM users WHERE id = ?")
      .get(user.userId) as { display_name: string | null; username: string } | undefined;
    const inviterName = inviter?.display_name ?? inviter?.username ?? user.username;

    await sendInviteEmail({
      to: inviteeEmail,
      inviterName,
      inviteeName,
      studyTitle: study.title,
      inviteLink,
    });

    return NextResponse.json({ success: true, inviteLink });
  } catch (err) {
    logger.error({ route: "/api/invites", method: "POST", err }, "Invite create failed");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET() {
  const { user, response } = await requireAuth();
  if (response) return response;

  try {
    const invites = getDb()
      .prepare(
        `SELECT id, code, invitee_name, invitee_email, linked_study_id, is_active,
                used_at, created_at FROM invite_codes WHERE created_by = ?
         ORDER BY created_at DESC`
      )
      .all(user.userId) as Omit<InviteCode, "created_by" | "used_by">[];

    return NextResponse.json({ invites });
  } catch (err) {
    logger.error({ route: "/api/invites", method: "GET", err }, "Invite list failed");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
