// app/app/api/admin/gift-codes/[id]/notify/route.ts
//
// Admin-triggered "your credits are ready" email for a user-pinned gift
// code. The code itself is already linked to the recipient, so the email
// is informational — no redemption step for the user, just a link to
// /generate. We intentionally do NOT include the raw code string in the
// email body (see rationale in sendGiftCodeNotification).
//
// Rate-limiting: 10 notifications per admin per 5 minutes. Keeps an
// impatient admin from spamming the same user, and keeps a compromised
// admin account from becoming an email cannon.
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/middleware';
import { getDb } from '@/lib/db/connection';
import { logAdminAction } from '@/lib/admin/actions';
import { sendGiftCodeNotification } from '@/lib/email/resend';
import { config } from '@/lib/config';
import { createRateLimiter } from '@/lib/rate-limit';

const isRateLimited = createRateLimiter({ windowMs: 300_000, max: 10 });

const FORMAT_LABELS: Record<string, string> = {
  simple: 'Simple',
  standard: 'Standard',
  comprehensive: 'Comprehensive',
};

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, response } = await requireAdmin();
  if (response) return response;

  // Per-admin throttle (userId used as the bucket key since this endpoint
  // is admin-only and behind auth; IP would conflate multiple admins on
  // one corporate NAT).
  if (isRateLimited(`admin:${user.userId}`)) {
    return NextResponse.json(
      { error: 'Too many notifications. Try again in a few minutes.' },
      { status: 429, headers: { 'Retry-After': '300' } }
    );
  }

  const { id } = await params;
  const codeId = parseInt(id, 10);
  if (isNaN(codeId)) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  }

  const db = getDb();
  const row = db
    .prepare(
      `SELECT gc.format_locked, gc.uses_remaining, gc.expires_at,
              u.email, u.display_name, u.username
         FROM study_gift_codes gc
         JOIN users u ON u.id = gc.user_id
        WHERE gc.id = ?`
    )
    .get(codeId) as {
    format_locked: string;
    uses_remaining: number;
    expires_at: string | null;
    email: string;
    display_name: string | null;
    username: string;
  } | undefined;

  if (!row) {
    return NextResponse.json({ error: 'Gift code not found' }, { status: 404 });
  }

  // Guard against notifying a recipient who can't actually use the credits.
  if (row.uses_remaining === 0) {
    return NextResponse.json(
      { error: 'No credits remain on this code' },
      { status: 409 }
    );
  }
  if (row.expires_at && new Date(row.expires_at) < new Date()) {
    return NextResponse.json(
      { error: 'This code has expired' },
      { status: 409 }
    );
  }

  const formatLabel = FORMAT_LABELS[row.format_locked] ?? row.format_locked;
  const displayName = row.display_name ?? row.username;
  const generateLink = `${config.app.url.replace(/\/$/, '')}/generate`;

  try {
    await sendGiftCodeNotification({
      to: row.email,
      displayName,
      formatLabel,
      credits: row.uses_remaining,
      generateLink,
    });
  } catch (err) {
    console.error('[admin gift-code notify] email send failed', err);
    return NextResponse.json(
      { error: 'Failed to send notification email' },
      { status: 502 }
    );
  }

  logAdminAction({
    adminId: user.userId,
    actionType: 'notify_gift_code_recipient',
    targetType: 'gift_code',
    targetId: codeId,
    details: {
      recipient_username: row.username,
      format_locked: row.format_locked,
      credits: row.uses_remaining,
    },
  });

  return NextResponse.json({ success: true });
}
