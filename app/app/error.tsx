'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Best-effort client-side telemetry — server-side error already logged
    // via Next's reporter. Digest is the only safe-to-display identifier.
    console.error('[error.tsx]', error.digest ?? '(no digest)', error.message);
  }, [error]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-[var(--ivory-paper,#fdfaf3)] px-6">
      <div className="max-w-md text-center">
        <h1 className="font-display text-3xl font-medium text-[var(--stone-900,#2c2924)] mb-4">
          Something went wrong
        </h1>
        <p className="font-body text-base text-[var(--stone-700,#5c564a)] mb-6 leading-relaxed">
          We hit a snag rendering this page. The team has been notified — you
          can try again, or head back home.
        </p>
        {error.digest && (
          <p className="font-mono text-xs text-[var(--stone-500,#7a7468)] mb-6">
            Reference: {error.digest}
          </p>
        )}
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="rounded-md bg-[var(--sage-700,#3d4f35)] px-4 py-2 font-body text-sm text-white hover:bg-[var(--sage-800,#2a3724)] transition-colors"
          >
            Try again
          </button>
          <Link
            href="/"
            className="rounded-md border border-[var(--stone-300,#c4bfb3)] px-4 py-2 font-body text-sm text-[var(--stone-900,#2c2924)] hover:bg-[var(--stone-100,#edebe6)] transition-colors"
          >
            Go home
          </Link>
        </div>
      </div>
    </main>
  );
}
