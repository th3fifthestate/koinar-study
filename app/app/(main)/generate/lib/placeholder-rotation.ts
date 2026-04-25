'use client';

import { useEffect, useState } from 'react';
import type { Format } from '../types';

const PLACEHOLDERS_DEFAULT: readonly string[] = [
  'e.g. Romans 12:1-2',
  'e.g. The nature of forgiveness in Paul\u2019s letters',
  'e.g. Why does Jonah flee to Tarshish?',
  'e.g. Hebrews 11 \u2014 what faith meant to them',
  'e.g. The word hesed in the Hebrew Bible',
];

// Quick is a question-driven scripture-finder, so the placeholder rotation is
// question-only. The system prompt's safety rules forbid Quick from giving
// counsel; pointing the user toward a question-shaped prompt is the right
// affordance up-front.
const PLACEHOLDERS_QUICK: readonly string[] = [
  'Ask a question\u2026',
  'e.g. What does Scripture say about anxiety?',
  'e.g. How should I think about forgiveness?',
  'e.g. What does the Bible teach about suffering?',
  'e.g. Where does Scripture address anger?',
];

const ROTATION_INTERVAL_MS = 4000;

export function usePlaceholderRotation(enabled: boolean, format: Format = 'standard'): string {
  const [index, setIndex] = useState(0);

  const placeholders =
    format === 'quick' ? PLACEHOLDERS_QUICK : PLACEHOLDERS_DEFAULT;

  useEffect(() => {
    if (!enabled) return;
    // Reset to the first option when the format changes so the user sees the
    // lead-in placeholder ("Ask a question…" for Quick) before the rotation
    // continues.
    setIndex(0);

    const id = setInterval(() => {
      setIndex((prev) => (prev + 1) % placeholders.length);
    }, ROTATION_INTERVAL_MS);

    return () => clearInterval(id);
  }, [enabled, placeholders]);

  if (!enabled) return placeholders[0];
  return placeholders[index];
}
