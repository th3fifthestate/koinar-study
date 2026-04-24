// app/app/api/admin/step-up/verify/route.ts
//
// POST — accept a 6-digit TOTP code OR a 20-hex backup code. On match,
// create (or refresh) a step-up session that lasts 30 minutes and unlocks
// /api/study/generate for admins using the platform Anthropic key.
//
// Rate limit: 5 attempts per admin per minute. 6-digit TOTP has 1M
// combinations; with ±30s drift (≈3 acceptable codes at any instant) the
// effective hit rate per attempt is ~3/1M ≈ 3e-6. 5 attempts/min → ~12k
// attempts/day → negligible brute-force risk.
//
// Backup codes have ~80 bits of entropy; an online attack is effectively
// ruled out by rate limit + input length.
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/middleware';
import { getDb } from '@/lib/db/connection';
import { verifyTotpCode, hashBackupCode } from '@/lib/auth/totp';
import {
  createStepUpSession,
  getStepUpExpiry,
} from '@/lib/auth/step-up';
import { logAdminAction } from '@/lib/admin/actions';
import { createRateLimiter } from '@/lib/rate-limit';

const isVerifyLimited = createRateLimiter({ windowMs: 60_000, max: 5 });

const bodySchema = z.object({
  code: z.string().min(6).max(40),
});

export async function POST(request: Request) {
  const { user, response } = await requireAdmin();
  if (response) return response;

  if (isVerifyLimited(`admin:${user.userId}`)) {
    return NextResponse.json(
      { error: 'Too many verification attempts. Try again in a minute.' },
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
  const rawCode = parsed.data.code.trim();

  const db = getDb();
  const row = db
    .prepare(
      'SELECT totp_secret, totp_enrolled_at FROM users WHERE id = ?'
    )
    .get(user.userId) as
    | { totp_secret: string | null; totp_enrolled_at: string | null }
    | undefined;

  if (!row || !row.totp_secret || !row.totp_enrolled_at) {
    // Generic 400 so an unenrolled admin sees the same shape as a bad code
    // (defense-in-depth against response-diffing probes).
    return NextResponse.json(
      {
        error: 'TOTP not enrolled',
        code: 'TOTP_NOT_ENROLLED',
      },
      { status: 400 }
    );
  }

  // Try 6-digit TOTP first. If the string isn't 6 digits, treat as backup
  // candidate. Backup codes are 20 hex chars, case-insensitive with optional
  // spaces/hyphens — hashBackupCode normalizes all of that.
  let method: 'totp' | 'backup' | null = null;

  if (/^\d{6}$/.test(rawCode)) {
    if (verifyTotpCode(rawCode, row.totp_secret)) {
      method = 'totp';
    }
  } else {
    const hash = hashBackupCode(rawCode);
    // Atomic: mark the code consumed only if it's currently unconsumed.
    // changes() = 1 means we won the race and can grant step-up.
    const result = db
      .prepare(
        `UPDATE admin_totp_backup_codes
         SET consumed_at = datetime('now')
         WHERE user_id = ? AND code_hash = ? AND consumed_at IS NULL`
      )
      .run(user.userId, hash);
    if (result.changes === 1) {
      method = 'backup';
    }
  }

  if (!method) {
    return NextResponse.json({ error: 'Invalid code' }, { status: 400 });
  }

  createStepUpSession(user.userId);
  const expiresAt = getStepUpExpiry(user.userId);

  logAdminAction({
    adminId: user.userId,
    actionType: 'step_up_verify',
    targetType: 'user',
    targetId: user.userId,
    details: { method },
  });

  return NextResponse.json({
    success: true,
    method,
    expiresAt,
  });
}
