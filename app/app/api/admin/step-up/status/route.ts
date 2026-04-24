// app/app/api/admin/step-up/status/route.ts
//
// GET — report the admin's TOTP enrollment state and current step-up
// session expiry. Used by settings UI and by the generate page to decide
// whether to pre-show the step-up modal before the user clicks Generate.
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/middleware';
import { getDb } from '@/lib/db/connection';
import { getStepUpExpiry } from '@/lib/auth/step-up';

export async function GET() {
  const { user, response } = await requireAdmin();
  if (response) return response;

  const row = getDb()
    .prepare(
      `SELECT
         totp_enrolled_at,
         (SELECT COUNT(*) FROM admin_totp_backup_codes
           WHERE user_id = ? AND consumed_at IS NULL) AS unused_backup_codes
       FROM users WHERE id = ?`
    )
    .get(user.userId, user.userId) as
    | { totp_enrolled_at: string | null; unused_backup_codes: number }
    | undefined;

  return NextResponse.json({
    enrolled: !!row?.totp_enrolled_at,
    enrolledAt: row?.totp_enrolled_at ?? null,
    stepUpExpiresAt: getStepUpExpiry(user.userId),
    unusedBackupCodes: row?.unused_backup_codes ?? 0,
  });
}
