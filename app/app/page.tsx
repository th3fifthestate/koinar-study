// app/app/page.tsx
import { getSession } from '@/lib/auth/session';
import { getStudies, getAllCategories, getUserFavoriteIds, getFeaturedStudies } from '@/lib/db/queries';
import { StickyNavbar } from '@/components/home/sticky-navbar';
import { Hero } from '@/components/home/hero';
import { LibraryThreshold } from '@/components/home/library-threshold';
import { RefineBand } from '@/components/home/refine-band';
import { StudyGrid } from '@/components/library/study-grid';
import { GenerateInvitationCard } from '@/components/home/generate-invitation-card';
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
  const [{ studies, totalCount }, categories, featured] = await Promise.all([
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
    Promise.resolve(getAllCategories()),
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

  // Editorial interruption cards inserted into the masonry
  const interruptionCards = [
    { index: 5, component: <GenerateInvitationCard /> },
  ];

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

          <RefineBand categories={categories} />

          <div
            className="border-b border-[var(--stone-200)] dark:border-[var(--stone-700)] relative"
            style={{
              backgroundColor: 'var(--surface-home-hero)',
              backgroundImage: `
                radial-gradient(ellipse 1400px 900px at 8% 12%, rgba(196,154,108,0.10), transparent 65%),
                radial-gradient(ellipse 1600px 1100px at 96% 38%, rgba(168,184,160,0.09), transparent 60%),
                radial-gradient(ellipse 1200px 800px at 30% 82%, rgba(221,217,208,0.40), transparent 70%),
                radial-gradient(ellipse 1000px 700px at 82% 90%, rgba(196,154,108,0.07), transparent 65%),
                url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='320' height='320'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.36  0 0 0 0 0.33  0 0 0 0 0.29  0 0 0 0.55 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)' opacity='0.45'/></svg>"),
                radial-gradient(circle at 13% 22%, rgba(92,86,74,0.08) 1.4px, transparent 2.8px),
                radial-gradient(circle at 71% 48%, rgba(92,86,74,0.06) 1.1px, transparent 2.4px),
                radial-gradient(circle at 38% 78%, rgba(107,128,96,0.07) 1.2px, transparent 2.5px),
                radial-gradient(circle at 84% 14%, rgba(196,154,108,0.06) 1px, transparent 2.2px),
                radial-gradient(circle at 52% 35%, rgba(92,86,74,0.05) 0.9px, transparent 2px),
                linear-gradient(to bottom, transparent 0, transparent calc(100% - 1px), rgba(120,113,100,0.08) calc(100% - 1px), rgba(120,113,100,0.08) 100%)
              `,
              backgroundSize:
                '100% 100%, 100% 100%, 100% 100%, 100% 100%, 320px 320px, 520px 380px, 640px 460px, 480px 520px, 720px 340px, 580px 440px, 100% 360px',
              backgroundPosition:
                '0 0, 0 0, 0 0, 0 0, 0 0, 0 0, 140px 90px, 60px 220px, 380px 160px, 210px 310px, 0 0',
              backgroundRepeat:
                'no-repeat, no-repeat, no-repeat, no-repeat, repeat, repeat, repeat, repeat, repeat, repeat, repeat',
            }}
          >
            <div className="mx-auto max-w-[1400px] px-6 md:px-10 lg:px-24 pt-10 pb-24">
              <StudyGrid
                key={`${q ?? ''}-${category ?? ''}-${sort}-${format_type ?? ''}-${page}-${favoritesOnly}`}
                initialStudies={studies}
                totalCount={totalCount}
                userFavoriteIds={userFavoriteIds}
                currentPage={page}
                limit={limit}
                isLoggedIn={true}
                interruptionCards={interruptionCards}
              />
            </div>
          </div>
        </section>

        {/* Zone 3 — Editorial aside */}
        <EditorialAside quote={quote} />

        {/* Zone 4 — Footer */}
        <Footer />
      </LibraryModeWrapper>
    </div>
  );
}
