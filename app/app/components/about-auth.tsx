"use client";

import { useState, useRef, useCallback, useEffect } from "react";

type View = "button" | "form";
type FormStatus = "idle" | "loading" | "success" | "error";

const inputClass =
  "w-full py-3 px-1 font-body text-[0.95rem] font-normal text-stone-50 bg-transparent border-0 border-b border-[rgba(247,246,243,0.3)] outline-none text-center transition-[border-color] duration-300 ease-out placeholder:text-[rgba(247,246,243,0.4)] placeholder:italic focus:border-b-[rgba(168,184,160,0.6)] disabled:opacity-50";

const buttonClass =
  "py-3 px-9 font-body text-[0.75rem] font-medium tracking-[0.14em] uppercase text-[rgba(247,246,243,0.75)] bg-transparent border border-[rgba(247,246,243,0.2)] rounded-[4px] cursor-pointer transition-all duration-250 ease-out min-h-[44px] hover:text-stone-50 hover:border-[rgba(247,246,243,0.45)] hover:bg-[rgba(247,246,243,0.05)] active:bg-[rgba(247,246,243,0.08)] focus-visible:outline-2 focus-visible:outline-sage-500 focus-visible:outline-offset-2 disabled:cursor-wait";

const shimmerStyle = {
  background:
    "linear-gradient(90deg, transparent 33%, rgba(247,246,243,0.06) 50%, transparent 67%)",
  backgroundSize: "200% 100%",
  animation: "shimmer 1.5s infinite",
};

const backLinkClass =
  "font-body text-[0.7rem] font-medium uppercase tracking-[0.15em] text-[rgba(247,246,243,0.4)] cursor-pointer transition-colors duration-200 hover:text-[rgba(247,246,243,0.7)] bg-transparent border-0 mt-2";

export function AboutAuth() {
  const [view, setView] = useState<View>("button");
  const [exiting, setExiting] = useState(false);
  const nextViewRef = useRef<View>("button");

  const transitionTo = useCallback((next: View) => {
    nextViewRef.current = next;
    setExiting(true);
  }, []);

  useEffect(() => {
    if (!exiting) return;
    const t = setTimeout(() => {
      setView(nextViewRef.current);
      setExiting(false);
    }, 250);
    return () => clearTimeout(t);
  }, [exiting]);

  const wrapStyle = exiting
    ? { animation: "authFadeOut 250ms ease-in forwards" }
    : { animation: "authFadeIn 400ms ease-out both" };

  if (view === "form") {
    return (
      <div style={wrapStyle} key="form">
        <JoinForm onBack={() => transitionTo("button")} />
      </div>
    );
  }

  return (
    <div style={wrapStyle} key="button" className="flex items-center">
      <button
        onClick={() => transitionTo("form")}
        className={buttonClass}
        style={{ animation: "authFadeIn 500ms ease-out both" }}
      >
        Join the Community
      </button>
    </div>
  );
}

function JoinForm({ onBack }: { onBack: () => void }) {
  const [status, setStatus] = useState<FormStatus>("idle");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const honeypotRef = useRef<HTMLInputElement>(null);
  const statusRef = useRef<HTMLParagraphElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => firstInputRef.current?.focus(), 520);
    return () => clearTimeout(t);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (honeypotRef.current?.value) return;

    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
    setStatus("loading");

    try {
      const res = await fetch("/api/waitlist/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: fullName,
          email: email.trim().toLowerCase(),
          message: message.trim(),
        }),
      });

      if (res.ok) {
        setStatus("success");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }

    setTimeout(() => statusRef.current?.focus(), 100);
  }

  if (status === "success") {
    return (
      <div style={{ animation: "authFadeIn 500ms ease-out both" }}>
        <p
          ref={statusRef}
          tabIndex={-1}
          className="font-body text-[0.85rem] font-medium text-[rgba(247,246,243,0.7)] text-center outline-none"
          style={{ animation: "sageGlow 1.5s ease-out" }}
        >
          Your request has been submitted. We&rsquo;ll be in touch.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col items-center gap-4 w-full max-w-[360px] md:max-w-[380px]"
    >
      <input
        ref={honeypotRef}
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute opacity-0 h-0 w-0 overflow-hidden pointer-events-none"
      />

      <div className="flex gap-4 w-full">
        <input
          ref={firstInputRef}
          type="text"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          placeholder="First name"
          aria-label="First name"
          required
          minLength={1}
          maxLength={50}
          autoComplete="given-name"
          disabled={status === "loading"}
          className={inputClass}
          style={{ animation: "authFadeIn 500ms ease-out both", animationDelay: "0ms" }}
        />
        <input
          type="text"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          placeholder="Last name"
          aria-label="Last name"
          required
          minLength={1}
          maxLength={50}
          autoComplete="family-name"
          disabled={status === "loading"}
          className={inputClass}
          style={{ animation: "authFadeIn 500ms ease-out both", animationDelay: "60ms" }}
        />
      </div>

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
        className={inputClass}
        style={{ animation: "authFadeIn 500ms ease-out both", animationDelay: "120ms" }}
      />

      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Why do you want to join?"
        aria-label="Message"
        required
        minLength={10}
        maxLength={500}
        rows={3}
        disabled={status === "loading"}
        className={`${inputClass} resize-none`}
        style={{ animation: "authFadeIn 500ms ease-out both", animationDelay: "180ms" }}
      />

      <button
        type="submit"
        disabled={status === "loading"}
        className={buttonClass}
        style={{
          ...(status === "loading" ? shimmerStyle : {}),
          animation: status === "loading" ? shimmerStyle.animation : "authFadeIn 500ms ease-out both",
          animationDelay: status === "loading" ? undefined : "240ms",
        }}
      >
        {status === "loading" ? "Submitting\u2026" : "Request Access"}
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

      <button
        type="button"
        onClick={onBack}
        className={backLinkClass}
        style={{ animation: "authFadeIn 500ms ease-out both", animationDelay: "300ms" }}
      >
        Back
      </button>
    </form>
  );
}
