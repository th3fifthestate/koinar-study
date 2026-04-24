"use client";
import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { SampleStudyEmbed } from './sample-study-embed';

interface StepStudyProps {
  linkedStudySlug?: string;
  linkedStudyTitle?: string;
  onNext: () => void;
  onBack: () => void;
}

export function StepStudy({ linkedStudySlug, linkedStudyTitle, onNext, onBack }: StepStudyProps) {
  const [hasScrolled, setHasScrolled] = useState(false);
  const hasRealStudy = Boolean(linkedStudySlug && linkedStudyTitle);

  return (
    <div className="text-center">
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-2xl font-bold sm:text-3xl"
      >
        {hasRealStudy ? linkedStudyTitle : 'This is what a study looks like'}
      </motion.h2>

      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mt-3 text-sm text-muted-foreground"
      >
        Scroll through this excerpt to see the depth of analysis.
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="mt-6"
      >
        <SampleStudyEmbed onScroll={() => setHasScrolled(true)} />
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: hasScrolled ? 1 : 0 }}
        className="mt-4 space-y-2"
      >
        <p className="text-xs text-muted-foreground max-w-lg mx-auto">
          Notice the original Greek and Hebrew insights, cross-references connecting the whole Bible,
          and contextual analysis for every passage.
        </p>
        <div className="inline-flex items-start gap-2 rounded-md bg-[var(--secondary)] dark:bg-[var(--secondary)]/30 px-3 py-1.5 text-xs text-[var(--sage-700)] dark:text-[var(--sage-300)] max-w-lg text-left">
          <span className="text-base leading-none">{'\u26F0\uFE0F'}</span>
          <span>
            The mountain icon marks information drawn from historical records, not the biblical text itself.
          </span>
        </div>
      </motion.div>

      <div className="mt-8 flex items-center justify-center gap-4 flex-wrap">
        <button
          onClick={onBack}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Back
        </button>
        {hasRealStudy && (
          <Link
            href={`/study/${linkedStudySlug}`}
            target="_blank"
            className="text-sm underline text-muted-foreground hover:text-foreground transition-colors"
          >
            Open full study
          </Link>
        )}
        <button
          onClick={onNext}
          className="rounded-full bg-primary px-8 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
