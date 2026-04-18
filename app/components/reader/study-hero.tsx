'use client';

import { useRef, useState, useEffect } from 'react';
import Image from 'next/image';
import { motion, useScroll, useTransform, useReducedMotion } from 'framer-motion';
import { useTodPalette } from '@/lib/reader/use-tod-palette';
import { READER_MOTION_HERO_MOOD } from '@/lib/motion/reader';
import type { TodBucket } from '@/lib/home/tod-bucket';

/** Top scrim opacity keyed by time-of-day bucket. */
const TOP_SCRIM_OPACITY: Record<TodBucket, number> = {
  dawn:    0.04,
  morning: 0.02,
  midday:  0.03,
  golden:  0.08,
  evening: 0.10,
  night:   0.12,
};

interface StudyHeroProps {
  imageUrl: string;
  title: string;
  heroNeedsScrim?: boolean;
}

export function StudyHero({ imageUrl, title, heroNeedsScrim }: StudyHeroProps) {
  const ref = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end start'],
  });
  const y = useTransform(scrollYProgress, [0, 1], [0, 150]);
  const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  // TOD palette for bottom vignette gradient opacity
  const { bucket, gradientOpacity } = useTodPalette();

  // Mount transition: overlays fade from opacity 0 → final value on first paint
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(id);
  }, []);

  const transitionStyle = prefersReducedMotion
    ? undefined
    : { transition: `opacity ${READER_MOTION_HERO_MOOD.duration}ms ${READER_MOTION_HERO_MOOD.easing}` };

  // Bottom vignette: stone-900 rgba keyed off gradientOpacity
  const vignetteOpacity = mounted ? 1 : 0;

  // Top scrim: TOD-keyed, with heroNeedsScrim floor at 0.20
  const rawScrimOpacity = TOP_SCRIM_OPACITY[bucket];
  const finalScrimOpacity = heroNeedsScrim
    ? Math.max(0.20, rawScrimOpacity)
    : rawScrimOpacity;

  return (
    <div
      ref={ref}
      className="relative h-[40vh] min-h-[300px] overflow-hidden md:h-[60vh] md:min-h-[400px]"
    >
      <motion.div
        style={prefersReducedMotion ? undefined : { y }}
        className="absolute inset-0"
      >
        <Image
          src={imageUrl}
          alt={`Hero image for ${title}`}
          fill
          sizes="100vw"
          priority
          className="object-cover"
          style={
            prefersReducedMotion
              ? undefined
              : { animation: 'kenBurns 30s ease-in-out infinite alternate' }
          }
        />
      </motion.div>

      {/* Top scrim — seats title against image */}
      <div
        className="absolute inset-x-0 top-0 h-[40%] pointer-events-none"
        style={{
          background: `linear-gradient(to bottom, rgba(28,25,23,${finalScrimOpacity}) 0%, rgba(28,25,23,0) 100%)`,
          opacity: mounted ? 1 : 0,
          ...transitionStyle,
        }}
      />

      {/* Bottom vignette — scroll-linked opacity + TOD gradient opacity */}
      <motion.div
        style={prefersReducedMotion ? undefined : { opacity }}
        className="absolute inset-x-0 bottom-0 h-[40%] pointer-events-none"
      >
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(to top, rgba(28,25,23,${gradientOpacity}) 0%, rgba(28,25,23,0) 100%)`,
            opacity: vignetteOpacity,
            ...transitionStyle,
          }}
        />
      </motion.div>
    </div>
  );
}
