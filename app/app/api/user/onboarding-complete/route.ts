import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { getDb } from '@/lib/db/connection';
import { getSession } from '@/lib/auth/session';

export async function POST() {
  const { user, response } = await requireAuth();
  if (response) return response;

  try {
    getDb()
      .prepare('UPDATE users SET onboarding_completed = 1 WHERE id = ?')
      .run(user.userId);

    const session = await getSession();
    session.onboardingCompleted = true;
    await session.save();

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[POST /api/user/onboarding-complete]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
