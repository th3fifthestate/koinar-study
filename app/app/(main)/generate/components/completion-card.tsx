'use client';
import { useState, useEffect, useRef } from 'react';

interface CompletionCardProps {
  title: string;
  slug: string;
  onOpen: () => void;
  autoRedirectMs?: number;
}

export function CompletionCard({
  title,
  slug: _slug,
  onOpen,
  autoRedirectMs = 3000,
}: CompletionCardProps) {
  const initialSeconds = Math.round(autoRedirectMs / 1000);
  const [countdown, setCountdown] = useState(initialSeconds);
  const [cancelled, setCancelled] = useState(false);
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (cancelled) return;

    const interval = setInterval(() => {
      setCountdown(prev => {
        const next = prev - 1;
        if (next <= 0) {
          clearInterval(interval);
          if (!cancelledRef.current) {
            onOpen();
          }
          return 0;
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cancelled]);

  const handleCancel = () => {
    cancelledRef.current = true;
    setCancelled(true);
  };

  return (
    <div
      role="status"
      aria-live="assertive"
      className="min-h-screen bg-[var(--stone-50)] flex flex-col items-center px-6 py-16"
      style={{ animation: 'authFadeIn 500ms ease-out both' }}
    >
      <div className="max-w-2xl w-full text-center">
        {/* Eyebrow */}
        <p className="text-[var(--stone-700)] text-xs font-semibold tracking-[0.25em] uppercase mb-6">
          Ready
        </p>

        {/* Headline */}
        <h2 className="font-display text-[var(--stone-900)] text-3xl md:text-4xl mb-6 italic">
          Your study is ready.
        </h2>

        {/* Title */}
        <p
          className="font-display text-[var(--stone-900)] mb-8"
          style={{ fontSize: '1.4rem' }}
        >
          {title}
        </p>

        {/* Primary CTA */}
        <button
          onClick={onOpen}
          className="bg-[var(--sage-500)] hover:bg-[var(--sage-700)] text-[var(--stone-50)] text-sm font-semibold tracking-[0.12em] uppercase px-8 py-3 rounded-md transition-colors min-h-[44px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sage-500)]"
        >
          Open study
        </button>

        {/* Countdown / cancel line */}
        <p className="font-body text-[var(--stone-700)] text-sm mt-6">
          {cancelled ? (
            'Cancelled. You can open it anytime.'
          ) : (
            <>
              Opening automatically in {countdown}s.{' '}
              <button
                onClick={handleCancel}
                className="underline underline-offset-2 hover:text-[var(--stone-900)] transition-colors"
              >
                Cancel
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
