// app/app/api/studies/[id]/annotations/route.ts
import { requireAuth } from '@/lib/auth/middleware';
import { getAnnotationsForStudy, createAnnotation, studyIsAccessible } from '@/lib/db/queries';
import { broadcastAnnotationCreated } from '@/lib/ws/broadcaster';
import { createRateLimiter, getClientIp } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';
import type { AnnotationColor } from '@/lib/db/types';

// 60 reads per minute per IP
const isGetRateLimited = createRateLimiter({ windowMs: 60_000, max: 60 });
// 30 creates per minute per IP
const isPostRateLimited = createRateLimiter({ windowMs: 60_000, max: 30 });
// 30 creates per minute per authenticated user — defends against IP rotation
const isPostUserRateLimited = createRateLimiter({ windowMs: 60_000, max: 30 });

const VALID_COLORS: AnnotationColor[] = ['yellow', 'green', 'blue', 'pink', 'purple'];
const VALID_TYPES = ['highlight', 'note'] as const;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ip = getClientIp(request);
  if (isGetRateLimited(ip)) {
    return Response.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': '60' } });
  }

  const { user, response } = await requireAuth();
  if (response) return response;

  const { id } = await params;
  const studyId = parseInt(id, 10);
  if (isNaN(studyId) || studyId <= 0) {
    return Response.json({ error: 'Invalid study ID' }, { status: 400 });
  }

  if (!studyIsAccessible(studyId, user.userId)) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const annotations = getAnnotationsForStudy(studyId, user.userId);
    return Response.json({ annotations });
  } catch (error) {
    logger.error({ route: '/api/studies/[id]/annotations', method: 'GET', studyId, userId: user.userId, err: error }, 'Annotation list failed');
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ip = getClientIp(request);
  if (isPostRateLimited(ip)) {
    return Response.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': '60' } });
  }

  const { user, response } = await requireAuth();
  if (response) return response;

  if (isPostUserRateLimited(`user-${user.userId}`)) {
    return Response.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': '60' } });
  }

  const { id } = await params;
  const studyId = parseInt(id, 10);
  if (isNaN(studyId) || studyId <= 0) {
    return Response.json({ error: 'Invalid study ID' }, { status: 400 });
  }

  if (!studyIsAccessible(studyId, user.userId)) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return Response.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const { type, color, start_offset, end_offset, selected_text, note_text, is_public } = b;

  // Validate type
  if (!type || !VALID_TYPES.includes(type as (typeof VALID_TYPES)[number])) {
    return Response.json({ error: 'type must be "highlight" or "note"' }, { status: 400 });
  }

  // Resolve color (default to yellow if invalid/missing)
  const resolvedColor: AnnotationColor = VALID_COLORS.includes(color as AnnotationColor)
    ? (color as AnnotationColor)
    : 'yellow';

  // Validate offsets
  if (
    typeof start_offset !== 'number' ||
    typeof end_offset !== 'number' ||
    !Number.isInteger(start_offset) ||
    !Number.isInteger(end_offset) ||
    start_offset < 0 ||
    end_offset <= start_offset
  ) {
    return Response.json({ error: 'Invalid offsets: start_offset and end_offset must be numbers with end > start' }, { status: 400 });
  }

  // Validate selected_text
  if (typeof selected_text !== 'string' || selected_text.trim().length === 0) {
    return Response.json({ error: 'selected_text is required' }, { status: 400 });
  }
  if (selected_text.length > 2000) {
    return Response.json({ error: 'selected_text too long (max 2000 chars)' }, { status: 400 });
  }

  // Validate note_text for note type
  if (type === 'note') {
    if (typeof note_text !== 'string' || note_text.trim().length === 0) {
      return Response.json({ error: 'note_text is required for type "note"' }, { status: 400 });
    }
    if (note_text.length > 5000) {
      return Response.json({ error: 'note_text too long (max 5000 chars)' }, { status: 400 });
    }
  }

  try {
    const annotation = createAnnotation({
      studyId,
      userId: user.userId,
      type: type as 'highlight' | 'note',
      color: resolvedColor,
      startOffset: start_offset as number,
      endOffset: end_offset as number,
      selectedText: selected_text.trim(),
      noteText: type === 'note' ? (note_text as string).trim() : null,
      isPublic: is_public === true,
    });

    // Broadcast to the study room if annotation is public.
    // Set is_own: false for broadcast — recipients are other users.
    // The creator already has the annotation from this REST response with is_own: true.
    if (annotation.is_public) {
      broadcastAnnotationCreated(studyId, { ...annotation, is_own: false });
    }

    return Response.json({ annotation }, { status: 201 });
  } catch (error) {
    logger.error({ route: '/api/studies/[id]/annotations', method: 'POST', studyId, userId: user.userId, err: error }, 'Annotation create failed');
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
