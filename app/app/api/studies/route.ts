// app/app/api/studies/route.ts
import { NextRequest } from 'next/server';
import { getStudies } from '@/lib/db/queries';
import { getSession } from '@/lib/auth/session';
import { createRateLimiter, getClientIp } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

// 30 requests per minute per IP (browsing/pagination)
const isRateLimited = createRateLimiter({ windowMs: 60_000, max: 30 });

export async function GET(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    if (isRateLimited(ip)) {
      return Response.json(
        { error: 'Too many requests' },
        { status: 429, headers: { 'Retry-After': '60' } }
      );
    }
    const url = request.nextUrl;
    const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') ?? '24', 10) || 24));
    const category = url.searchParams.get('category') ?? undefined;
    const q = url.searchParams.get('q') ?? undefined;
    const sort = url.searchParams.get('sort') ?? 'newest';
    const format_type = url.searchParams.get('format_type') ?? undefined;
    const favoritesOnly = url.searchParams.get('favorites') === 'true';

    const validSorts = ['newest', 'oldest', 'popular'] as const;
    const sortValue = validSorts.includes(sort as typeof validSorts[number])
      ? (sort as typeof validSorts[number])
      : 'newest';

    let userId: number | undefined;
    if (favoritesOnly) {
      const session = await getSession();
      if (!session.userId) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
      }
      userId = session.userId;
    }

    const result = getStudies({
      page,
      limit,
      category,
      q,
      sort: sortValue,
      format_type,
      userId: favoritesOnly ? userId : undefined,
      favoritesOfUserId: favoritesOnly ? userId : undefined,
    });
    return Response.json({ studies: result.studies, totalCount: result.totalCount, page, limit });
  } catch (error) {
    logger.error({ route: '/api/studies', method: 'GET', err: error }, 'Studies list failed');
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
