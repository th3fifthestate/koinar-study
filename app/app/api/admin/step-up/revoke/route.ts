// app/app/api/admin/step-up/revoke/route.ts
//
// POST — revoke the admin's active step-up session. Used by the "Lock admin
// mode" button in settings / when the admin walks away from their laptop.
// Idempotent: no-op if no session exists.
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/middleware';
import { revokeStepUpSession } from '@/lib/auth/step-up';
import { logAdminAction } from '@/lib/admin/actions';
import { createRateLimiter } from '@/lib/rate-limit';

// Cheap op — generous ceiling just to block accidental loops.
const isRevokeLimited = createRateLimiter({ windowMs: 60_000, max: 20 });

export async function POST() {
  const { user, response } = await requireAdmin();
  if (response) return response;

  if (isRevokeLimited(`admin:${user.userId}`)) {
    return NextResponse.json(
      { error: 'Too many requests.' },
      { status: 429, headers: { 'Retry-After': '60' } }
    );
  }

  revokeStepUpSession(user.userId);

  logAdminAction({
    adminId: user.userId,
    actionType: 'step_up_revoke',
    targetType: 'user',
    targetId: user.userId,
  });

  return NextResponse.json({ success: true });
}
