// app/app/(main)/page.tsx
import { getSession } from '@/lib/auth/session';
import { getStudies, getAllCategories, isStudyFavorited } from '@/lib/db/queries';
import { CornerNav } from '@/components/layout/corner-nav';
import { Footer } from '@/components/layout/footer';
import { HeroSection } from '@/components/library/hero-section';
import { StudyGrid } from '@/components/library/study-grid';
import { LibrarySearch } from '@/components/library/library-search';
import { LibraryFilters } from '@/components/library/library-filters';
import type { StudyListItem } from '@/lib/db/types';

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const session = await getSession();
  const isLoggedIn = !!session.userId;

  // Parse search params
  const category = typeof params.category === 'string' ? params.category : undefined;
  const q = typeof params.q === 'string' ? params.q : undefined;
  const sort = typeof params.sort === 'string' ? params.sort : 'newest';
  const format_type = typeof params.format_type === 'string' ? params.format_type : undefined;
  const page = typeof params.page === 'string' ? Math.max(1, parseInt(params.page, 10) || 1) : 1;
  const limit = 24;

  // Validate sort
  const validSorts = ['newest', 'oldest', 'popular'] as const;
  const sortValue = validSorts.includes(sort as typeof validSorts[number])
    ? (sort as typeof validSorts[number])
    : 'newest';

  // Fetch studies
  const { studies, totalCount } = getStudies({
    page,
    limit,
    category,
    q,
    sort: sortValue,
    format_type,
    userId: session.userId || undefined,
  });

  // Fetch categories for filter dropdown
  const categories = getAllCategories();

  // Featured study: first is_featured study, or newest study
  let featuredStudy: StudyListItem | null = null;
  const featuredResult = getStudies({ page: 1, limit: 1, sort: 'newest' });
  // Check for featured flag
  const featured = featuredResult.studies.find((s) => s.is_featured);
  featuredStudy = featured ?? featuredResult.studies[0] ?? null;

  // User's favorite IDs for initial client state
  let userFavoriteIds: number[] = [];
  if (session.userId) {
    userFavoriteIds = studies
      .filter((s) => isStudyFavorited(session.userId, s.id))
      .map((s) => s.id);
  }

  // User info for display
  const username = session.username ?? undefined;
  // display_name would come from a user query — for now use username
  const displayName = username;

  return (
    <div className="relative min-h-dvh">
      <CornerNav username={username} displayName={displayName} />

      {/* Zone 1: Hero */}
      <HeroSection
        username={username}
        displayName={displayName}
        featuredStudy={featuredStudy}
      />

      {/* Zone 2: Atmospheric Transition + Zone 3: Library */}
      <section className="relative bg-gradient-to-b from-[var(--warmth)]/[0.06] via-transparent to-transparent">
        <div className="mx-auto max-w-[1280px] px-6 md:px-10 pt-12 pb-20">
          {/* Library header */}
          <div className="mb-8">
            <h2 className="font-display text-[28px] font-normal">Study Library</h2>
            <p className="text-[13px] text-[var(--stone-300)]">
              Explore studies crafted with contextual rigor
            </p>
          </div>

          {/* Search + Filters */}
          <div className="flex flex-wrap items-center gap-3 mb-2">
            <LibrarySearch />
            <LibraryFilters categories={categories} isLoggedIn={isLoggedIn} />
          </div>

          {/* Study Grid */}
          <div className="mt-6">
            <StudyGrid
              initialStudies={studies}
              totalCount={totalCount}
              userFavoriteIds={userFavoriteIds}
              currentPage={page}
              limit={limit}
              isLoggedIn={isLoggedIn}
            />
          </div>
        </div>
      </section>

      {/* Zone 4: Footer */}
      <Footer />
    </div>
  );
}
