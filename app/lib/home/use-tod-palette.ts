'use client';

import { useState, useEffect } from 'react';
import { bucketForHour, GRADIENT_OPACITY, type TodBucket } from '@/lib/home/tod-bucket';

/**
 * Time-of-day palette hook for the home hero.
 *
 * Returns the current TOD bucket (dawn / morning / midday / golden /
 * evening / night) and the matching gradient-opacity for the bottom
 * vignette. SSR-safe — defaults to `evening` until hydrated.
 *
 * Lives under `lib/home/` because only the home hero consumes it. The
 * reader's editorial redesign dropped TOD entirely; if you find another
 * surface that wants TOD-aware visuals, copy this hook rather than
 * coupling that surface to home internals.
 */
export function useTodPalette() {
  const [bucket, setBucket] = useState<TodBucket>('evening');
  useEffect(() => {
    setBucket(bucketForHour(new Date().getHours()));
  }, []);
  const gradientOpacity = GRADIENT_OPACITY[bucket];
  return { bucket, gradientOpacity };
}
