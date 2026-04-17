'use client';

import { useState, useRef } from 'react';
import type { UserSettings } from '@/lib/db/types';

interface Props { settings: UserSettings; }

export function ProfileTab({ settings }: Props) {
  const [displayName, setDisplayName] = useState(settings.displayName ?? '');
  const [bio, setBio] = useState(settings.bio ?? '');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('saving');
    setError(null);
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName, bio }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? 'Failed to save');
      }
      setStatus('saved');
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setStatus('idle'), 3000);
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Something went wrong');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-lg">
      <div>
        <label htmlFor="displayName" className="block font-body text-base text-stone-700 mb-1">
          Display name
        </label>
        <input
          id="displayName"
          type="text"
          value={displayName}
          onChange={e => setDisplayName(e.target.value)}
          maxLength={80}
          required
          className="w-full border border-stone-300 rounded px-3 py-2 font-body text-base text-stone-900 focus:outline-none focus:border-sage-500"
        />
      </div>

      <div>
        <label htmlFor="bio" className="block font-body text-base text-stone-700 mb-1">
          Bio{' '}
          <span className="text-stone-400 text-sm">(optional)</span>
        </label>
        <textarea
          id="bio"
          value={bio}
          onChange={e => setBio(e.target.value)}
          maxLength={280}
          rows={4}
          className="w-full border border-stone-300 rounded px-3 py-2 font-body text-base text-stone-900 focus:outline-none focus:border-sage-500 resize-none"
        />
        <p className="mt-1 font-body text-sm text-stone-400" aria-live="polite">
          {bio.length}/280
        </p>
      </div>

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={status === 'saving'}
          className="font-body text-base text-sage-700 underline underline-offset-2 hover:text-sage-900 transition-colors disabled:opacity-50"
        >
          {status === 'saving' ? 'Saving…' : 'Save changes'}
        </button>
        {status === 'saved' && (
          <span className="font-body text-base text-stone-500" aria-live="polite">Saved.</span>
        )}
      </div>

      {error && (
        <p role="alert" aria-live="assertive" className="font-body text-sm text-red-600">
          {error}
        </p>
      )}
    </form>
  );
}
