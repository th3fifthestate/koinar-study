// app/components/home/sticky-navbar.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Pencil, LayoutGrid, Sun, Moon } from 'lucide-react';
import { useReaderPrefs } from '@/lib/reader/use-reader-prefs';

interface StickyNavbarProps {
  username?: string;
  displayName?: string;
  isAdmin?: boolean;
}

/**
 * Sticky home-page navbar. Lives inside LibraryModeWrapper so it inherits
 * `data-mode` via cascade (drives bed tone via plain CSS variables).
 *
 * Behavior matches the locked v8 mockup: position sticky, hidden initially
 * (opacity 0, translateY -12px, no pointer events) and fades in once the
 * user has scrolled past ~85% of the viewport height — the same threshold
 * the previous CornerNav used.
 */
export function StickyNavbar({ username, displayName, isAdmin = false }: StickyNavbarProps) {
  const [scrolled, setScrolled] = useState(false);
  const { prefs, setMode } = useReaderPrefs();
  const isDark = prefs.mode === 'dark';

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > window.innerHeight * 0.85);
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const initials = displayName
    ? displayName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : username?.slice(0, 2).toUpperCase() ?? '';

  const toggleMode = () => setMode(isDark ? 'light' : 'dark');

  return (
    <>
      {/* Mode-aware bed colors: light vs dark via the data-mode cascade. The
          parent LibraryModeWrapper publishes data-mode; this component is
          rendered inside it, so [data-mode='dark'] selectors below will
          match without any JS branching for the bed tone. */}
      <style>{`
        .koinar-sticky-navbar {
          background: rgba(247, 246, 243, 0.86);
          -webkit-backdrop-filter: saturate(140%) blur(14px);
          backdrop-filter: saturate(140%) blur(14px);
          border-bottom: 1px solid rgba(0, 0, 0, 0.06);
        }
        [data-mode='dark'] .koinar-sticky-navbar {
          background: rgba(28, 25, 23, 0.78);
          border-bottom-color: rgba(255, 255, 255, 0.08);
        }
        .koinar-sticky-navbar .navbar-mark {
          color: var(--stone-900);
        }
        [data-mode='dark'] .koinar-sticky-navbar .navbar-mark {
          color: var(--stone-50);
        }
        .koinar-sticky-navbar .nav-item {
          color: var(--stone-900);
        }
        .koinar-sticky-navbar .nav-item:hover {
          color: var(--sage-700);
        }
        .koinar-sticky-navbar .nav-item svg {
          color: var(--stone-700);
          transition: color 0.2s ease;
        }
        .koinar-sticky-navbar .nav-item:hover svg {
          color: var(--sage-700);
        }
        [data-mode='dark'] .koinar-sticky-navbar .nav-item {
          color: var(--stone-50);
        }
        [data-mode='dark'] .koinar-sticky-navbar .nav-item:hover {
          color: var(--warmth);
        }
        [data-mode='dark'] .koinar-sticky-navbar .nav-item svg {
          color: var(--stone-300);
        }
        [data-mode='dark'] .koinar-sticky-navbar .nav-item:hover svg {
          color: var(--warmth);
        }
        .koinar-sticky-navbar .mode-toggle {
          border: 1px solid rgba(77, 73, 67, 0.18);
          color: var(--stone-700);
        }
        .koinar-sticky-navbar .mode-toggle:hover {
          border-color: var(--stone-700);
          color: var(--stone-900);
        }
        [data-mode='dark'] .koinar-sticky-navbar .mode-toggle {
          border-color: rgba(255, 255, 255, 0.18);
          color: var(--stone-300);
        }
        [data-mode='dark'] .koinar-sticky-navbar .mode-toggle:hover {
          border-color: var(--stone-200);
          color: var(--stone-50);
        }
      `}</style>

      <nav
        className="koinar-sticky-navbar sticky top-0 z-50 flex items-center justify-between"
        style={{
          padding: '22px 56px',
          opacity: scrolled ? 1 : 0,
          transform: scrolled ? 'translateY(0)' : 'translateY(-12px)',
          pointerEvents: scrolled ? 'auto' : 'none',
          transition: 'opacity 0.35s ease, transform 0.35s ease',
        }}
      >
        <Link
          href="/"
          className="navbar-mark font-display font-medium uppercase"
          style={{
            fontSize: '16px',
            letterSpacing: '0.42em',
            paddingLeft: '0.42em',
            fontVariationSettings: '"opsz" 144',
          }}
        >
          KOINAR
        </Link>

        <div className="flex items-center gap-7">
          <Link
            href="/generate"
            className="nav-item flex items-center gap-2 font-display uppercase"
            style={{
              fontSize: '14px',
              letterSpacing: '0.16em',
              fontWeight: 400,
            }}
          >
            <Pencil className="h-[14px] w-[14px]" strokeWidth={1.4} />
            <span>New Study</span>
          </Link>

          {isAdmin ? (
            <Link
              href="/bench"
              className="nav-item flex items-center gap-2 font-display uppercase"
              style={{
                fontSize: '14px',
                letterSpacing: '0.16em',
                fontWeight: 400,
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
              className="nav-item flex items-center gap-2 font-display uppercase opacity-50 cursor-not-allowed bg-transparent border-0 p-0"
              style={{
                fontSize: '14px',
                letterSpacing: '0.16em',
                fontWeight: 400,
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
            className="mode-toggle flex items-center justify-center rounded-full transition-colors"
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
              className="nav-item font-display uppercase"
              style={{
                fontSize: '14px',
                letterSpacing: '0.16em',
                fontWeight: 400,
              }}
            >
              Sign In
            </Link>
          )}
        </div>
      </nav>
    </>
  );
}
