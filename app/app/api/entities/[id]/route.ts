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

  // Shape response — exclude internal fields
  return Response.json({
    id: entity.id,
    entity_type: entity.entity_type,
    canonical_name: entity.canonical_name,
    aliases: entity.aliases,
    quick_glance: entity.quick_glance,
    summary: entity.summary,
    full_profile: entity.full_profile,
    hebrew_name: entity.hebrew_name,
    greek_name: entity.greek_name,
    disambiguation_note: entity.disambiguation_note,
    date_range: entity.date_range,
    geographic_context: entity.geographic_context,
    verse_refs: entity.verse_refs.map((ref) => ({
      book: ref.book,
      chapter: ref.chapter,
      verse_start: ref.verse_start,
      verse_end: ref.verse_end,
      confidence: ref.confidence,
    })),
    citations: entity.citations.map((c) => ({
      source_name: c.source_name,
      source_ref: c.source_ref,
      source_url: c.source_url,
      content_field: c.content_field,
    })),
    relationships: entity.relationships.map((rel) => ({
      from_entity_id: rel.from_entity_id,
      to_entity_id: rel.to_entity_id,
      relationship_type: rel.relationship_type,
      relationship_label: rel.relationship_label,
      related_entity_name: rel.related_entity_name,
      related_entity_type: rel.related_entity_type,
    })),
  });
}
