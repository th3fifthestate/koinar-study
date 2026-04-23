import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getStudyDetail, isStudyFavorited } from '@/lib/db/queries';
import { getCurrentUser } from '@/lib/auth/session';
import { StudyReader } from '@/components/reader/study-reader';
import { annotateStudyIfNeeded } from '@/lib/entities/annotator';
import { getEntitiesByIds } from '@/lib/db/entities/queries';
import { getAvailableTranslations } from '@/lib/translations/registry';
import { getCachedVerse } from '@/lib/translations/cache';
import type { TranslationAvailability } from '@/lib/translations/registry';

type Props = {
  params: Promise<{ slug: string }>;
};

// Sentinel verse for cache probing — John 3:16 (book slug: 'jhn')
const SENTINEL_BOOK = 'jhn';
const SENTINEL_CHAPTER = 3;
const SENTINEL_VERSE = 16;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const session = await getCurrentUser();
  const study = getStudyDetail(slug, session?.userId);
  if (!study) return { title: 'Study Not Found' };

  return {
    title: study.title,
    description: study.summary ?? undefined,
    openGraph: {
      title: study.title,
      description: study.summary ?? undefined,
      images: study.featured_image_url ? [{ url: study.featured_image_url }] : undefined,
    },
  };
}

export default async function StudyPage({ params }: Props) {
  const { slug } = await params;
  const session = await getCurrentUser();
  const study = getStudyDetail(slug, session?.userId);

  if (!study) notFound();

  const favorited = session ? isStudyFavorited(session.userId, study.id) : false;

  // Ensure entity annotations exist — generates on first access for older studies
  const entityAnnotations = await annotateStudyIfNeeded(study.id, study.content_markdown);
  const entityIds = [...new Set(entityAnnotations.map((a) => a.entity_id))];
  const entities = entityIds.length > 0 ? getEntitiesByIds(entityIds) : [];

  // Build TranslationAvailability[] by probing the cache for licensed translations
  const availableTranslations = getAvailableTranslations();
  const availabilityResults = await Promise.allSettled(
    availableTranslations.map(async (t): Promise<TranslationAvailability> => {
      if (!t.isLicensed) {
        // Public domain translations are always available instantly
        return { id: t.id, name: t.name, state: 'cached' };
      }
      // Licensed: probe cache with sentinel verse
      const cached = getCachedVerse(t.id, SENTINEL_BOOK, SENTINEL_CHAPTER, SENTINEL_VERSE);
      return { id: t.id, name: t.name, state: cached !== null ? 'cached' : 'uncached' };
    }),
  );

  const translationAvailability: TranslationAvailability[] = availabilityResults.map((r, i) =>
    r.status === 'fulfilled'
      ? r.value
      : { id: availableTranslations[i].id, name: availableTranslations[i].name, state: 'uncached' as const }
  );

  return (
    <StudyReader
      study={study}
      isFavorited={favorited}
      entityAnnotations={entityAnnotations}
      entities={entities}
      heroNeedsScrim={!!study.hero_needs_scrim}
      translations={translationAvailability}
      benchEnabled={session?.isAdmin === true}
    />
  );
}
