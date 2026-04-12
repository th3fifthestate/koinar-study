import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getStudyDetail, isStudyFavorited } from '@/lib/db/queries';
import { getCurrentUser } from '@/lib/auth/session';
import { StudyReader } from '@/components/reader/study-reader';

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const study = getStudyDetail(slug);
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

  return (
    <StudyReader
      study={study}
      isFavorited={favorited}
      isLoggedIn={!!session}
    />
  );
}
