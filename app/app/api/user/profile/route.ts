import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { updateUserProfile } from '@/lib/db/queries';
import { createRateLimiter } from '@/lib/rate-limit';
import { z } from 'zod';

const limiter = createRateLimiter({ windowMs: 60_000, max: 10 });

const schema = z.object({
  displayName: z.string().min(1).max(80),
  bio: z.string().max(280).default(''),
});

export async function PATCH(request: Request) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  if (limiter(`user-${auth.user.userId}`)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': '60' } });
  }

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 }
    );
  }

  const { displayName, bio } = parsed.data;
  updateUserProfile(auth.user.userId, {
    displayName,
    bio: bio === '' ? null : bio,
  });

  return NextResponse.json({ success: true });
}
