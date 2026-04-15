// app/app/api/studies/[id]/annotations/[annotationId]/route.ts
import { requireAuth } from '@/lib/auth/middleware';
import { getAnnotationForOwner, deleteAnnotation } from '@/lib/db/queries';
import { broadcastAnnotationDeleted } from '@/lib/ws/broadcaster';
import { createRateLimiter, getClientIp } from '@/lib/rate-limit';

// 30 deletes per minute per IP
const isRateLimited = createRateLimiter({ windowMs: 60_000, max: 30 });

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; annotationId: string }> }
) {
  const ip = getClientIp(request);
  if (isRateLimited(ip)) {
    return Response.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': '60' } });
  }

  const { user, response } = await requireAuth();
  if (response) return response;

  const { id, annotationId } = await params;
  const studyId = parseInt(id, 10);
  const annId = parseInt(annotationId, 10);

  if (isNaN(studyId) || studyId <= 0 || isNaN(annId) || annId <= 0) {
    return Response.json({ error: 'Invalid ID' }, { status: 400 });
  }

  // Verify ownership — users can only delete their own annotations.
  // Returns 404 regardless of whether annotation exists (don't leak existence).
  const annotation = getAnnotationForOwner(annId, user.userId, studyId);
  if (!annotation) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const wasPublic = annotation.is_public === 1;
    deleteAnnotation(annId);

    // Broadcast deletion to the study room if the annotation was public
    if (wasPublic) {
      broadcastAnnotationDeleted(studyId, annId);
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error('[DELETE /api/studies/[id]/annotations/[annotationId]]', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
