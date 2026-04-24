// app/components/layout/corner-nav.tsx
'use client';

import { useEffect, useState } from 'react';
import { Pencil, LayoutGrid } from 'lucide-react';
import Link from 'next/link';

interface CornerNavProps {
  username?: string;
  displayName?: string;
  isAdmin?: boolean;
}

export function CornerNav({ username, displayName, isAdmin = false }: CornerNavProps) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > window.innerHeight * 0.85);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const initials = displayName
    ? displayName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : username?.slice(0, 2).toUpperCase() ?? '';

  // Text-shadow only applies in the unscrolled state (photo background).
  // Once the nav locks in with a backdrop-blur bar, shadows become noise.
  // Value is tuned to stay invisible on dark backgrounds while giving a
  // ~2px halo over bright skies.
  const unscrolledShadow = { textShadow: '0 1px 3px rgba(28, 25, 23, 0.55)' };

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 pointer-events-none transition-all duration-400 ${
        scrolled
          ? 'bg-[var(--stone-50)]/85 backdrop-blur-xl border-b border-[var(--stone-200)]/50'
          : ''
      }`}
    >
      {/* Top-edge scrim when over a photo background. Sits behind the nav
          row, fades to transparent by ~80px so the hero image reads through
          normally below the labels. Pointer-events remain off on the nav
          container; this div inherits that. */}
      {!scrolled && (
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[var(--stone-900)]/35 to-transparent"
        />
      )}

      <div
        className={`relative flex items-center justify-between transition-all duration-400 ${
          scrolled ? 'px-6 py-3' : 'px-8 py-6'
        }`}
      >
        <Link
          href="/"
          style={scrolled ? undefined : unscrolledShadow}
          className={`pointer-events-auto font-display text-xl font-medium tracking-wide transition-colors duration-400 ${
            scrolled ? 'text-[var(--stone-900)]' : 'text-[var(--stone-50)]'
          }`}
        >
          KOINAR
        </Link>

        <div className="pointer-events-auto flex items-center gap-5">
          <Link
            href="/generate"
            style={scrolled ? undefined : unscrolledShadow}
            className={`flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] transition-colors duration-300 ${
              scrolled
                ? 'text-[var(--stone-700)]/50 hover:text-[var(--stone-900)]'
                : 'text-[var(--stone-50)] hover:text-white'
            }`}
          >
            <Pencil className="h-4 w-4" />
            <span>New Study</span>
          </Link>

          {isAdmin ? (
            <Link
              href="/bench"
              style={scrolled ? undefined : unscrolledShadow}
              className={`flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] transition-colors duration-300 ${
                scrolled
                  ? 'text-[var(--stone-700)]/50 hover:text-[var(--stone-900)]'
                  : 'text-[var(--stone-50)] hover:text-white'
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
              <span>Study Bench</span>
            </Link>
          ) : (
            <button
              type="button"
              disabled
              title="Coming soon"
              aria-label="Study Bench — coming soon"
              style={scrolled ? undefined : unscrolledShadow}
              className={`flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] cursor-not-allowed select-none bg-transparent border-0 p-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--sage-500)] focus-visible:outline-offset-2 rounded-sm ${
                scrolled
                  ? 'text-[var(--stone-700)]/25'
                  : 'text-[var(--stone-50)]/60'
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
              <span>Study Bench</span>
            </button>
          )}

          {username ? (
            <Link
              href="/profile"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--sage-500)] text-[var(--stone-50)] text-[13px] font-medium transition-transform duration-300 hover:scale-105 shadow-sm"
            >
              {initials}
            </Link>
          ) : (
            <Link
              href="/login"
              style={scrolled ? undefined : unscrolledShadow}
              className={`text-[10px] uppercase tracking-[0.2em] transition-colors duration-300 ${
                scrolled
                  ? 'text-[var(--stone-700)]/50 hover:text-[var(--stone-900)]'
                  : 'text-[var(--stone-50)] hover:text-white'
              }`}
            >
              Sign In
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
