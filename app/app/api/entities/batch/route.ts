import { requireAuth } from '@/lib/auth/middleware';
import { createRateLimiter, getClientIp } from '@/lib/rate-limit';
import { getEntitiesByIds } from '@/lib/db/entities/queries';

const isRateLimited = createRateLimiter({ windowMs: 60_000, max: 30 });

export async function POST(request: Request) {
  const { response } = await requireAuth();
  if (response) return response;

  const ip = getClientIp(request);
  if (isRateLimited(ip)) {
    return Response.json({ error: 'Too many requests' }, { status: 429 });
  }

  const body = await request.json();
  const ids = body?.ids;

  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 50) {
    return Response.json(
      { error: 'ids must be an array of 1-50 strings' },
      { status: 400 }
    );
  }

  if (!ids.every((id: unknown) => typeof id === 'string')) {
    return Response.json({ error: 'All ids must be strings' }, { status: 400 });
  }

  const entities = getEntitiesByIds(ids);
  return Response.json(entities);
}
