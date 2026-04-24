import { useState, useEffect } from 'react';
import { bucketForHour, GRADIENT_OPACITY, type TodBucket } from '@/lib/home/tod-bucket';
import { getReaderPalette } from './reader-tones';

export function useTodPalette(mode: 'dark' | 'light' | 'sepia' = 'dark') {
  const [bucket, setBucket] = useState<TodBucket>('evening'); // SSR-safe default
  useEffect(() => {
    setBucket(bucketForHour(new Date().getHours()));
  }, []);
  const palette = getReaderPalette(bucket, mode);
  const gradientOpacity = GRADIENT_OPACITY[bucket];
  return { bucket, palette, gradientOpacity };
}
