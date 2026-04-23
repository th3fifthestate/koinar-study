// app/app/api/join/[token]/confirm/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getInviteCode, markVerificationVerified } from "@/lib/db/queries";
import { getDb } from "@/lib/db/connection";

const confirmSchema = z.object({
  code: z.string().length(6),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const body = await request.json();
    const parsed = confirmSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid code format" }, { status: 400 });
    }
    const { code } = parsed.data;

    const invite = getInviteCode(token);
    if (!invite || !invite.is_active || invite.used_by !== null) {
      return NextResponse.json({ error: "Invalid or expired invite" }, { status: 400 });
    }

    // Atomic: increment attempts and check code in a single transaction
    const db = getDb();
    const verification = db.transaction(() => {
      // Increment attempts on the latest unverified code for this invite
      db.prepare(
        `UPDATE email_verification_codes
         SET attempts = attempts + 1
         WHERE invite_code_id = ? AND verified = 0
           AND expires_at > datetime('now') AND attempts < 5`
      ).run(invite.id);

      // Now check if the code matches (with updated attempt count still under limit)
      return db
        .prepare(
          `SELECT * FROM email_verification_codes
           WHERE invite_code_id = ? AND code = ?
             AND verified = 0
             AND expires_at > datetime('now')
             AND attempts <= 5`
        )
        .get(invite.id, code) as import("@/lib/db/types").EmailVerificationCode | undefined;
    })();

    if (!verification) {
      return NextResponse.json({ error: "Invalid or expired code" }, { status: 400 });
    }

    markVerificationVerified(verification.id);

    // Get inviter display name for UX
    const inviter = getDb()
      .prepare("SELECT display_name, username FROM users WHERE id = ?")
      .get(invite.created_by) as { display_name: string | null; username: string } | undefined;
    const inviterName = inviter?.display_name ?? inviter?.username ?? "Someone";

    // Get study title
    const study = invite.linked_study_id
      ? (getDb()
          .prepare("SELECT title FROM studies WHERE id = ?")
          .get(invite.linked_study_id) as { title: string } | undefined)
      : null;

    return NextResponse.json({
      verified: true,
      inviterName,
      studyTitle: study?.title ?? null,
      inviteeName: invite.invitee_name,
      inviteeEmail: invite.invitee_email,
    });
  } catch (err) {
    console.error("[POST /api/join/[token]/confirm]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
