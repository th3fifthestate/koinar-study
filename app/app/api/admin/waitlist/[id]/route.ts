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
import { createRateLimiter } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

// Per-admin throttle. Approve path sends email; deny path is cheap. Cap
// tightened relative to the generic admin bucket because each approve
// triggers a transactional email. User-keyed.
const isMutationLimited = createRateLimiter({ windowMs: 60_000, max: 20 });

const schema = z.object({
  action: z.enum(["approve", "deny"]),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, response } = await requireAdmin();
  if (response) return response;

  if (isMutationLimited(`admin:${user.userId}`)) {
    return NextResponse.json(
      { error: "Too many requests. Try again in a minute." },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  try {
    const { id } = await params;
    const entryId = parseInt(id, 10);
    if (isNaN(entryId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
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
    logger.error(
      { route: "/api/admin/waitlist/[id]", userId: user.userId, err },
      "Waitlist PATCH failed"
    );
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
