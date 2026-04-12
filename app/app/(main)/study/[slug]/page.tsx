import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getStudyDetail, isStudyFavorited } from '@/lib/db/queries';
import { getCurrentUser } from '@/lib/auth/session';
import { StudyReader } from '@/components/reader/study-reader';
import { annotateStudyIfNeeded } from '@/lib/entities/annotator';

type Props = {
  params: Promise<{ slug: string }>;
};

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

  return (
    <StudyReader
      study={study}
      isFavorited={favorited}
      isLoggedIn={!!session}
      entityAnnotations={entityAnnotations}
    />
  );
}
