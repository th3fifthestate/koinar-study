"use client";
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Loader2 } from 'lucide-react';

interface StepReadyProps {
  onComplete: () => void;
  onBack: () => void;
  isCompleting?: boolean;
}

export function StepReady({ onComplete, onBack, isCompleting = false }: StepReadyProps) {
  const reduceMotion = useReducedMotion();
  const scaleTransition = reduceMotion
    ? { duration: 0.15 }
    : { type: 'spring' as const, stiffness: 200, damping: 15, delay: 0.2 };
  const textDelay = (base: number) => (reduceMotion ? 0 : base);

  return (
    <div className="text-center">
      <motion.div
        initial={{ scale: reduceMotion ? 1 : 0 }}
        animate={{ scale: 1 }}
        transition={scaleTransition}
        className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10"
      >
        <span className="text-4xl" role="img" aria-label="Open book">📖</span>
      </motion.div>

      <motion.h2
        initial={{ opacity: 0, y: reduceMotion ? 0 : 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: textDelay(0.4) }}
        className="text-3xl font-bold sm:text-4xl"
      >
        You&apos;re in.
      </motion.h2>

      <motion.p
        initial={{ opacity: 0, y: reduceMotion ? 0 : 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: textDelay(0.6) }}
        className="mt-4 text-muted-foreground leading-relaxed max-w-md mx-auto"
      >
        Every verse in its full context. Every word traced back to the original Hebrew and Greek.
        Welcome to a deeper way of studying Scripture together.
      </motion.p>

      <div className="mt-10 flex items-center justify-center gap-4">
        <button
          onClick={onBack}
          disabled={isCompleting}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Back
        </button>
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: textDelay(0.8) }}
          onClick={onComplete}
          disabled={isCompleting}
          aria-busy={isCompleting}
          className="group flex items-center gap-2 rounded-full bg-primary px-10 py-4 text-base font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-70 disabled:cursor-wait"
        >
          {isCompleting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Entering…
            </>
          ) : (
            <>
              Enter the library
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </>
          )}
        </motion.button>
      </div>
    </div>
  );
}
