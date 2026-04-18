// app/components/ui/password-input.tsx
"use client";

import { forwardRef, useState, type InputHTMLAttributes } from "react";

interface PasswordInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  id: string;
}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput({ onKeyDown, onKeyUp, onBlur, ...props }, ref) {
    const [capsLock, setCapsLock] = useState(false);

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

    return (
      <div className="w-full">
        <input
          {...props}
          ref={ref}
          type="password"
          onKeyDown={handleKeyDown}
          onKeyUp={handleKeyUp}
          onBlur={handleBlur}
        />
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
