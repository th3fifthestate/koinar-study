'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

const PREFS_KEY = 'koinar:reader:prefs';
const LEGACY_FONT_SIZE_KEY = 'koinar:reader:fontSize';

export interface ReaderPrefs {
  fontSize: 'small' | 'medium' | 'large';
  mode?: 'dark' | 'light'; // light is default when undefined
  annotationFullContextHeight?: number; // px integer, H4 spec
}

const DEFAULT_PREFS: ReaderPrefs = { fontSize: 'medium' };

const VALID_FONT_SIZES = new Set<string>(['small', 'medium', 'large']);
const VALID_MODES = new Set<string>(['dark', 'light']);

function readPrefsFromStorage(onError: (err: unknown) => void): ReaderPrefs | null {
  try {
    // Migrate legacy fontSize key if present
    const legacySize = localStorage.getItem(LEGACY_FONT_SIZE_KEY);
    if (legacySize !== null) {
      const migratedPrefs: Partial<ReaderPrefs> = VALID_FONT_SIZES.has(legacySize)
        ? { fontSize: legacySize as ReaderPrefs['fontSize'] }
        : {};
      // Read existing new prefs first (if any) and merge — new key wins over legacy
      const existingRaw = localStorage.getItem(PREFS_KEY);
      const existing: Partial<ReaderPrefs> = existingRaw
        ? (JSON.parse(existingRaw) as Partial<ReaderPrefs>)
        : {};
      const merged: ReaderPrefs = { ...DEFAULT_PREFS, ...migratedPrefs, ...existing };
      localStorage.setItem(PREFS_KEY, JSON.stringify(merged));
      localStorage.removeItem(LEGACY_FONT_SIZE_KEY);
      return merged;
    }

    const raw = localStorage.getItem(PREFS_KEY);
    if (raw === null) return null;

    const parsed = JSON.parse(raw) as Partial<ReaderPrefs>;
    const fontSize =
      parsed.fontSize && VALID_FONT_SIZES.has(parsed.fontSize)
        ? parsed.fontSize
        : DEFAULT_PREFS.fontSize;
    const mode =
      parsed.mode && VALID_MODES.has(parsed.mode)
        ? (parsed.mode as ReaderPrefs['mode'])
        : undefined;

    return { ...DEFAULT_PREFS, ...parsed, fontSize, mode };
  } catch (err) {
    onError(err);
    return null;
  }
}

function writePrefsToStorage(prefs: ReaderPrefs, onError: (err: unknown) => void): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch (err) {
    onError(err);
  }
}

export function useReaderPrefs(): {
  prefs: ReaderPrefs;
  setFontSize: (size: 'small' | 'medium' | 'large') => void;
  setMode: (mode: 'dark' | 'light') => void;
  setAnnotationFullContextHeight: (px: number) => void;
  resetPrefs: () => void;
} {
  const [prefs, setPrefs] = useState<ReaderPrefs>(DEFAULT_PREFS);
  const storageErrorLoggedRef = useRef(false);

  const handleStorageError = useCallback((err: unknown) => {
    if (!storageErrorLoggedRef.current) {
      console.warn('[useReaderPrefs] localStorage error:', err);
      storageErrorLoggedRef.current = true;
    }
  }, []);

  // Read from localStorage on first client mount only (avoids SSR mismatch).
  useEffect(() => {
    const stored = readPrefsFromStorage(handleStorageError);
    if (stored !== null) {
      setPrefs(stored);
    }
  }, [handleStorageError]);

  // Cross-tab sync: listen for storage events from other tabs.
  useEffect(() => {
    function handleStorageEvent(e: StorageEvent) {
      if (e.key !== PREFS_KEY) return;
      if (e.newValue === null) {
        setPrefs(DEFAULT_PREFS);
        return;
      }
      try {
        const parsed = JSON.parse(e.newValue) as Partial<ReaderPrefs>;
        const fontSize =
          parsed.fontSize && VALID_FONT_SIZES.has(parsed.fontSize)
            ? parsed.fontSize
            : DEFAULT_PREFS.fontSize;
        const mode =
          parsed.mode && VALID_MODES.has(parsed.mode)
            ? (parsed.mode as ReaderPrefs['mode'])
            : undefined;
        setPrefs({ ...DEFAULT_PREFS, ...parsed, fontSize, mode });
      } catch {
        // Malformed value from another tab — ignore.
      }
    }

    window.addEventListener('storage', handleStorageEvent);
    return () => window.removeEventListener('storage', handleStorageEvent);
  }, []);

  const setFontSize = useCallback((size: 'small' | 'medium' | 'large') => {
    setPrefs((prev) => {
      const next = { ...prev, fontSize: size };
      writePrefsToStorage(next, handleStorageError);
      return next;
    });
  }, [handleStorageError]);

  const setMode = useCallback((mode: 'dark' | 'light') => {
    setPrefs((prev) => {
      const next = { ...prev, mode };
      writePrefsToStorage(next, handleStorageError);
      return next;
    });
  }, [handleStorageError]);

  const setAnnotationFullContextHeight = useCallback((px: number) => {
    setPrefs((prev) => {
      const next = { ...prev, annotationFullContextHeight: px };
      writePrefsToStorage(next, handleStorageError);
      return next;
    });
  }, [handleStorageError]);

  const resetPrefs = useCallback(() => {
    try {
      localStorage.removeItem(PREFS_KEY);
    } catch {
      // ignore
    }
    setPrefs(DEFAULT_PREFS);
  }, []);

  return { prefs, setFontSize, setMode, setAnnotationFullContextHeight, resetPrefs };
}
