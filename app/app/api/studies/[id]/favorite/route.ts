// app/app/api/studies/[id]/favorite/route.ts
import { requireAuth } from '@/lib/auth/middleware';
import { toggleFavorite, getStudyFavoriteCount } from '@/lib/db/queries';
import { createRateLimiter, getClientIp } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

// 20 favorite toggles per minute per IP
const isRateLimited = createRateLimiter({ windowMs: 60_000, max: 20 });
// 20 per minute per authenticated user — defends against IP rotation
const isUserRateLimited = createRateLimiter({ windowMs: 60_000, max: 20 });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ip = getClientIp(request);
  if (isRateLimited(ip)) {
    return Response.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': '60' } }
    );
  }

  const { user, response } = await requireAuth();
  if (response) return response;

  if (isUserRateLimited(`user-${user.userId}`)) {
    return Response.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': '60' } }
    );
  }

  const { id } = await params;
  const studyId = parseInt(id, 10);
  if (isNaN(studyId) || studyId <= 0) {
    return Response.json({ error: 'Invalid study ID' }, { status: 400 });
  }

  try {
    const favorited = toggleFavorite(user.userId, studyId);
    const favorite_count = getStudyFavoriteCount(studyId);
    return Response.json({ favorited, favorite_count });
  } catch (error) {
    logger.error({ route: '/api/studies/[id]/favorite', method: 'POST', studyId, userId: user.userId, err: error }, 'Favorite toggle failed');
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
