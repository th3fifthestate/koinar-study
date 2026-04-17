'use client';

import { useState, useRef, useEffect } from 'react';
import type { UserSettings } from '@/lib/db/types';

interface Props { settings: UserSettings; }

export function ApiKeyTab({ settings }: Props) {
  const [apiKey, setApiKey] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleteArmed, setDeleteArmed] = useState(false);
  const [deleteStatus, setDeleteStatus] = useState<'idle' | 'deleting' | 'error'>('idle');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [hasKey, setHasKey] = useState(settings.hasApiKey);
  const [keyTail, setKeyTail] = useState(settings.apiKeyTail);
  const [keyUpdatedAt, setKeyUpdatedAt] = useState(settings.apiKeyUpdatedAt);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const armTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset armed state after 4s (prevents accidental delete)
  useEffect(() => {
    if (!deleteArmed) return;
    armTimerRef.current = setTimeout(() => setDeleteArmed(false), 4000);
    return () => { if (armTimerRef.current) clearTimeout(armTimerRef.current); };
  }, [deleteArmed]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaveStatus('saving');
    setSaveError(null);
    try {
      const res = await fetch('/api/user/api-key', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? 'Failed to save key');
      }
      setHasKey(true);
      setKeyTail(apiKey.slice(-4));
      setKeyUpdatedAt(new Date().toISOString());
      setApiKey('');
      setSaveStatus('saved');
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err) {
      setSaveStatus('error');
      setSaveError(err instanceof Error ? err.message : 'Something went wrong');
    }
  }

  async function handleDelete() {
    if (!deleteArmed) {
      setDeleteArmed(true);
      return;
    }
    // Second click — confirmed
    setDeleteArmed(false);
    if (armTimerRef.current) clearTimeout(armTimerRef.current);
    setDeleteStatus('deleting');
    setDeleteError(null);
    try {
      const res = await fetch('/api/user/api-key', { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? 'Failed to delete key');
      }
      setHasKey(false);
      setKeyTail(null);
      setKeyUpdatedAt(null);
      setDeleteStatus('idle');
    } catch (err) {
      setDeleteStatus('error');
      setDeleteError(err instanceof Error ? err.message : 'Something went wrong');
    }
  }

  return (
    <div className="space-y-8 max-w-lg">
      <div>
        <h2 className="font-display text-xl font-normal text-stone-900 mb-4">
          Anthropic API key
        </h2>

        {hasKey && keyTail && (
          <div className="mb-4 p-3 bg-stone-100 rounded font-body text-base text-stone-700">
            Key on file — ends in{' '}
            <span className="font-mono">…{keyTail}</span>
            {keyUpdatedAt && (
              <span className="text-stone-500">
                {', last updated '}
                {new Date(keyUpdatedAt).toLocaleDateString(undefined, {
                  month: 'short', day: 'numeric', year: 'numeric',
                })}
              </span>
            )}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label htmlFor="apiKey" className="block font-body text-base text-stone-700 mb-1">
              {hasKey ? 'Replace key' : 'Paste your key'}
            </label>
            <input
              id="apiKey"
              type="password"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              placeholder="sk-ant-…"
              className="w-full border border-stone-300 rounded px-3 py-2 font-body text-base font-mono text-stone-900 focus:outline-none focus:border-sage-500"
            />
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            <button
              type="submit"
              disabled={!apiKey || saveStatus === 'saving'}
              className="font-body text-base text-sage-700 underline underline-offset-2 hover:text-sage-900 transition-colors disabled:opacity-50"
            >
              {saveStatus === 'saving' ? 'Saving…' : 'Save key'}
            </button>

            {saveStatus === 'saved' && (
              <span className="font-body text-base text-stone-500" aria-live="polite">
                Saved.
              </span>
            )}

            {hasKey && (
              <button
                type="button"
                onClick={handleDelete}
                onBlur={() => { setDeleteArmed(false); }}
                disabled={deleteStatus === 'deleting'}
                className="font-body text-base text-red-600 underline underline-offset-2 hover:text-red-800 transition-colors disabled:opacity-50"
              >
                {deleteArmed ? 'Are you sure? Click to confirm' : 'Delete key'}
              </button>
            )}
          </div>

          {saveError && (
            <p role="alert" aria-live="assertive" className="font-body text-sm text-red-600">
              {saveError}
            </p>
          )}
          {deleteError && (
            <p role="alert" aria-live="assertive" className="font-body text-sm text-red-600">
              {deleteError}
            </p>
          )}
        </form>
      </div>

      {/* Cost guidance — editorial tone, not a warning box */}
      <div className="border-t border-stone-200 pt-6">
        <p className="font-body text-base leading-relaxed text-stone-600">
          Koinar uses your Anthropic account to write studies. A standard study costs roughly
          $0.30 – $0.60 depending on length and model. Comprehensive studies may run up
          to ~$1.50. You'll see the exact cost after each generation.
        </p>
        <a
          href="https://console.anthropic.com/settings/keys"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-block font-body text-base text-sage-700 underline underline-offset-2 hover:text-sage-900 transition-colors"
        >
          Get a key from the Anthropic console →
        </a>
      </div>
    </div>
  );
}
