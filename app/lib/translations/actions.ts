'use server';

import { getCurrentUser } from '@/lib/auth/session';
import { recordFumsEvent } from './fums-tracker';
import { TRANSLATIONS } from './registry';
import type { TranslationId } from './registry';

/**
 * Records a FUMS 'display' event when a licensed translation is rendered.
 * Silent no-op if the translation is not licensed or user is not authenticated.
 */
export async function recordDisplayEvent(
  translation: TranslationId,
  studyId: number,
  verseCount: number,
): Promise<void> {
  const info = TRANSLATIONS[translation];
  if (!info?.isLicensed) return;
  const session = await getCurrentUser();
  recordFumsEvent({
    translation,
    fumsToken: null,
    eventType: 'display',
    studyId,
    userId: session?.userId,
    verseCount,
  });
}
