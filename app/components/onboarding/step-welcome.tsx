"use client";
import { motion } from 'framer-motion';
import { ProtocolVisual } from './protocol-visual';

interface StepWelcomeProps {
  username: string;
  inviterName?: string;
  linkedStudyTitle?: string;
  onNext: () => void;
}

export function StepWelcome({ username, inviterName, linkedStudyTitle, onNext }: StepWelcomeProps) {
  const isInvited = Boolean(inviterName);
  const headline = isInvited ? `Welcome, ${username}` : `Welcome to Koinar, ${username}`;
  const personalLine = isInvited
    ? linkedStudyTitle
      ? `${inviterName} wants to study ${linkedStudyTitle} with you.`
      : `${inviterName} invited you into this space.`
    : 'We kept a seat for you. Take your time — reading is first-class here.';

  return (
    <div className="text-center">
      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-4xl font-bold tracking-tight sm:text-5xl"
      >
        {headline}
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="mt-6 text-lg text-muted-foreground leading-relaxed max-w-lg mx-auto"
      >
        This is a community where Scripture is studied deeply, contextually, and together.
        Every verse is read in its full context — never quoted in isolation.
      </motion.p>

      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="mt-4 text-sm text-muted-foreground/80 italic"
      >
        {personalLine}
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        className="mt-10"
      >
        <p className="mb-4 text-sm font-medium text-muted-foreground">
          Every study follows a 7-step contextual analysis:
        </p>
        <ProtocolVisual />
      </motion.div>

      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2 }}
        onClick={onNext}
        className="mt-10 rounded-full bg-primary px-8 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        See how it works
      </motion.button>
    </div>
  );
}
