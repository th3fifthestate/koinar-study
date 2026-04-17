"use client";
import { motion, useReducedMotion } from 'framer-motion';

const GRADIENT_A =
  'radial-gradient(ellipse at 30% 30%, rgba(251,191,36,0.08), transparent 60%), radial-gradient(ellipse at 70% 70%, rgba(217,119,6,0.06), transparent 60%)';
const GRADIENT_B =
  'radial-gradient(ellipse at 70% 30%, rgba(217,119,6,0.08), transparent 60%), radial-gradient(ellipse at 30% 70%, rgba(251,191,36,0.06), transparent 60%)';

export function OnboardingBackdrop() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {prefersReducedMotion ? (
        <div className="absolute inset-0" style={{ background: GRADIENT_A }} />
      ) : (
        <motion.div
          className="absolute inset-0"
          animate={{ background: [GRADIENT_A, GRADIENT_B] }}
          transition={{ duration: 15, repeat: Infinity, repeatType: 'reverse' }}
        />
      )}
    </div>
  );
}
