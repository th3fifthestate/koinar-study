// app/components/layout/corner-nav.tsx
'use client';

import { useEffect, useState } from 'react';
import { Pencil } from 'lucide-react';
import Link from 'next/link';

interface CornerNavProps {
  username?: string;
  displayName?: string;
}

export function CornerNav({ username, displayName }: CornerNavProps) {
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

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 flex items-center justify-between pointer-events-none transition-all duration-400 ${
        scrolled
          ? 'bg-[var(--stone-50)]/85 backdrop-blur-xl border-b border-[var(--stone-200)]/50 px-6 py-3'
          : 'px-8 py-6'
      }`}
    >
      <Link
        href="/"
        className={`pointer-events-auto font-display text-xl font-medium tracking-wide transition-colors duration-400 ${
          scrolled ? 'text-[var(--stone-900)]' : 'text-[var(--stone-50)]'
        }`}
      >
        KOINAR
      </Link>

      <div className="pointer-events-auto flex items-center gap-5">
        <Link
          href="/generate"
          className={`flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] transition-colors duration-300 ${
            scrolled
              ? 'text-[var(--stone-700)]/50 hover:text-[var(--stone-900)]'
              : 'text-[var(--stone-50)]/70 hover:text-[var(--stone-50)]'
          }`}
        >
          <Pencil className="h-4 w-4" />
          <span>New Study</span>
        </Link>

        {username ? (
          <Link
            href="/profile"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--sage-500)] text-[var(--stone-50)] text-[13px] font-medium transition-transform duration-300 hover:scale-105"
          >
            {initials}
          </Link>
        ) : (
          <Link
            href="/login"
            className={`text-[10px] uppercase tracking-[0.2em] transition-colors duration-300 ${
              scrolled
                ? 'text-[var(--stone-700)]/50 hover:text-[var(--stone-900)]'
                : 'text-[var(--stone-50)]/70 hover:text-[var(--stone-50)]'
            }`}
          >
            Sign In
          </Link>
        )}
      </div>
    </nav>
  );
}
