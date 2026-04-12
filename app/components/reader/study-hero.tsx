'use client';

import { useRef } from 'react';
import { motion, useScroll, useTransform, useReducedMotion } from 'framer-motion';

interface StudyHeroProps {
  imageUrl: string;
  title: string;
}

export function StudyHero({ imageUrl, title }: StudyHeroProps) {
  const ref = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end start'],
  });
  const y = useTransform(scrollYProgress, [0, 1], [0, 150]);
  const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  return (
    <div
      ref={ref}
      className="relative h-[40vh] min-h-[300px] overflow-hidden md:h-[60vh] md:min-h-[400px]"
    >
      <motion.div
        style={prefersReducedMotion ? undefined : { y }}
        className="absolute inset-0"
      >
        <img
          src={imageUrl}
          alt={`Hero image for ${title}`}
          className="h-full w-full object-cover"
          style={
            prefersReducedMotion
              ? undefined
              : { animation: 'kenBurns 30s ease-in-out infinite alternate' }
          }
        />
      </motion.div>
      <motion.div
        style={prefersReducedMotion ? undefined : { opacity }}
        className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent"
      />
    </div>
  );
}
