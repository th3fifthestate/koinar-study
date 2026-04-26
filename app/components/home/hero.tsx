'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Pencil, LayoutGrid, Sun, Moon } from 'lucide-react';
import {
  greetingForBucket,
  displayForBucket,
  TOD_IMAGES,
} from '@/lib/home/tod-bucket';
import { useTodPalette } from '@/lib/home/use-tod-palette';
import { useReaderPrefs } from '@/lib/reader/use-reader-prefs';

interface HeroProps {
  username?: string;
  firstName?: string;
  displayName?: string;
  isAdmin?: boolean;
}

/** Day-of-year, 1-indexed, locale-stable (UTC). */
function getDayOfYear(d: Date): number {
  const start = Date.UTC(d.getUTCFullYear(), 0, 0);
  const diff = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - start;
  return Math.floor(diff / 86_400_000);
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

function formatIssueLine(d: Date): string {
  const dayOfYear = getDayOfYear(d);
  const month = MONTHS[d.getMonth()];
  return `Issue No. ${dayOfYear} — ${month} ${d.getDate()}, ${d.getFullYear()}`;
}

/**
 * Stage 3 hero: two-column composition. Image on the left (TOD-driven),
 * cream typographic column on the right with greeting, display lockup,
 * in-hero nav and issue line. The in-hero nav fades when the user scrolls
 * past 85vh — at the same threshold the StickyNavbar fades in.
 */
export function Hero({ username, firstName, displayName, isAdmin = false }: HeroProps) {
  const { bucket, gradientOpacity } = useTodPalette();
  const { prefs, setMode } = useReaderPrefs();
  const isDark = prefs.mode === 'dark';

  const [scrolled, setScrolled] = useState(false);
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
  }, []);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > window.innerHeight * 0.85);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const image = TOD_IMAGES[bucket];
  const greeting = greetingForBucket(bucket, firstName);
  const display = displayForBucket(bucket);

  // Issue line — render a stable placeholder until mount to avoid SSR/client
  // mismatch. The placeholder uses non-breaking spaces so the layout doesn't
  // jump when the real value lands.
  const issueLine = useMemo(() => (now ? formatIssueLine(now) : ' '), [now]);

  const initials = displayName
    ? displayName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : username?.slice(0, 2).toUpperCase() ?? '';

  const toggleMode = () => setMode(isDark ? 'light' : 'dark');

  return (
    <>
      {/* Local styles: hover colors + responsive grid + scroll-fade. The cream
          column hardcodes #f7f6f3 because Hero lives outside LibraryModeWrapper
          and --bed-cream is only defined under [data-mode]. */}
      <style>{`
        .koinar-hero {
          display: grid;
          grid-template-columns: 1.35fr 1fr;
          min-height: 100vh;
          min-height: 100dvh;
          background: #f7f6f3;
          position: relative;
        }
        .koinar-hero-image {
          position: relative;
          overflow: hidden;
        }
        .koinar-hero-text {
          background: #f7f6f3;
          padding: 48px 56px 56px;
          display: grid;
          grid-template-rows: auto 1fr auto;
          position: relative;
        }
        .koinar-hero .hero-nav-item {
          color: var(--stone-900);
          transition: color 0.2s ease;
        }
        .koinar-hero .hero-nav-item:hover {
          color: var(--reader-accent-deep, var(--sage-700));
        }
        .koinar-hero .hero-nav-item svg {
          color: var(--stone-700);
          transition: color 0.2s ease;
        }
        .koinar-hero .hero-nav-item:hover svg {
          color: var(--reader-accent-deep, var(--sage-700));
        }
        .koinar-hero .hero-mode-toggle {
          border: 1px solid rgba(77, 73, 67, 0.18);
          color: var(--stone-700);
          transition: border-color 0.2s ease, color 0.2s ease;
        }
        .koinar-hero .hero-mode-toggle:hover {
          border-color: var(--stone-700);
          color: var(--stone-900);
        }
        @media (max-width: 768px) {
          .koinar-hero {
            grid-template-columns: 1fr;
            grid-template-rows: 55vh 1fr;
            min-height: 100vh;
            min-height: 100dvh;
          }
          .koinar-hero-text {
            padding: 32px 24px 40px;
          }
          .koinar-hero-chevron {
            display: none;
          }
        }
      `}</style>

      <section className="koinar-hero" aria-label="Library home hero">
        {/* LEFT: TOD image */}
        <div className="koinar-hero-image">
          <Image
            src={image.src}
            alt={image.alt}
            fill
            priority
            sizes="(max-width: 768px) 100vw, 58vw"
            className="object-cover motion-safe:[animation:kenBurns_30s_ease-in-out_infinite]"
          />
          {gradientOpacity > 0 && (
            <div
              className="absolute inset-x-0 bottom-0 h-[40%] pointer-events-none"
              style={{
                background: `linear-gradient(to top, rgba(28, 25, 23, ${gradientOpacity}), rgba(28, 25, 23, 0))`,
              }}
              aria-hidden="true"
            />
          )}
        </div>

        {/* RIGHT: cream typographic column */}
        <div className="koinar-hero-text">
          {/* Greeting eyebrow — top right */}
          <p
            className="font-sans text-right"
            style={{
              fontSize: '11px',
              fontWeight: 500,
              letterSpacing: '0.32em',
              textTransform: 'uppercase',
              color: 'var(--stone-700)',
              paddingTop: '6px',
            }}
          >
            {greeting}
          </p>

          {/* Display lockup — center */}
          <div
            className="flex flex-col items-center justify-center text-center"
            style={{
              color: 'var(--stone-900)',
              lineHeight: 0.92,
              padding: '24px 0',
            }}
          >
            <span
              className="font-display"
              style={{
                fontWeight: 600,
                fontSize: 'clamp(2.6rem, 5vw, 4.2rem)',
                letterSpacing: '-0.012em',
                textTransform: 'uppercase',
                fontFeatureSettings: '"case" on',
                fontVariationSettings: '"opsz" 144',
              }}
            >
              {display.caps}
            </span>
            <span
              className="font-display italic"
              style={{
                fontWeight: 400,
                fontSize: 'clamp(2.6rem, 5vw, 4.2rem)',
                letterSpacing: '-0.005em',
                textTransform: 'uppercase',
                fontVariationSettings: '"opsz" 144',
                marginTop: '-6px',
              }}
            >
              {display.italic}
            </span>
          </div>

          {/* Bottom: in-hero nav + issue line */}
          <div
            className="flex flex-col items-center"
            style={{ gap: '28px' }}
          >
            <div
              className="flex items-center justify-center"
              style={{
                gap: '28px',
                opacity: scrolled ? 0 : 1,
                transform: scrolled ? 'translateY(-8px)' : 'translateY(0)',
                pointerEvents: scrolled ? 'none' : 'auto',
                transition: 'opacity 0.35s ease, transform 0.35s ease',
              }}
            >
              <Link
                href="/generate"
                className="hero-nav-item flex items-center font-display uppercase"
                style={{
                  gap: '8px',
                  fontSize: '14px',
                  fontWeight: 400,
                  letterSpacing: '0.16em',
                }}
              >
                <Pencil className="h-[14px] w-[14px]" strokeWidth={1.4} />
                <span>New Study</span>
              </Link>

              {isAdmin ? (
                <Link
                  href="/bench"
                  className="hero-nav-item flex items-center font-display uppercase"
                  style={{
                    gap: '8px',
                    fontSize: '14px',
                    fontWeight: 400,
                    letterSpacing: '0.16em',
                  }}
                >
                  <LayoutGrid className="h-[14px] w-[14px]" strokeWidth={1.4} />
                  <span>Study Bench</span>
                </Link>
              ) : (
                <button
                  type="button"
                  disabled
                  title="Coming soon"
                  aria-label="Study Bench — coming soon"
                  className="hero-nav-item flex items-center font-display uppercase opacity-50 cursor-not-allowed bg-transparent border-0 p-0"
                  style={{
                    gap: '8px',
                    fontSize: '14px',
                    fontWeight: 400,
                    letterSpacing: '0.16em',
                  }}
                >
                  <LayoutGrid className="h-[14px] w-[14px]" strokeWidth={1.4} />
                  <span>Study Bench</span>
                </button>
              )}

              <button
                type="button"
                onClick={toggleMode}
                aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                className="hero-mode-toggle flex items-center justify-center rounded-full"
                style={{
                  width: '32px',
                  height: '32px',
                  background: 'transparent',
                  cursor: 'pointer',
                }}
              >
                {isDark ? (
                  <Sun className="h-[14px] w-[14px]" strokeWidth={1.4} />
                ) : (
                  <Moon className="h-[14px] w-[14px]" strokeWidth={1.4} />
                )}
              </button>

              {username ? (
                <Link
                  href="/profile"
                  aria-label="Profile"
                  className="flex items-center justify-center rounded-full bg-[var(--sage-500)] text-white font-sans font-medium transition-transform hover:scale-105"
                  style={{
                    width: '34px',
                    height: '34px',
                    fontSize: '11px',
                    letterSpacing: '0.06em',
                    border: '1px solid rgba(0,0,0,0.06)',
                  }}
                >
                  {initials}
                </Link>
              ) : (
                <Link
                  href="/login"
                  className="hero-nav-item font-display uppercase"
                  style={{
                    fontSize: '14px',
                    fontWeight: 400,
                    letterSpacing: '0.16em',
                  }}
                >
                  Sign In
                </Link>
              )}
            </div>

            <p
              className="font-sans text-center"
              style={{
                fontSize: '9px',
                letterSpacing: '0.28em',
                textTransform: 'uppercase',
                color: 'var(--stone-500)',
              }}
            >
              {issueLine}
            </p>
          </div>

          {/* Chevron — absolute bottom-center of the right column */}
          <svg
            className="koinar-hero-chevron"
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            aria-hidden="true"
            style={{
              position: 'absolute',
              bottom: '18px',
              left: '50%',
              transform: 'translateX(-50%)',
              color: 'var(--stone-700)',
              opacity: 0.6,
            }}
          >
            <path
              d="M5 8 L10 13 L15 8"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
          </svg>
        </div>
      </section>
    </>
  );
}
