import { requireAuth } from '@/lib/auth/middleware';
import { createRateLimiter, getClientIp } from '@/lib/rate-limit';
import { searchEntities } from '@/lib/db/entities/queries';

const isRateLimited = createRateLimiter({ windowMs: 60_000, max: 30 });

export async function GET(request: Request) {
  const { response } = await requireAuth();
  if (response) return response;

  const ip = getClientIp(request);
  if (isRateLimited(ip)) {
    return Response.json({ error: 'Too many requests' }, { status: 429 });
  }

  const url = new URL(request.url);
  const q = url.searchParams.get('q')?.trim();
  if (!q) {
    return Response.json({ error: 'Query parameter q is required' }, { status: 400 });
  }

  const type = url.searchParams.get('type') || undefined;
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10) || 20, 50);

  const entities = searchEntities(q, type, limit);
  return Response.json(entities);
}
