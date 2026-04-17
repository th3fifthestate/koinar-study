'use client';

import { useState } from 'react';
import { usePlaceholderRotation } from '../lib/placeholder-rotation';

interface PromptFieldProps {
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  error?: string;
  autoFocus?: boolean;
}

export function PromptField({ value, onChange, disabled, error, autoFocus }: PromptFieldProps) {
  const [focused, setFocused] = useState(false);
  const placeholder = usePlaceholderRotation(!value);

  const isCharMeterAlert = value.length < 10 || value.length > 1900;

  return (
    <div className="flex flex-col gap-2">
      {/* Micro-label */}
      <label
        htmlFor="prompt-field"
        className="text-[var(--stone-700)] uppercase tracking-[0.18em] font-semibold"
        style={{ fontSize: '0.7rem' }}
      >
        A verse, a passage, or a question
      </label>

      {/* Textarea */}
      <textarea
        id="prompt-field"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        aria-disabled={disabled ? 'true' : undefined}
        autoFocus={autoFocus}
        maxLength={2000}
        rows={6}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className={`w-full resize-none rounded-md border border-[var(--stone-200)] bg-white px-4 py-3 text-base text-[var(--stone-900)] placeholder:text-[var(--stone-400)] focus:outline-none min-h-[180px] md:min-h-[160px] transition-all ${
          disabled ? 'opacity-50 cursor-not-allowed' : ''
        }`}
        style={{
          animation: focused ? 'sageGlow 1500ms ease both' : 'none',
        }}
        aria-describedby="prompt-helper"
      />

      {/* Char meter */}
      <div className="flex justify-end">
        <span
          className={`text-xs tabular-nums ${
            isCharMeterAlert ? 'text-[var(--destructive)]' : 'text-[var(--stone-500)]'
          }`}
        >
          {value.length} / 2000
        </span>
      </div>

      {/* Helper text */}
      <p
        id="prompt-helper"
        className="text-[var(--stone-700)] italic"
        style={{ fontSize: '1rem' }}
      >
        A verse reference or a question. 10–2,000 characters.
      </p>

      {/* Inline validation error */}
      {error && (
        <p
          role="alert"
          aria-live="assertive"
          className="text-[var(--destructive)]"
          style={{ fontSize: '0.8rem' }}
        >
          {error}
        </p>
      )}
    </div>
  );
}
