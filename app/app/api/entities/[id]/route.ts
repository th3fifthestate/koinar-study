import { requireAuth } from '@/lib/auth/middleware';
import { createRateLimiter, getClientIp } from '@/lib/rate-limit';
import { getEntityDetail } from '@/lib/db/entities/queries';

const isRateLimited = createRateLimiter({ windowMs: 60_000, max: 60 });

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { response } = await requireAuth();
  if (response) return response;

  const ip = getClientIp(request);
  if (isRateLimited(ip)) {
    return Response.json({ error: 'Too many requests' }, { status: 429 });
  }

  const { id } = await params;
  if (!id || typeof id !== 'string') {
    return Response.json({ error: 'Invalid entity ID' }, { status: 400 });
  }

  const entity = getEntityDetail(id);
  if (!entity) {
    return Response.json({ error: 'Entity not found' }, { status: 404 });
  }

  return Response.json(entity);
}
