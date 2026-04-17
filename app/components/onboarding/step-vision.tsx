"use client";
import { motion } from 'framer-motion';

interface StepVisionProps {
  onNext: () => void;
  onBack: () => void;
}

export function StepVision({ onNext, onBack }: StepVisionProps) {
  return (
    <div className="text-center">
      <motion.h2
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7 }}
        className="font-serif text-4xl sm:text-5xl md:text-6xl leading-[1.1] tracking-tight"
        style={{ fontFamily: '"Bodoni Moda", "Bodoni 72", Georgia, serif', fontWeight: 500 }}
      >
        Scripture, studied
        <br />
        <em className="italic text-primary">in full context.</em>
      </motion.h2>

      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.6 }}
        className="mt-8 text-base sm:text-lg text-muted-foreground leading-relaxed max-w-lg mx-auto"
      >
        No verse pulled out of place. No teaching without its setting.
        Every passage is traced back to its chapter, its book, its original language,
        and the whole story of Scripture.
      </motion.p>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9 }}
        className="mt-6 text-sm text-muted-foreground/70 italic"
      >
        Reading is first-class. There is no pressure to contribute.
      </motion.p>

      <div className="mt-12 flex items-center justify-center gap-4">
        <button
          onClick={onBack}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Back
        </button>
        <button
          onClick={onNext}
          className="rounded-full bg-primary px-8 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Show me a study
        </button>
      </div>
    </div>
  );
}
