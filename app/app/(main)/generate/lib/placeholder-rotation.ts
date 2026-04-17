'use client';

import { useEffect, useState } from 'react';

const PLACEHOLDERS: readonly string[] = [
  'e.g. Romans 12:1-2',
  'e.g. The nature of forgiveness in Paul\u2019s letters',
  'e.g. Why does Jonah flee to Tarshish?',
  'e.g. Hebrews 11 \u2014 what faith meant to them',
  'e.g. The word hesed in the Hebrew Bible',
];

const ROTATION_INTERVAL_MS = 4000;

export function usePlaceholderRotation(enabled: boolean): string {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!enabled) return;

    const id = setInterval(() => {
      setIndex((prev) => (prev + 1) % PLACEHOLDERS.length);
    }, ROTATION_INTERVAL_MS);

    return () => clearInterval(id);
  }, [enabled]);

  if (!enabled) return PLACEHOLDERS[0];
  return PLACEHOLDERS[index];
}
