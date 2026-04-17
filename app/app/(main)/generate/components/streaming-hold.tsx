'use client';
import type { Format, ToolCallEntry } from '../types';
import { ToolCallFeed } from './tool-call-feed';

interface StreamingHoldProps {
  prompt: string;
  format: Format;
  toolCalls: ToolCallEntry[];
}

export function StreamingHold({ prompt, format: _format, toolCalls }: StreamingHoldProps) {
  return (
    <div
      className="min-h-screen bg-[var(--stone-50)] flex flex-col items-center px-6"
      style={{ animation: 'authFadeIn 400ms ease-out both' }}
    >
      <div className="max-w-2xl w-full py-16">
        {/* Eyebrow */}
        <p className="text-[var(--stone-700)] text-xs font-semibold tracking-[0.25em] uppercase mb-6 text-center">
          In Progress
        </p>

        {/* Headline */}
        <h2 className="font-display text-[var(--stone-900)] text-3xl md:text-4xl text-center mb-8 italic">
          Koinar is reading.
        </h2>

        {/* Prompt echo */}
        <p
          className="font-body text-[var(--stone-700)] text-lg leading-relaxed text-center mb-8 line-clamp-3"
          style={{ opacity: 0.85 }}
        >
          {prompt}
        </p>

        {/* Sage pulse dot */}
        <div className="flex justify-center mb-10" aria-hidden="true">
          <span
            className="inline-block w-2 h-2 rounded-full bg-[var(--sage-500)]"
            style={{ animation: 'sageGlow 2s ease-in-out infinite alternate' }}
          />
        </div>

        {/* Tool-call feed */}
        <ToolCallFeed entries={toolCalls} />
      </div>
    </div>
  );
}
