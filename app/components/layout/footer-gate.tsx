'use client';

import { usePathname } from 'next/navigation';
import { Footer } from './footer';

// Exact paths or prefixes where the footer must NOT render.
// Comment explains the reason so the hide list stays intentional.
const HIDDEN_PREFIXES: Array<{ path: string; exact?: boolean }> = [
  { path: '/', exact: true },    // Landing/teaser — full-bleed editorial with its own email capture
  { path: '/about', exact: true }, // Full-bleed dark archway CTA — footer breaks editorial rhythm (Brief 17 revisits)
  { path: '/onboarding' },        // Immersive invite flow
  { path: '/login' },             // Focused single-form auth surfaces
  { path: '/register' },
  { path: '/waitlist' },
  { path: '/welcome' },
  { path: '/pending' },
  { path: '/join' },              // /join/* invite code flows
  { path: '/admin' },             // Admin area — separate surface
];

export function FooterGate() {
  const pathname = usePathname();

  const hidden = HIDDEN_PREFIXES.some(({ path, exact }) =>
    exact ? pathname === path : pathname === path || pathname.startsWith(path + '/'),
  );

  if (hidden) return null;
  return <Footer />;
}
