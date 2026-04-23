import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { getUserForAuthById, updateUserPassword, deleteUserSessions } from '@/lib/db/queries';
import { verifyPassword, hashPassword } from '@/lib/auth/password';
import { getSession } from '@/lib/auth/session';
import { createRateLimiter } from '@/lib/rate-limit';
import { z } from 'zod';

// 3 per 10 minutes per user — matches brief rate-limit spec
const limiter = createRateLimiter({ windowMs: 10 * 60_000, max: 3 });

// min(8) mirrors register/route.ts Zod schema exactly — keep in sync if register changes
const schema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

export async function PATCH(request: Request) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  if (limiter(`user-${auth.user.userId}`)) {
    return NextResponse.json(
      { error: 'Too many requests. Try again in 10 minutes.' },
      { status: 429, headers: { 'Retry-After': '600' } }
    );
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

  const { currentPassword, newPassword } = parsed.data;

  let userRow: ReturnType<typeof getUserForAuthById>;
  try {
    userRow = getUserForAuthById(auth.user.userId);
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }

  if (!userRow) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const valid = await verifyPassword(userRow.password_hash, currentPassword);
  if (!valid) {
    return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 });
  }

  const newHash = await hashPassword(newPassword);

  try {
    updateUserPassword(auth.user.userId, newHash);
    deleteUserSessions(auth.user.userId);
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }

  // Belt-and-suspenders: invalidate iron-session cookie server-side
  const session = await getSession();
  await session.destroy();

  console.info(`[security] password changed for userId=${auth.user.userId}`);
  return NextResponse.json({ success: true });
}
