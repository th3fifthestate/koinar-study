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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const ids = (body as Record<string, unknown>)?.ids;

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

  // Shape response — exclude internal fields
  const shaped = entities.map((e) => ({
    id: e.id,
    entity_type: e.entity_type,
    canonical_name: e.canonical_name,
    aliases: e.aliases,
    quick_glance: e.quick_glance,
    summary: e.summary,
    hebrew_name: e.hebrew_name,
    greek_name: e.greek_name,
    disambiguation_note: e.disambiguation_note,
    date_range: e.date_range,
  }));
  return Response.json(shaped);
}
