import { z } from 'zod';
import { requireAuth } from '@/lib/auth/middleware';
import { getStudyForTranslate, updateStudyTranslation } from '@/lib/db/queries';
import { swapVerses } from '@/lib/translations/swap-engine';
import { getAvailableTranslations } from '@/lib/translations/registry';
import type { TranslationId } from '@/lib/translations/registry';
import { createRateLimiter } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

const BodySchema = z.object({
  translation: z.enum(['BSB', 'KJV', 'WEB', 'NLT', 'NIV', 'NASB', 'ESV'] as const),
});

// CLAUDE.md §5: rate-limit public endpoints. Translation invokes upstream
// api.bible / ESV calls, so we key per-user to cap abuse and control spend.
const isTranslateRateLimited = createRateLimiter({ windowMs: 60_000, max: 10 });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, response } = await requireAuth();
  if (response) return response;

  if (isTranslateRateLimited(`u:${user.userId}`)) {
    return Response.json({ error: 'Too many requests' }, { status: 429 });
  }

  const { id } = await params;
  const studyId = parseInt(id, 10);
  if (isNaN(studyId) || studyId <= 0) {
    return Response.json({ error: 'Invalid study ID' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: 'Invalid translation' }, { status: 400 });
  }
  const { translation } = parsed.data;

  const available = getAvailableTranslations().map((t) => t.id);
  if (!available.includes(translation as TranslationId)) {
    return Response.json({ error: 'Translation not available' }, { status: 400 });
  }

  const study = getStudyForTranslate(studyId);
  if (!study) {
    return Response.json({ error: 'Study not found' }, { status: 404 });
  }
  if (!study.is_public && study.created_by !== user.userId) {
    return Response.json({ error: 'Access denied' }, { status: 403 });
  }

  const source = study.original_content;
  if (!source) {
    return Response.json({ error: 'Study source content unavailable' }, { status: 500 });
  }

  let swapResult;
  try {
    swapResult = await swapVerses(source, translation as TranslationId, {
      studyId,
      userId: user.userId,
      sessionId: user.sessionId ?? null,
    });
  } catch (err) {
    logger.error({ route: '/api/studies/[id]/translate', method: 'POST', studyId, translation, userId: user.userId, err }, 'Translation swap failed');
    return Response.json({ error: 'Translation service error' }, { status: 502 });
  }

  // If every verse fetch failed with a deterministic reason, surface it so the
  // UI can transition rows to 'unavailable' rather than just showing a toast.
  if (swapResult.failureReason && swapResult.versesSwapped === 0) {
    return Response.json({ error: swapResult.failureReason }, { status: 422 });
  }

  try {
    updateStudyTranslation(studyId, translation);
  } catch (persistErr) {
    logger.error({ route: '/api/studies/[id]/translate', method: 'POST', studyId, translation, userId: user.userId, err: persistErr }, 'Translation persist failed (swap still returned)');
    // Swap succeeded — return content even if persistence failed
  }

  // CLAUDE.md §3: Never return fums_token, original_content, or internal IDs
  return Response.json({
    content: swapResult.content,
    versesSwapped: swapResult.versesSwapped,
    missingVerses: swapResult.missingVerses,
    truncated: swapResult.truncated,
    translation,
    ...(swapResult.failureReason ? { failureReason: swapResult.failureReason } : {}),
  });
}
