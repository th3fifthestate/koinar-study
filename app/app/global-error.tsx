'use client';

import { useEffect } from 'react';

// global-error.tsx replaces the root layout when the layout itself throws.
// Must be a complete HTML document because <html> and <body> are NOT inherited
// from app/layout.tsx in this fallback path.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[global-error.tsx]', error.digest ?? '(no digest)', error.message);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#fdfaf3',
          fontFamily: 'system-ui, sans-serif',
          padding: '24px',
        }}
      >
        <div style={{ maxWidth: '480px', textAlign: 'center' }}>
          <h1
            style={{
              fontSize: '28px',
              fontWeight: 500,
              color: '#2c2924',
              marginBottom: '16px',
            }}
          >
            Something went wrong
          </h1>
          <p
            style={{
              fontSize: '16px',
              color: '#5c564a',
              marginBottom: '24px',
              lineHeight: 1.6,
            }}
          >
            We hit an unexpected error. Refresh the page to try again, or head
            back home.
          </p>
          {error.digest && (
            <p
              style={{
                fontSize: '12px',
                color: '#7a7468',
                marginBottom: '24px',
                fontFamily: 'monospace',
              }}
            >
              Reference: {error.digest}
            </p>
          )}
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button
              onClick={reset}
              style={{
                backgroundColor: '#3d4f35',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                padding: '8px 16px',
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              Try again
            </button>
            {/* global-error.tsx replaces the root layout — Next's Link
                requires the App Router context which isn't available here.
                Plain anchor is the documented escape hatch. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/"
              style={{
                color: '#2c2924',
                border: '1px solid #c4bfb3',
                borderRadius: '6px',
                padding: '8px 16px',
                fontSize: '14px',
                textDecoration: 'none',
              }}
            >
              Go home
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
