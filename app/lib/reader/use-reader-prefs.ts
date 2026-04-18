'use client';

import { useState, useEffect, useCallback } from 'react';

const PREFS_KEY = 'koinar:reader:prefs';
const LEGACY_FONT_SIZE_KEY = 'koinar:reader:fontSize';

export interface ReaderPrefs {
  fontSize: 'small' | 'medium' | 'large';
  mode?: 'dark' | 'light' | 'sepia'; // 28c will write this; 28b leaves undefined
  annotationFullContextHeight?: number; // px integer, H4 spec
}

const DEFAULT_PREFS: ReaderPrefs = { fontSize: 'medium' };

const VALID_FONT_SIZES = new Set<string>(['small', 'medium', 'large']);

let _storageErrorLogged = false;

function readPrefsFromStorage(): ReaderPrefs | null {
  try {
    // Migrate legacy fontSize key if present
    const legacySize = localStorage.getItem(LEGACY_FONT_SIZE_KEY);
    if (legacySize !== null) {
      const migratedPrefs: ReaderPrefs = {
        ...DEFAULT_PREFS,
        ...(VALID_FONT_SIZES.has(legacySize)
          ? { fontSize: legacySize as ReaderPrefs['fontSize'] }
          : {}),
      };
      // Read existing new prefs first (if any) and merge
      const existingRaw = localStorage.getItem(PREFS_KEY);
      const existing: Partial<ReaderPrefs> = existingRaw
        ? (JSON.parse(existingRaw) as Partial<ReaderPrefs>)
        : {};
      const merged: ReaderPrefs = { ...DEFAULT_PREFS, ...existing, ...migratedPrefs };
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

    return { ...DEFAULT_PREFS, ...parsed, fontSize };
  } catch (err) {
    if (!_storageErrorLogged) {
      console.warn('[useReaderPrefs] localStorage read failed:', err);
      _storageErrorLogged = true;
    }
    return null;
  }
}

function writePrefsToStorage(prefs: ReaderPrefs): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch (err) {
    if (!_storageErrorLogged) {
      console.warn('[useReaderPrefs] localStorage write failed:', err);
      _storageErrorLogged = true;
    }
  }
}

export function useReaderPrefs(): {
  prefs: ReaderPrefs;
  setFontSize: (size: 'small' | 'medium' | 'large') => void;
  setAnnotationFullContextHeight: (px: number) => void;
  resetPrefs: () => void;
} {
  const [prefs, setPrefs] = useState<ReaderPrefs>(DEFAULT_PREFS);

  // Read from localStorage on first client mount only (avoids SSR mismatch).
  useEffect(() => {
    const stored = readPrefsFromStorage();
    if (stored !== null) {
      setPrefs(stored);
    }
  }, []);

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
        setPrefs({ ...DEFAULT_PREFS, ...parsed, fontSize });
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
      writePrefsToStorage(next);
      return next;
    });
  }, []);

  const setAnnotationFullContextHeight = useCallback((px: number) => {
    setPrefs((prev) => {
      const next = { ...prev, annotationFullContextHeight: px };
      writePrefsToStorage(next);
      return next;
    });
  }, []);

  const resetPrefs = useCallback(() => {
    try {
      localStorage.removeItem(PREFS_KEY);
    } catch {
      // ignore
    }
    setPrefs(DEFAULT_PREFS);
  }, []);

  return { prefs, setFontSize, setAnnotationFullContextHeight, resetPrefs };
}
