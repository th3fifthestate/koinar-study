'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { UserSettings } from '@/lib/db/types';

interface Props { settings: UserSettings; }

export function AccountTab({ settings }: Props) {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  function validate(): string | null {
    if (newPassword.length < 8) return 'New password must be at least 8 characters';
    if (newPassword !== confirmPassword) return 'Passwords do not match';
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validationError = validate();
    if (validationError) { setError(validationError); return; }

    setStatus('saving');
    setError(null);
    try {
      const res = await fetch('/api/user/password', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? 'Failed to update password');
      }
      // Session destroyed server-side; client redirect is UX polish on top
      router.push('/login?message=password-updated');
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Something went wrong');
    }
  }

  return (
    <div className="space-y-10 max-w-lg">
      <div>
        <p className="font-body text-base text-stone-500 mb-1">Email</p>
        <p className="font-body text-base text-stone-900">{settings.email}</p>
        <p className="mt-1 font-body text-sm text-stone-400">
          Email changes are not yet supported.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <h2 className="font-display text-xl font-normal text-stone-900">Change password</h2>

        <div>
          <label htmlFor="currentPassword" className="block font-body text-base text-stone-700 mb-1">
            Current password
          </label>
          <input
            id="currentPassword"
            type="password"
            value={currentPassword}
            onChange={e => setCurrentPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="w-full border border-stone-300 rounded px-3 py-2 font-body text-base text-stone-900 focus:outline-none focus:border-sage-500"
          />
        </div>

        <div>
          <label htmlFor="newPassword" className="block font-body text-base text-stone-700 mb-1">
            New password
          </label>
          <input
            id="newPassword"
            type="password"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            required
            autoComplete="new-password"
            aria-describedby={error ? 'password-error' : undefined}
            className="w-full border border-stone-300 rounded px-3 py-2 font-body text-base text-stone-900 focus:outline-none focus:border-sage-500"
          />
        </div>

        <div>
          <label htmlFor="confirmPassword" className="block font-body text-base text-stone-700 mb-1">
            Confirm new password
          </label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            required
            autoComplete="new-password"
            className="w-full border border-stone-300 rounded px-3 py-2 font-body text-base text-stone-900 focus:outline-none focus:border-sage-500"
          />
        </div>

        <button
          type="submit"
          disabled={status === 'saving'}
          className="font-body text-base text-sage-700 underline underline-offset-2 hover:text-sage-900 transition-colors disabled:opacity-50"
        >
          {status === 'saving' ? 'Updating…' : 'Update password'}
        </button>

        {error && (
          <p
            id="password-error"
            role="alert"
            aria-live="assertive"
            className="font-body text-sm text-red-600"
          >
            {error}
          </p>
        )}
      </form>
    </div>
  );
}
