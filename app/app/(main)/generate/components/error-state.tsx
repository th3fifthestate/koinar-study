'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

interface ErrorStateProps {
  kind: 'error-rate-limited' | 'error-invalid-key' | 'error-stream-aborted' | 'error-save-failed';
  retryAt?: number;
  markdown?: string;
  onRetry: () => void;
  onSaveAgain?: () => void;
}

function RateLimitedContent({ retryAt, onRetry }: { retryAt?: number; onRetry: () => void }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!retryAt) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [retryAt]);

  const canRetry = !retryAt || now >= retryAt;
  const remaining = retryAt ? Math.max(0, retryAt - now) : 0;
  const minutes = Math.floor(remaining / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1000);

  return (
    <>
      <p className="text-[var(--stone-700)] text-xs font-semibold tracking-[0.2em] uppercase mb-4">
        A Pause
      </p>
      <h2 className="font-display text-[var(--stone-900)] text-2xl md:text-3xl italic mb-4">
        Koinar asks for a breath between studies.
      </h2>
      <p className="font-body text-[var(--stone-700)] text-base leading-relaxed mb-6">
        You can begin again shortly. Your passage is kept.
      </p>
      {!canRetry && (
        <p className="font-body text-[var(--stone-700)] text-sm mb-6">
          Try again in {minutes}m {seconds}s.
        </p>
      )}
      {canRetry && (
        <button
          onClick={onRetry}
          className="bg-[var(--sage-500)] hover:bg-[var(--sage-700)] text-[var(--stone-50)] text-sm font-semibold tracking-[0.12em] uppercase px-6 py-3 rounded-md transition-colors min-h-[44px]"
        >
          Try again
        </button>
      )}
    </>
  );
}

export function ErrorState({ kind, retryAt, markdown, onRetry, onSaveAgain }: ErrorStateProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!markdown) return;
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard write failed silently
    }
  };

  return (
    <div
      aria-live="assertive"
      style={{ animation: 'authFadeIn 400ms ease-out both' }}
    >
      {kind === 'error-rate-limited' && (
        <RateLimitedContent retryAt={retryAt} onRetry={onRetry} />
      )}

      {kind === 'error-invalid-key' && (
        <>
          <p className="text-[var(--stone-700)] text-xs font-semibold tracking-[0.2em] uppercase mb-4">
            Your Key Needs a Refresh
          </p>
          <h2 className="font-display text-[var(--stone-900)] text-2xl md:text-3xl italic mb-4">
            We couldn&apos;t read your Anthropic key.
          </h2>
          <p className="font-body text-[var(--stone-700)] text-base leading-relaxed mb-6">
            Your passage is kept here. Re-enter your key and come back.
          </p>
          <Link
            href="/settings?tab=api-key"
            className="inline-block bg-[var(--sage-500)] hover:bg-[var(--sage-700)] text-[var(--stone-50)] text-sm font-semibold tracking-[0.12em] uppercase px-6 py-3 rounded-md transition-colors min-h-[44px]"
          >
            Update your key
          </Link>
        </>
      )}

      {kind === 'error-stream-aborted' && (
        <>
          <p className="text-[var(--stone-700)] text-xs font-semibold tracking-[0.2em] uppercase mb-4">
            The Line Dropped
          </p>
          <h2 className="font-display text-[var(--stone-900)] text-2xl md:text-3xl italic mb-4">
            Koinar was mid-thought.
          </h2>
          <p className="font-body text-[var(--stone-700)] text-base leading-relaxed mb-6">
            Your passage is still here.
          </p>
          <button
            onClick={onRetry}
            className="bg-[var(--sage-500)] hover:bg-[var(--sage-700)] text-[var(--stone-50)] text-sm font-semibold tracking-[0.12em] uppercase px-6 py-3 rounded-md transition-colors min-h-[44px]"
          >
            Try again
          </button>
        </>
      )}

      {kind === 'error-save-failed' && (
        <>
          <p className="text-[var(--stone-700)] text-xs font-semibold tracking-[0.2em] uppercase mb-4">
            Almost There
          </p>
          <h2 className="font-display text-[var(--stone-900)] text-2xl md:text-3xl italic mb-4">
            Your study generated, but we couldn&apos;t save it.
          </h2>
          <p className="font-body text-[var(--stone-700)] text-base leading-relaxed mb-6">
            You can try saving again, or copy the text below.
          </p>
          <div className="flex flex-wrap gap-3 mb-6">
            {onSaveAgain && (
              <button
                onClick={onSaveAgain}
                className="bg-[var(--sage-500)] hover:bg-[var(--sage-700)] text-[var(--stone-50)] text-sm font-semibold tracking-[0.12em] uppercase px-6 py-3 rounded-md transition-colors min-h-[44px]"
              >
                Save again
              </button>
            )}
            <button
              onClick={handleCopy}
              aria-label="Copy the study to clipboard"
              className="border border-[var(--stone-300)] text-[var(--stone-700)] hover:text-[var(--stone-900)] text-sm font-semibold tracking-[0.12em] uppercase px-6 py-3 rounded-md transition-colors min-h-[44px]"
            >
              {copied ? 'Copied!' : 'Copy the study'}
            </button>
          </div>
          {markdown && (
            <pre className="font-body text-sm text-[var(--stone-700)] bg-white border border-[var(--stone-200)] rounded p-4 max-h-96 overflow-y-auto whitespace-pre-wrap break-words">
              {markdown}
            </pre>
          )}
        </>
      )}
    </div>
  );
}
