// app/app/api/admin/totp/enroll/route.ts
//
// POST — start TOTP enrollment for an admin. Generates a base32 secret,
// stores it on users.totp_secret with totp_enrolled_at NULL (meaning
// "pending confirmation"), and returns a QR data URL + URI for display.
// The admin scans the QR in their authenticator app, then posts a freshly
// generated 6-digit code to /enroll/confirm to finalize.
//
// Design:
//   - requireAdmin only (no step-up) — first enrollment is the chicken-
//     and-egg case. We DO block re-enrollment once totp_enrolled_at is
//     set: if the admin wants to re-pair their authenticator, they use
//     the Railway SSH reset script (scripts/admin-reset-totp.ts).
//   - Persisting the secret pre-confirmation is safe because step-up
//     won't activate until /enroll/confirm sets totp_enrolled_at AND
//     generates backup codes. An abandoned enrollment leaves a dead
//     secret that gets overwritten on the next /enroll call.
//   - Rate-limited at 5/min per admin — enrollment is cheap but we don't
//     want a runaway client thrashing the table.
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/middleware';
import { getDb } from '@/lib/db/connection';
import {
  generateTotpSecret,
  buildProvisioningUri,
  buildProvisioningQr,
} from '@/lib/auth/totp';
import { logAdminAction } from '@/lib/admin/actions';
import { createRateLimiter } from '@/lib/rate-limit';

const isEnrollLimited = createRateLimiter({ windowMs: 60_000, max: 5 });

export async function POST() {
  const { user, response } = await requireAdmin();
  if (response) return response;

  if (isEnrollLimited(`admin:${user.userId}`)) {
    return NextResponse.json(
      { error: 'Too many enrollment attempts. Try again in a minute.' },
      { status: 429, headers: { 'Retry-After': '60' } }
    );
  }

  const db = getDb();

  // Block re-enrollment on a confirmed TOTP. If the admin has lost their
  // authenticator, they use scripts/admin-reset-totp.ts over Railway SSH.
  const row = db
    .prepare('SELECT totp_enrolled_at FROM users WHERE id = ?')
    .get(user.userId) as { totp_enrolled_at: string | null } | undefined;

  if (!row) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }
  if (row.totp_enrolled_at) {
    return NextResponse.json(
      {
        error: 'TOTP already enrolled',
        message:
          'Your admin account already has TOTP configured. Use Railway SSH to reset if needed.',
      },
      { status: 409 }
    );
  }

  const secret = generateTotpSecret();
  const uri = buildProvisioningUri(user.username, secret);
  const qrDataUrl = await buildProvisioningQr(uri);

  // Write the pending secret. enrolled_at stays NULL until /confirm verifies
  // a code. The UI must proceed to /confirm or the secret is dead on arrival.
  db
    .prepare(
      'UPDATE users SET totp_secret = ?, totp_enrolled_at = NULL WHERE id = ?'
    )
    .run(secret, user.userId);

  logAdminAction({
    adminId: user.userId,
    actionType: 'totp_enroll_start',
    targetType: 'user',
    targetId: user.userId,
  });

  // Return the URI so password managers that prefer text-paste over QR can
  // still onboard. QR is the primary path for mobile authenticators.
  return NextResponse.json({ qrDataUrl, uri });
}
