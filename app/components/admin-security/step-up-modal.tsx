'use client';

// components/admin-security/step-up-modal.tsx
//
// Modal shown when the admin needs to pass a TOTP (or backup-code) challenge
// before /api/study/generate will hand out the platform Anthropic key.
//
// Two modes, toggled by a small link below the input:
//   - TOTP (default) — 6-digit numeric code from an authenticator app.
//   - Backup — 20-hex-char recovery code (spaces/hyphens tolerated).
//
// On success: calls onVerified() with the new step-up expiry so the parent
// can retry the original request and/or display a countdown.
// On cancel: calls onCancel(). Parent decides whether to close or disable
// the feature.

import { useEffect, useRef, useState } from 'react';

type Mode = 'totp' | 'backup';

interface Props {
  onVerified: (expiresAt: string | null) => void;
  onCancel: () => void;
}

export function StepUpModal({ onVerified, onCancel }: Props) {
  const [mode, setMode] = useState<Mode>('totp');
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Focus on mount and whenever mode flips (fresh input each time).
  useEffect(() => {
    inputRef.current?.focus();
  }, [mode]);

  // Reset error and code when the admin flips modes — stale 6-digit value
  // makes zero sense in the backup-code input and vice versa.
  function switchMode(next: Mode) {
    if (next === mode) return;
    setMode(next);
    setCode('');
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    const trimmed = code.trim();
    if (!trimmed) {
      setError('Enter your code.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/step-up/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: trimmed }),
      });
      if (res.status === 429) {
        setError('Too many attempts. Try again in a minute.');
        return;
      }
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? 'Verification failed.');
        return;
      }
      const body = (await res.json()) as { expiresAt: string | null };
      onVerified(body.expiresAt);
    } catch {
      setError('Network error. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-labelledby="step-up-title"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 px-4"
    >
      <div className="w-full max-w-md rounded-lg bg-stone-50 p-6 shadow-xl">
        <h2
          id="step-up-title"
          className="font-display text-2xl font-normal text-stone-900"
        >
          Unlock admin mode
        </h2>
        <p className="mt-2 font-body text-sm text-stone-600">
          {mode === 'totp'
            ? 'Enter the 6-digit code from your authenticator app.'
            : 'Enter one of your one-time backup codes.'}
        </p>

        <form onSubmit={handleSubmit} className="mt-6">
          <label htmlFor="step-up-code" className="sr-only">
            {mode === 'totp' ? 'Authenticator code' : 'Backup code'}
          </label>
          <input
            id="step-up-code"
            ref={inputRef}
            type="text"
            inputMode={mode === 'totp' ? 'numeric' : 'text'}
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            disabled={submitting}
            maxLength={mode === 'totp' ? 6 : 40}
            placeholder={mode === 'totp' ? '123456' : 'abcd-ef01-...'}
            className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 font-body text-base text-stone-900 placeholder:text-stone-400 focus:border-sage-500 focus:outline-none focus:ring-1 focus:ring-sage-500 disabled:opacity-50"
          />

          {error && (
            <p
              role="alert"
              className="mt-2 font-body text-sm text-red-700"
            >
              {error}
            </p>
          )}

          <div className="mt-5 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => switchMode(mode === 'totp' ? 'backup' : 'totp')}
              disabled={submitting}
              className="font-body text-sm text-sage-700 underline underline-offset-2 hover:text-sage-900 disabled:opacity-50"
            >
              {mode === 'totp' ? 'Use a backup code' : 'Use your authenticator'}
            </button>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onCancel}
                disabled={submitting}
                className="font-body text-sm px-4 py-2 rounded-md text-stone-600 hover:text-stone-900 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="font-body text-sm font-semibold uppercase tracking-[0.08em] px-4 py-2 rounded-md bg-sage-500 hover:bg-sage-700 text-stone-50 disabled:opacity-50"
              >
                {submitting ? 'Checking…' : 'Unlock'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
