'use client';

import { useState, useEffect } from 'react';
import type { TranslationInfo } from '@/lib/translations/registry';

interface TranslationSelectorProps {
  currentTranslation: string;
  onSelect: (translation: string) => void;
  disabled?: boolean;
}

export function TranslationSelector({
  currentTranslation,
  onSelect,
  disabled = false,
}: TranslationSelectorProps) {
  const [translations, setTranslations] = useState<TranslationInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/translations')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { translations?: TranslationInfo[] } | null) => {
        if (data?.translations) setTranslations(data.translations);
      })
      .catch(() => { /* silent — falls back to BSB only */ })
      .finally(() => setLoading(false));
  }, []);

  if (loading || translations.length <= 1) return null;

  return (
    <div className="flex items-center gap-2 text-sm">
      <label
        htmlFor="translation-select"
        className="text-muted-foreground text-xs uppercase tracking-wide"
      >
        Translation
      </label>
      <select
        id="translation-select"
        value={currentTranslation}
        disabled={disabled}
        onChange={(e) => onSelect(e.target.value)}
        className="rounded border border-input bg-background px-2 py-1 text-sm text-foreground disabled:opacity-50 focus:outline-none focus:ring-1 focus:ring-ring"
      >
        {translations.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}{!t.isInstant ? ' ↻' : ''}
          </option>
        ))}
      </select>
    </div>
  );
}
