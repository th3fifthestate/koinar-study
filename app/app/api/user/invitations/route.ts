import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { listUserInvitations } from '@/lib/db/queries';
import { createRateLimiter } from '@/lib/rate-limit';

const limiter = createRateLimiter({ windowMs: 60_000, max: 30 });

export async function GET() {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  if (limiter(`user-${auth.user.userId}`)) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': '60' } }
    );
  }

  try {
    const invitations = listUserInvitations(auth.user.userId);
    return NextResponse.json({ invitations });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
