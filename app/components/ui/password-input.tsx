// app/components/ui/password-input.tsx
"use client";

import { forwardRef, useState, type InputHTMLAttributes } from "react";

interface PasswordInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  id: string;
  /**
   * When true, render a Show/Hide toggle button that switches the input
   * between type="password" and type="text". Defaults to false. Intended for
   * initial-signup flows where users benefit from verifying their new password
   * before submitting; leave false on repeat-sign-in and settings flows.
   */
  showToggle?: boolean;
}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput(
    { onKeyDown, onKeyUp, onBlur, showToggle = false, className, ...props },
    ref
  ) {
    const [capsLock, setCapsLock] = useState(false);
    const [visible, setVisible] = useState(false);

    function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
      setCapsLock(e.getModifierState("CapsLock"));
      onKeyDown?.(e);
    }

    function handleKeyUp(e: React.KeyboardEvent<HTMLInputElement>) {
      setCapsLock(e.getModifierState("CapsLock"));
      onKeyUp?.(e);
    }

    function handleBlur(e: React.FocusEvent<HTMLInputElement>) {
      setCapsLock(false);
      onBlur?.(e);
    }

    // When show-toggle is enabled, reserve right padding so the button doesn't
    // overlap input text. The caller controls the base class; we append pr-11
    // only when needed so non-toggle consumers aren't forced to allocate space.
    const mergedClassName = showToggle
      ? `${className ?? ""} pr-11`.trim()
      : className;

    return (
      <div className="w-full">
        <div className={showToggle ? "relative" : undefined}>
          <input
            {...props}
            ref={ref}
            type={visible ? "text" : "password"}
            onKeyDown={handleKeyDown}
            onKeyUp={handleKeyUp}
            onBlur={handleBlur}
            className={mergedClassName}
          />
          {showToggle && (
            <button
              type="button"
              onClick={() => setVisible((v) => !v)}
              aria-label={visible ? "Hide password" : "Show password"}
              aria-pressed={visible}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 text-xs focus:outline-none focus-visible:text-stone-700"
            >
              {visible ? "Hide" : "Show"}
            </button>
          )}
        </div>
        {capsLock && (
          <p
            role="status"
            aria-live="polite"
            className="text-xs text-warmth text-right mt-1"
          >
            Caps Lock is on
          </p>
        )}
      </div>
    );
  }
);
