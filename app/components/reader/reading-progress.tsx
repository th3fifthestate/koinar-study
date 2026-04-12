'use client';

import { useEffect, useState } from 'react';
import { motion, useScroll, useReducedMotion } from 'framer-motion';

export function ReadingProgress() {
  const { scrollYProgress } = useScroll();
  const prefersReducedMotion = useReducedMotion();
  const [staticProgress, setStaticProgress] = useState(0);

  // For reduced-motion users, track scroll progress without animation
  useEffect(() => {
    if (!prefersReducedMotion) return;
    function handleScroll() {
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (scrollHeight > 0) {
        setStaticProgress(window.scrollY / scrollHeight);
      }
    }
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, [prefersReducedMotion]);

  if (prefersReducedMotion) {
    return (
      <div
        className="fixed top-0 left-0 right-0 z-50 h-[2px] bg-[var(--sage-500)]"
        style={{ width: `${staticProgress * 100}%` }}
      />
    );
  }

  return (
    <motion.div
      className="fixed top-0 left-0 right-0 z-50 h-[2px] origin-left bg-[var(--sage-500)]"
      style={{ scaleX: scrollYProgress }}
    />
  );
}
