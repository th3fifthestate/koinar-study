'use client';

// app/components/layout/cookie-banner.tsx
//
// Alpha-appropriate cookie consent banner.
//
// Scope (intentionally narrow):
//   - Koinar currently uses only *essential* cookies (iron-session + CSRF).
//     No analytics, no advertising, no third-party pixels.
//   - The "Essential only" button is therefore cosmetic today — both choices
//     map to the same runtime behaviour. We ship it anyway so the banner's
//     semantics don't have to be reinterpreted when (if) we add analytics.
//   - No per-category toggles yet. When Koinar adds non-essential cookies,
//     this banner gains categories; until then, extra toggles would be
//     misleading.
//
// Storage:
//   - localStorage key `koinar:cookies`, values `'accepted' | 'essential'`.
//     localStorage (not a cookie) because the preference itself is purely
//     client-side UI state — storing it server-side would be ironic.
//   - Absent key → banner renders. Either choice dismisses and persists.
//
// Accessibility:
//   - role="dialog" + aria-labelledby on the title.
//   - Keyboard focus stays on the dialog's first actionable element when it
//     mounts. Dismissal doesn't trap focus — banner is non-modal (doesn't
//     block reading the page).

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'koinar:cookies';

type Choice = 'accepted' | 'essential';

function isValidChoice(v: unknown): v is Choice {
  return v === 'accepted' || v === 'essential';
}

export function CookieBanner() {
  // Hydration-safe: start hidden, render only after we've read localStorage.
  // Banner flicker on first paint would be worse than a one-tick delay.
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (!isValidChoice(stored)) setVisible(true);
    } catch {
      // localStorage unavailable (private browsing quota, Safari lockdown).
      // Show the banner anyway — the alternative is a silent dark pattern.
      setVisible(true);
    }
  }, []);

  const record = (choice: Choice) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, choice);
    } catch {
      // Session-only fallback: the banner will reappear next visit. That's a
      // better failure mode than a broken button.
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-labelledby="cookie-banner-title"
      aria-describedby="cookie-banner-body"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-stone-200 bg-stone-50/95 px-6 py-5 shadow-[0_-4px_20px_rgba(0,0,0,0.04)] backdrop-blur-sm md:px-10 motion-safe:animate-in motion-safe:slide-in-from-bottom-4 motion-safe:duration-300"
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex-1">
          <h2
            id="cookie-banner-title"
            className="font-display text-base font-medium text-stone-900"
          >
            A note on cookies
          </h2>
          <p
            id="cookie-banner-body"
            className="mt-1 font-body text-sm leading-relaxed text-stone-600"
          >
            Koinar uses a small set of essential cookies to keep you signed in
            and protect account actions. No tracking, no ads.{' '}
            <a
              href="/privacy"
              className="underline underline-offset-2 hover:text-stone-900 transition-colors"
            >
              Learn more
            </a>
            .
          </p>
        </div>
        <div className="flex flex-shrink-0 gap-2">
          <button
            type="button"
            onClick={() => record('essential')}
            className="rounded-sm border border-stone-300 bg-white px-4 py-2 font-body text-sm font-medium text-stone-700 hover:border-stone-400 hover:text-stone-900 transition-colors"
          >
            Essential only
          </button>
          <button
            type="button"
            autoFocus
            onClick={() => record('accepted')}
            className="rounded-sm bg-stone-900 px-4 py-2 font-body text-sm font-medium text-stone-50 hover:bg-stone-800 transition-colors"
          >
            Accept all
          </button>
        </div>
      </div>
    </div>
  );
}
