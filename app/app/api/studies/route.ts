// app/app/api/studies/route.ts
import { NextRequest } from 'next/server';
import { getStudies, getUserFavorites } from '@/lib/db/queries';
import { getSession } from '@/lib/auth/session';

export async function GET(request: NextRequest) {
  try {
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

    if (favoritesOnly && userId) {
      // Get all favorited study IDs, then fetch matching studies and filter
      // TODO: Add studyIds filter to getStudies() for proper DB-level filtering
      const favStudies = getUserFavorites(userId);
      const favIds = new Set(favStudies.map((s) => s.id));
      const result = getStudies({
        page: 1,
        limit: 50,
        category,
        q,
        sort: sortValue,
        format_type,
        userId,
      });
      const filtered = result.studies.filter((s) => favIds.has(s.id));
      const totalCount = filtered.length;
      const start = (page - 1) * limit;
      const paged = filtered.slice(start, start + limit);
      return Response.json({ studies: paged, totalCount, page, limit });
    }

    const result = getStudies({ page, limit, category, q, sort: sortValue, format_type });
    return Response.json({ studies: result.studies, totalCount: result.totalCount, page, limit });
  } catch (error) {
    console.error('[GET /api/studies]', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
