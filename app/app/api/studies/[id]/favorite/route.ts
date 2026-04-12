// app/app/api/studies/[id]/favorite/route.ts
import { requireAuth } from '@/lib/auth/middleware';
import { toggleFavorite, getStudyFavoriteCount } from '@/lib/db/queries';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, response } = await requireAuth();
  if (response) return response;

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
    console.error('[POST /api/studies/favorite]', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
