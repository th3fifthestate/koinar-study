"use client";
import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { StepWelcome } from './step-welcome';
import { StepVision } from './step-vision';
import { StepStudy } from './step-study';
import { StepReady } from './step-ready';
import { OnboardingBackdrop } from './onboarding-backdrop';
import { ProgressDots } from './progress-dots';

const TOTAL_STEPS = 4;

interface OnboardingFlowProps {
  username: string;
  inviterName?: string;
  linkedStudySlug?: string;
  linkedStudyTitle?: string;
}

export function OnboardingFlow({ username, inviterName, linkedStudySlug, linkedStudyTitle }: OnboardingFlowProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [isCompleting, setIsCompleting] = useState(false);
  const [completionError, setCompletionError] = useState<string | null>(null);
  const router = useRouter();
  const reduceMotion = useReducedMotion();

  const nextStep = useCallback(() => {
    setDirection(1);
    setCurrentStep((prev) => Math.min(prev + 1, TOTAL_STEPS - 1));
  }, []);

  const prevStep = useCallback(() => {
    setDirection(-1);
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  }, []);

  const finish = useCallback(async () => {
    if (isCompleting) return;
    setIsCompleting(true);
    setCompletionError(null);
    try {
      const res = await fetch('/api/user/onboarding-complete', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to complete onboarding');
      router.push('/');
      router.refresh();
    } catch {
      // Stay on the page so the user can retry; middleware would otherwise
      // bounce them straight back here with no feedback.
      setCompletionError('Something went wrong. Please try again.');
      setIsCompleting(false);
    }
  }, [isCompleting, router]);

  const steps = [
    <StepWelcome
      key="welcome"
      username={username}
      inviterName={inviterName}
      linkedStudyTitle={linkedStudyTitle}
      onNext={nextStep}
    />,
    <StepVision key="vision" onNext={nextStep} onBack={prevStep} />,
    <StepStudy
      key="study"
      linkedStudySlug={linkedStudySlug}
      linkedStudyTitle={linkedStudyTitle}
      onNext={nextStep}
      onBack={prevStep}
    />,
    <StepReady
      key="ready"
      onComplete={finish}
      onBack={prevStep}
      isCompleting={isCompleting}
    />,
  ];

  const slideDistance = reduceMotion ? 0 : 300;
  const slideVariants = {
    enter: (dir: number) => ({ x: dir > 0 ? slideDistance : -slideDistance, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? -slideDistance : slideDistance, opacity: 0 }),
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden py-12">
      <OnboardingBackdrop />

      <button
        onClick={finish}
        disabled={isCompleting}
        aria-busy={isCompleting}
        className="absolute top-6 right-6 z-20 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors disabled:opacity-40 disabled:cursor-wait"
      >
        {isCompleting ? 'Finishing…' : 'Skip'}
      </button>

      <div className="relative z-10 w-full max-w-2xl px-6">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentStep}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: reduceMotion ? 0.15 : 0.4, ease: 'easeInOut' }}
          >
            {steps[currentStep]}
          </motion.div>
        </AnimatePresence>
      </div>

      {completionError && (
        <p
          role="alert"
          className="relative z-10 mt-6 text-sm text-destructive"
        >
          {completionError}
        </p>
      )}

      <div className="relative z-10 mt-12">
        <ProgressDots total={TOTAL_STEPS} current={currentStep} />
      </div>
    </div>
  );
}
