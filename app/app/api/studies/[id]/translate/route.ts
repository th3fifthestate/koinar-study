import { z } from 'zod';
import { requireAuth } from '@/lib/auth/middleware';
import { getStudyForTranslate, updateStudyTranslation } from '@/lib/db/queries';
import { swapVerses } from '@/lib/translations/swap-engine';
import { getAvailableTranslations } from '@/lib/translations/registry';
import type { TranslationId } from '@/lib/translations/registry';

const BodySchema = z.object({
  translation: z.enum(['BSB', 'KJV', 'WEB', 'NLT', 'NIV', 'NASB', 'ESV'] as const),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, response } = await requireAuth();
  if (response) return response;

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
    });
  } catch (err) {
    console.error('[POST /api/studies/translate]', err);
    return Response.json({ error: 'Translation service error' }, { status: 502 });
  }

  try {
    updateStudyTranslation(studyId, translation);
  } catch (persistErr) {
    console.error('[POST /api/studies/translate] failed to persist translation', persistErr);
    // Swap succeeded — return content even if persistence failed
  }

  // CLAUDE.md §3: Never return fums_token, original_content, or internal IDs
  return Response.json({
    content: swapResult.content,
    versesSwapped: swapResult.versesSwapped,
    missingVerses: swapResult.missingVerses,
    truncated: swapResult.truncated,
    translation,
  });
}
