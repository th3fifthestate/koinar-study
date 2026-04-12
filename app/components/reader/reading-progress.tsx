'use client';

import { motion, useScroll, useReducedMotion } from 'framer-motion';

export function ReadingProgress() {
  const { scrollYProgress } = useScroll();
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      className="fixed top-0 left-0 right-0 z-50 h-[2px] origin-left bg-[var(--sage-500)]"
      style={
        prefersReducedMotion
          ? { width: '0%' } // fallback — won't animate but won't break
          : { scaleX: scrollYProgress }
      }
    />
  );
}
