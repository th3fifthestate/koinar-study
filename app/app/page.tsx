// app/app/page.tsx
import { getSession } from '@/lib/auth/session';
import { getStudies, getUserFavoriteIds, getFeaturedStudies } from '@/lib/db/queries';
import { StickyNavbar } from '@/components/home/sticky-navbar';
import { Hero } from '@/components/home/hero';
import { LibraryThreshold } from '@/components/home/library-threshold';
import { FeaturedStudy } from '@/components/home/featured-study';
import { StudyGrid } from '@/components/library/study-grid';
import { EditorialAside } from '@/components/home/editorial-aside';
import { Footer } from '@/components/layout/footer';
import { LibraryModeWrapper } from '@/components/home/library-mode-wrapper';
import { TeaserClient } from './teaser-client';
import { getFeaturedForToday } from '@/lib/home/featured-rotation';
import { getQuoteForToday } from '@/lib/home/quote-rotation';

// Allowlist to prevent untrusted values reaching getStudies
const VALID_SORTS = ['newest', 'oldest', 'popular'] as const;
type ValidSort = typeof VALID_SORTS[number];

function parseSort(raw: string | undefined): ValidSort {
  return VALID_SORTS.includes(raw as ValidSort) ? (raw as ValidSort) : 'newest';
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  let session: Awaited<ReturnType<typeof getSession>> | null = null;
  try {
    session = await getSession();
  } catch {
    // Session unavailable — show teaser
  }

  if (!session?.userId) {
    return <TeaserClient />;
  }

  const params = await searchParams;

  // Parse + validate URL params (security: allowlist before passing to query layer)
  const category = typeof params.category === 'string' ? params.category : undefined;
  const q = typeof params.q === 'string' ? params.q : undefined;
  const sort = parseSort(typeof params.sort === 'string' ? params.sort : undefined);
  const format_type = typeof params.format_type === 'string' ? params.format_type : undefined;
  const favoritesOnly = params.favorites === 'true';
  const page = typeof params.page === 'string' ? Math.max(1, parseInt(params.page, 10) || 1) : 1;
  const limit = 24;

  // Parallel data fetches
  const [{ studies, totalCount }, featured] = await Promise.all([
    Promise.resolve(
      getStudies({
        page,
        limit,
        category,
        q,
        sort,
        format_type,
        userId: session.userId,
        ...(favoritesOnly ? { favoritesOfUserId: session.userId } : {}),
      })
    ),
    Promise.resolve(getFeaturedStudies(3)),
  ]);

  // Day-of-year deterministic featured rotation
  const featuredStudy = getFeaturedForToday(featured);

  // User's favorited IDs for optimistic client state
  const favIdSet = getUserFavoriteIds(session.userId);
  const userFavoriteIds = studies.filter((s) => favIdSet.has(s.id)).map((s) => s.id);

  // Today's editorial aside quote
  const quote = getQuoteForToday();

  // User display
  const username = session.username ?? undefined;
  const firstName = (session.displayName?.trim() || session.username) ?? undefined;

  return (
    <div className="relative min-h-dvh bg-[var(--stone-50)]">
      {/* Zone 1 — Hero */}
      <Hero
        username={username}
        firstName={firstName}
        displayName={session.displayName ?? username}
        isAdmin={session.isAdmin === true}
      />

      <LibraryModeWrapper>
        <StickyNavbar
          username={username}
          displayName={session.displayName ?? username}
          isAdmin={session.isAdmin === true}
        />

        {/* Zone 2 — Library proper */}
        <section>
          <LibraryThreshold />

          <FeaturedStudy study={featuredStudy} />

          <StudyGrid
            key={`${q ?? ''}-${category ?? ''}-${sort}-${format_type ?? ''}-${page}-${favoritesOnly}`}
            initialStudies={studies}
            totalCount={totalCount}
            userFavoriteIds={userFavoriteIds}
            currentPage={page}
            limit={limit}
            isLoggedIn={true}
          />
        </section>

        {/* Zone 3 — Editorial aside */}
        <EditorialAside quote={quote} />

        {/* Zone 4 — Footer */}
        <Footer />
      </LibraryModeWrapper>
    </div>
  );
}
