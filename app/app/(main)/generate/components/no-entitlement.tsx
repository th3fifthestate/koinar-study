'use client';
import Link from 'next/link';

export function NoEntitlement() {
  return (
    <div
      className="min-h-screen bg-[var(--stone-50)] flex flex-col items-center px-6 py-16"
      style={{ animation: 'authFadeIn 400ms ease-out both' }}
    >
      <div className="max-w-2xl w-full text-center">
        {/* Eyebrow */}
        <p className="text-[var(--stone-700)] text-xs font-semibold tracking-[0.25em] uppercase mb-6">
          Before You Begin
        </p>

        {/* Display headline */}
        <h1 className="font-display text-[var(--stone-900)] text-3xl md:text-4xl mb-6">
          Each study is written with care — and at cost.
        </h1>

        {/* Body */}
        <p className="font-body text-[var(--stone-700)] text-lg leading-relaxed mb-10 max-w-xl mx-auto">
          {"Koinar's studies aren't cheap to produce. A comprehensive one costs a dollar or so of Anthropic's models working through seven contextual checks. We don't mark that up."}
        </p>

        {/* Two paths */}
        <div className="flex flex-col md:flex-row gap-6 justify-center mb-10">
          {/* BYOK path */}
          <div className="flex-1 max-w-sm bg-white border border-[var(--stone-200)] rounded-lg p-6 text-left">
            <h2 className="font-display text-[var(--stone-900)] text-xl mb-2">
              Use your own Anthropic key.
            </h2>
            <p className="font-body text-[var(--stone-700)] text-base mb-4 leading-relaxed">
              Pay Anthropic directly; generate as often as you&apos;d like. Takes about two minutes to set up.
            </p>
            <Link
              href="/settings?tab=api-key"
              className="inline-flex bg-[var(--sage-500)] hover:bg-[var(--sage-700)] text-[var(--stone-50)] text-sm font-semibold tracking-wide uppercase px-5 py-2 rounded-md transition-colors min-h-[44px] items-center"
            >
              Add your key
            </Link>
          </div>

          {/* Gift-code path */}
          <div className="flex-1 max-w-sm bg-white border border-[var(--stone-200)] rounded-lg p-6 text-left">
            <h2 className="font-display text-[var(--stone-900)] text-xl mb-2">
              Ask the friend who invited you.
            </h2>
            <p className="font-body text-[var(--stone-700)] text-base leading-relaxed">
              Koinar lets members share gift-code credits. If they have any, they can send you one.
            </p>
          </div>
        </div>

        {/* Footnote */}
        <p className="font-body text-[var(--stone-700)] text-xs italic">
          No subscription. No nudges. You&apos;ll never see this screen again once either path is complete.
        </p>
      </div>
    </div>
  );
}
