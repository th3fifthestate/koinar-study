// app/app/api/admin/waitlist/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { randomBytes } from "crypto";
import { requireAdmin } from "@/lib/auth/middleware";
import { approveWaitlistEntry, denyWaitlistEntry } from "@/lib/db/queries";
import { sendApprovalEmail } from "@/lib/email/resend";
import { config } from "@/lib/config";
import { getDb } from "@/lib/db/connection";
import { logAdminAction } from "@/lib/admin/actions";
import type { WaitlistEntry } from "@/lib/db/types";

const schema = z.object({
  action: z.enum(["approve", "deny"]),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, response } = await requireAdmin();
  if (response) return response;

  try {
    const { id } = await params;
    const entryId = parseInt(id, 10);
    if (isNaN(entryId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "action must be 'approve' or 'deny'" }, { status: 400 });
    }
    const { action } = parsed.data;

    const entry = getDb()
      .prepare("SELECT * FROM waitlist WHERE id = ?")
      .get(entryId) as WaitlistEntry | undefined;
    if (!entry) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    if (action === "approve") {
      const approvalToken = randomBytes(24).toString("base64url");
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      approveWaitlistEntry(entryId, user.userId, approvalToken, expiresAt);

      const registrationLink = `${config.app.url}/welcome/${approvalToken}`;
      await sendApprovalEmail({
        to: entry.email,
        name: entry.name,
        registrationLink,
      });

      logAdminAction({
        adminId: user.userId,
        actionType: 'approve_waitlist',
        targetType: 'waitlist',
        targetId: entryId,
      });

      return NextResponse.json({ success: true, action: "approved" });
    } else {
      denyWaitlistEntry(entryId, user.userId);

      logAdminAction({
        adminId: user.userId,
        actionType: 'deny_waitlist',
        targetType: 'waitlist',
        targetId: entryId,
      });

      return NextResponse.json({ success: true, action: "denied" });
    }
  } catch (err) {
    console.error("[PATCH /api/admin/waitlist/[id]]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
