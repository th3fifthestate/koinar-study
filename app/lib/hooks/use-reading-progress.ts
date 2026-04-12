'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export function useReadingProgress(slug: string) {
  const [progress, setProgress] = useState(0);
  const lastSaveRef = useRef(0);
  const slugRef = useRef(slug);
  slugRef.current = slug;

  const getStorageKey = useCallback(() => `reading-position-${slugRef.current}`, []);

  // Update progress on scroll
  useEffect(() => {
    let rafId: number;

    function onScroll() {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
        if (scrollHeight > 0) {
          setProgress(Math.min(1, window.scrollY / scrollHeight));
        }

        // Throttled save to localStorage (every 2s)
        const now = Date.now();
        if (now - lastSaveRef.current > 2000) {
          lastSaveRef.current = now;
          try {
            localStorage.setItem(getStorageKey(), String(window.scrollY));
          } catch {}
        }
      });
    }

    window.addEventListener('scroll', onScroll, { passive: true });

    // Save on unload
    function onBeforeUnload() {
      try {
        localStorage.setItem(getStorageKey(), String(window.scrollY));
      } catch {}
    }
    window.addEventListener('beforeunload', onBeforeUnload);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('beforeunload', onBeforeUnload);
      // Save on unmount
      try {
        localStorage.setItem(getStorageKey(), String(window.scrollY));
      } catch {}
    };
  }, [getStorageKey]);

  // Restore position on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const saved = localStorage.getItem(getStorageKey());
        if (saved) {
          const y = parseInt(saved, 10);
          if (!isNaN(y) && y > 0) {
            window.scrollTo(0, y);
          }
        }
      } catch {}
    }, 100);
    return () => clearTimeout(timer);
  }, [getStorageKey]);

  return progress;
}
