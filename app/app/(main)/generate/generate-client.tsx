'use client';
import { useState } from 'react';
import { useGenerateStream } from './hooks/use-generate-stream';
import type { Entitlement, Format } from './types';
import type { SessionData } from '@/lib/auth/session';
import { GenerateLede } from './components/generate-lede';
import { PromptField } from './components/prompt-field';
import { FormatCards } from './components/format-cards';
import { ContextLine } from './components/context-line';
import { RigorPanel } from './components/rigor-panel';
import { StreamingHold } from './components/streaming-hold';
import { CompletionCard } from './components/completion-card';
import { ErrorState } from './components/error-state';
import { NoEntitlement } from './components/no-entitlement';
import { CreditsBanner } from './components/credits-banner';
import { StepUpModal } from '@/components/admin-security/step-up-modal';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface GenerateClientProps {
  user: SessionData;
  entitlement: Entitlement;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GenerateClient({ user: _user, entitlement }: GenerateClientProps) {
  const [prompt, setPrompt] = useState('');
  const [format, setFormat] = useState<Format>('standard');

  const { state, submit, retry, resumeAfterStepUp, cancelStepUp } =
    useGenerateStream(entitlement);

  const handleSubmit = () => {
    submit(prompt, format);
  };

  const handleRetry = () => {
    retry(prompt, format);
  };

  const handleOpenStudy = (slug: string) => {
    window.location.href = `/study/${slug}`;
  };

  // ------------------------------------------------------------------
  // Step-up required (admin-only branch on /api/study/generate)
  // ------------------------------------------------------------------
  if (state.kind === 'needs-step-up') {
    const resumePrompt = state.prompt;
    const resumeFormat = state.format;
    return (
      <StepUpModal
        onVerified={() => resumeAfterStepUp(resumePrompt, resumeFormat)}
        onCancel={() => cancelStepUp(entitlement, resumePrompt, resumeFormat)}
      />
    );
  }

  // ------------------------------------------------------------------
  // No-entitlement state
  // ------------------------------------------------------------------
  if (state.kind === 'empty-no-entitlement') {
    return <NoEntitlement />;
  }

  // ------------------------------------------------------------------
  // In-flight: submitting / streaming
  // ------------------------------------------------------------------
  if (state.kind === 'submitting' || state.kind === 'streaming') {
    return (
      <StreamingHold
        prompt={state.prompt}
        format={state.format}
        toolCalls={state.kind === 'streaming' ? state.toolCalls : []}
      />
    );
  }

  // ------------------------------------------------------------------
  // Completing / complete
  // ------------------------------------------------------------------
  if (state.kind === 'completing' || state.kind === 'complete') {
    const title = state.title;
    const slug = state.slug;
    return (
      <CompletionCard
        title={title}
        slug={slug}
        onOpen={() => handleOpenStudy(slug)}
        autoRedirectMs={3000}
      />
    );
  }

  // ------------------------------------------------------------------
  // Error states
  // ------------------------------------------------------------------
  if (
    state.kind === 'error-rate-limited' ||
    state.kind === 'error-invalid-key' ||
    state.kind === 'error-stream-aborted' ||
    state.kind === 'error-save-failed'
  ) {
    return (
      <div className="min-h-screen bg-[var(--stone-50)] flex flex-col items-center px-6 py-16">
        <div className="max-w-2xl w-full">
          <ErrorState
            kind={state.kind}
            retryAt={state.kind === 'error-rate-limited' ? state.retryAt : undefined}
            markdown={state.kind === 'error-save-failed' ? state.markdown : undefined}
            onRetry={handleRetry}
          />
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------------
  // Idle / validating — main form
  // ------------------------------------------------------------------
  const promptError = state.kind === 'validating' ? state.errors.prompt : undefined;

  const canGenerate = (() => {
    if (entitlement.kind === 'none') return false;
    if (entitlement.kind === 'gift') {
      const credits = entitlement.credits[format] ?? 0;
      return credits > 0;
    }
    return true; // byok and admin can always generate
  })();

  return (
    <div
      className="min-h-screen bg-[var(--stone-50)]"
      style={{ animation: 'authFadeIn 400ms ease-out both' }}
    >
      {/* Editorial lede */}
      <GenerateLede />

      {/* Composition well */}
      <div className="max-w-2xl mx-auto px-6 pb-16">
        {/* Credits banner (gift-code users only) */}
        <CreditsBanner entitlement={entitlement} />

        {/* Prompt field */}
        <div className="mb-8">
          <PromptField
            value={prompt}
            onChange={setPrompt}
            disabled={false}
            error={promptError}
            autoFocus
          />
        </div>

        {/* Format selector */}
        <div className="mb-6">
          <FormatCards
            selected={format}
            onSelect={setFormat}
            entitlement={entitlement}
            disabled={false}
          />
        </div>

        {/* Submit CTA */}
        <div className="mt-6 flex flex-col items-center gap-3">
          <button
            onClick={handleSubmit}
            disabled={!canGenerate || prompt.trim().length < 10}
            aria-label="Begin a study"
            className="w-full md:w-auto bg-[var(--sage-500)] hover:bg-[var(--sage-700)] text-[var(--stone-50)] text-sm font-semibold tracking-[0.12em] uppercase px-8 py-3 rounded-md transition-colors min-h-[44px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sage-500)] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Begin a study
          </button>

          <ContextLine entitlement={entitlement} selectedFormat={format} />
        </div>

        {/* Divider + rigor panel */}
        <RigorPanel />
      </div>
    </div>
  );
}
