// app/app/api/admin/totp/enroll/confirm/route.ts
//
// POST — finalize TOTP enrollment by verifying a code the admin entered
// against the pending secret written by /enroll. On success, sets
// totp_enrolled_at, generates 10 one-time backup codes, and returns the
// codes ONCE (they are never retrievable again — admin must save them).
//
// Rate-limited at 10/min per admin. Code is 6 digits (1M combinations)
// and each failed attempt burns a bit of entropy, but the secret is fresh
// and gets rotated on successful confirm. Worst case: an attacker who
// compromised the session window between /enroll and /confirm could
// attempt brute force, but the ±30s drift window keeps the effective key
// space at ~1M — unreachable under rate limit.
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/middleware';
import { getDb } from '@/lib/db/connection';
import {
  verifyTotpCode,
  generateBackupCodes,
} from '@/lib/auth/totp';
import { logAdminAction } from '@/lib/admin/actions';
import { createRateLimiter } from '@/lib/rate-limit';

const isConfirmLimited = createRateLimiter({ windowMs: 60_000, max: 10 });

const bodySchema = z.object({
  code: z.string().length(6),
});

export async function POST(request: Request) {
  const { user, response } = await requireAdmin();
  if (response) return response;

  if (isConfirmLimited(`admin:${user.userId}`)) {
    return NextResponse.json(
      { error: 'Too many attempts. Try again in a minute.' },
      { status: 429, headers: { 'Retry-After': '60' } }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid code format' }, { status: 400 });
  }
  const { code } = parsed.data;

  const db = getDb();
  const row = db
    .prepare(
      'SELECT totp_secret, totp_enrolled_at FROM users WHERE id = ?'
    )
    .get(user.userId) as
    | { totp_secret: string | null; totp_enrolled_at: string | null }
    | undefined;

  if (!row) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }
  if (!row.totp_secret) {
    return NextResponse.json(
      { error: 'No pending enrollment — call /enroll first' },
      { status: 400 }
    );
  }
  if (row.totp_enrolled_at) {
    return NextResponse.json(
      { error: 'TOTP already enrolled' },
      { status: 409 }
    );
  }

  if (!verifyTotpCode(code, row.totp_secret)) {
    return NextResponse.json({ error: 'Invalid code' }, { status: 400 });
  }

  // Code valid — flip enrolled_at and mint backup codes in one transaction.
  const { codes, hashes } = generateBackupCodes(10);

  db.transaction(() => {
    db.prepare(
      "UPDATE users SET totp_enrolled_at = datetime('now') WHERE id = ?"
    ).run(user.userId);
    // Fresh enrollment — clear any prior backup codes (defensive; only
    // matters if a reset script missed this table).
    db.prepare(
      'DELETE FROM admin_totp_backup_codes WHERE user_id = ?'
    ).run(user.userId);
    const insert = db.prepare(
      'INSERT INTO admin_totp_backup_codes (user_id, code_hash) VALUES (?, ?)'
    );
    for (const hash of hashes) {
      insert.run(user.userId, hash);
    }
  })();

  logAdminAction({
    adminId: user.userId,
    actionType: 'totp_enroll_confirm',
    targetType: 'user',
    targetId: user.userId,
  });

  // Codes are returned ONCE. UI must show them and nudge the admin to save
  // them (password manager, printed in a safe, etc.) before dismissing.
  return NextResponse.json({ success: true, backupCodes: codes });
}
