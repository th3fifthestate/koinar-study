"use client";

import { useState, useRef } from "react";

type FormStatus = "idle" | "loading" | "success" | "error" | "duplicate";

export function EmailForm() {
  const [status, setStatus] = useState<FormStatus>("idle");
  const [email, setEmail] = useState("");
  const honeypotRef = useRef<HTMLInputElement>(null);
  const statusRef = useRef<HTMLParagraphElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (honeypotRef.current?.value) return; // bot

    const trimmed = email.trim().toLowerCase();
    if (!trimmed || trimmed.length > 254) return;

    setStatus("loading");

    try {
      const res = await fetch("/api/waitlist/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });

      if (res.status === 201) {
        setStatus("success");
        setEmail("");
      } else if (res.status === 409) {
        setStatus("duplicate");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }

    // Focus the status message for screen readers
    setTimeout(() => statusRef.current?.focus(), 100);
  }

  const isSuccess = status === "success" || status === "duplicate";

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      {isSuccess ? (
        <p
          ref={statusRef}
          tabIndex={-1}
          className="font-body text-[0.85rem] font-medium text-[rgba(247,246,243,0.7)] text-center outline-none"
          style={{ animation: "sageGlow 1.5s ease-out" }}
        >
          {status === "duplicate" ? "You\u2019re already on the list." : "You\u2019re in. We\u2019ll be in touch."}
        </p>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="flex flex-col items-center gap-5 w-full max-w-[320px] md:max-w-[340px]"
        >
          {/* Honeypot — hidden from humans */}
          <input
            ref={honeypotRef}
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            className="absolute opacity-0 h-0 w-0 overflow-hidden pointer-events-none"
          />

          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Your email"
            aria-label="Email address"
            required
            maxLength={254}
            autoComplete="email"
            spellCheck={false}
            disabled={status === "loading"}
            className="w-full py-3 px-1 font-body text-[0.95rem] font-normal text-stone-50 bg-transparent border-0 border-b border-[rgba(247,246,243,0.3)] outline-none text-center transition-[border-color] duration-300 ease-out placeholder:text-[rgba(247,246,243,0.4)] placeholder:italic focus:border-b-[rgba(168,184,160,0.6)] disabled:opacity-50"
          />

          <button
            type="submit"
            disabled={status === "loading"}
            className="py-3 px-9 font-body text-[0.75rem] font-medium tracking-[0.14em] uppercase text-[rgba(247,246,243,0.75)] bg-transparent border border-[rgba(247,246,243,0.2)] rounded-[4px] cursor-pointer transition-all duration-250 ease-out min-h-[44px] hover:text-stone-50 hover:border-[rgba(247,246,243,0.45)] hover:bg-[rgba(247,246,243,0.05)] active:bg-[rgba(247,246,243,0.08)] focus-visible:outline-2 focus-visible:outline-sage-500 focus-visible:outline-offset-2 disabled:cursor-wait"
            style={
              status === "loading"
                ? {
                    background:
                      "linear-gradient(90deg, transparent 33%, rgba(247,246,243,0.06) 50%, transparent 67%)",
                    backgroundSize: "200% 100%",
                    animation: "shimmer 1.5s infinite",
                  }
                : undefined
            }
          >
            {status === "loading" ? "Joining\u2026" : "Join the waitlist"}
          </button>

          {status === "error" && (
            <p
              ref={statusRef}
              tabIndex={-1}
              className="font-body text-[0.7rem] font-medium text-warmth outline-none"
            >
              Something went wrong. Please try again.
            </p>
          )}
        </form>
      )}
    </div>
  );
}
