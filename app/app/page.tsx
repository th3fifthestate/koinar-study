// app/app/page.tsx
import { getSession } from '@/lib/auth/session';
import { getStudies, getUserFavoriteIds, getFeaturedStudies } from '@/lib/db/queries';
import { StickyNavbar } from '@/components/home/sticky-navbar';
import { Hero } from '@/components/home/hero';
import { LibraryThreshold } from '@/components/home/library-threshold';
import { FeaturedStudy } from '@/components/home/featured-study';
import { StudyGrid } from '@/components/library/study-grid';
import { StudyShelf } from '@/components/library/study-shelf';
import { EditorialAside } from '@/components/home/editorial-aside';
import { Footer } from '@/components/layout/footer';
import { LibraryModeWrapper } from '@/components/home/library-mode-wrapper';
import { TeaserClient } from './teaser-client';
import { getFeaturedForToday } from '@/lib/home/featured-rotation';
import { getQuoteForToday } from '@/lib/home/quote-rotation';
import {
  CATEGORY_CONFIG,
  CATEGORY_SHELF_ORDER,
} from '@/lib/library/category-config';
import type { StudyListItem } from '@/lib/db/types';

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

  // Filter mode = any URL state that narrows the result set. Sort doesn't
  // count — sort is a browse-mode refinement; the shelves stay visible
  // and re-order within each category.
  const isFilterMode = !!(q || category || format_type || favoritesOnly);

  // Browse mode pulls the full library so we can group by category and
  // render shelves. At the 6-month target of ~80 studies a single fetch
  // is comfortably cheap; bump the cap if the library grows past ~150.
  const browseLimit = 150;
  const filterLimit = 24;
  const limit = isFilterMode ? filterLimit : browseLimit;
  const effectivePage = isFilterMode ? page : 1;

  // Parallel data fetches
  const [{ studies, totalCount }, featured] = await Promise.all([
    Promise.resolve(
      getStudies({
        page: effectivePage,
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

  // Group studies by category slug for browse-mode shelves. Sort within
  // each shelf by created_at desc so the freshest reads first.
  const byCategory: Record<string, StudyListItem[]> = {};
  if (!isFilterMode) {
    for (const study of studies) {
      const slug = study.category_slug ?? 'uncategorized';
      if (!byCategory[slug]) byCategory[slug] = [];
      byCategory[slug].push(study);
    }
    for (const slug of Object.keys(byCategory)) {
      byCategory[slug].sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));
    }
  }

  // "In this issue" — 6 most recent across all categories, with the
  // featured study filtered out so the plate above doesn't repeat below.
  const inThisIssue = isFilterMode
    ? []
    : [...studies]
        .filter((s) => s.id !== featuredStudy?.id)
        .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
        .slice(0, 6);

  // Issue No. — same day-of-year cadence used by Footer, so the masthead
  // language stays coherent across the page.
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((now.getTime() - startOfYear.getTime()) / 86_400_000);

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

          {isFilterMode ? (
            // Filter mode: search / depth pill / category link / favorites
            // active. Collapse to a single results grid (no shelves, no
            // featured plate). Clearing filters returns the shelves view.
            <StudyGrid
              key={`${q ?? ''}-${category ?? ''}-${sort}-${format_type ?? ''}-${page}-${favoritesOnly}`}
              initialStudies={studies}
              totalCount={totalCount}
              userFavoriteIds={userFavoriteIds}
              currentPage={page}
              limit={filterLimit}
              isLoggedIn={true}
            />
          ) : (
            <>
              <FeaturedStudy study={featuredStudy} />

              <StudyShelf
                label="In this issue"
                studies={inThisIssue}
                meta={`No. ${dayOfYear} · ${inThisIssue.length} reading${inThisIssue.length === 1 ? '' : 's'}`}
                viewAllHref="/?sort=newest"
              />

              {CATEGORY_SHELF_ORDER.map((slug) => {
                const shelfStudies = byCategory[slug];
                if (!shelfStudies || shelfStudies.length === 0) return null;
                const cfg = CATEGORY_CONFIG[slug];
                return (
                  <StudyShelf
                    key={slug}
                    label={cfg.displayName}
                    studies={shelfStudies}
                    categorySlug={slug}
                  />
                );
              })}
            </>
          )}
        </section>

        {/* Zone 3 — Editorial aside */}
        <EditorialAside quote={quote} />

        {/* Zone 4 — Footer */}
        <Footer />
      </LibraryModeWrapper>
    </div>
  );
}
