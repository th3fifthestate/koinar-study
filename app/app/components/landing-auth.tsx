"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";

type View = "buttons" | "join" | "signin";
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

// Visible micro-label — satisfies UI-GUIDELINES.md "no placeholder-only labels"
// rule while keeping the centered editorial layout. Sighted users see the
// field name even after filling in; screen readers keep the aria-label path.
const labelClass =
  "font-body text-[0.65rem] font-medium uppercase tracking-[0.18em] text-[rgba(247,246,243,0.5)] text-center block mb-1.5";

const fieldWrapClass = "w-full flex flex-col";

/** Wrapper that plays entrance animation on mount */
function AnimatedView({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{ animation: "authFadeIn 500ms ease-out both" }}
    >
      {children}
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
    // Focus first field after entrance animation settles
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
      <AnimatedView>
        <div
          ref={statusRef}
          tabIndex={-1}
          role="status"
          aria-live="polite"
          className="flex flex-col items-center gap-4 text-center outline-none max-w-[360px]"
          style={{ animation: "sageGlow 1.5s ease-out" }}
        >
          <div className="h-px w-10 bg-[rgba(168,184,160,0.5)]" />
          <p className="font-display text-[1.6rem] italic font-normal leading-[1.25] text-[rgba(247,246,243,0.92)]">
            Your request has been received.
          </p>
          <p className="font-body text-[0.9rem] leading-relaxed text-[rgba(247,246,243,0.55)]">
            We review every request by hand. When a seat opens, we&rsquo;ll send
            a signup link to your inbox within a few days.
          </p>
          <div className="h-px w-10 bg-[rgba(168,184,160,0.5)] mt-1" />
        </div>
      </AnimatedView>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col items-center gap-4 w-full max-w-[360px] md:max-w-[380px]"
    >
      {/* Honeypot */}
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
        <div className={fieldWrapClass} style={{ animation: "authFadeIn 500ms ease-out both", animationDelay: "0ms" }}>
          <label htmlFor="waitlist-first-name" className={labelClass}>First name</label>
          <input
            id="waitlist-first-name"
            ref={firstInputRef}
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="Jane"
            required
            minLength={1}
            maxLength={50}
            autoComplete="given-name"
            disabled={status === "loading"}
            className={inputClass}
          />
        </div>
        <div className={fieldWrapClass} style={{ animation: "authFadeIn 500ms ease-out both", animationDelay: "60ms" }}>
          <label htmlFor="waitlist-last-name" className={labelClass}>Last name</label>
          <input
            id="waitlist-last-name"
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Doe"
            required
            minLength={1}
            maxLength={50}
            autoComplete="family-name"
            disabled={status === "loading"}
            className={inputClass}
          />
        </div>
      </div>

      <div className={fieldWrapClass} style={{ animation: "authFadeIn 500ms ease-out both", animationDelay: "120ms" }}>
        <label htmlFor="waitlist-email" className={labelClass}>Email</label>
        <input
          id="waitlist-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
          maxLength={254}
          autoComplete="email"
          spellCheck={false}
          disabled={status === "loading"}
          className={inputClass}
        />
      </div>

      <div className={fieldWrapClass} style={{ animation: "authFadeIn 500ms ease-out both", animationDelay: "180ms" }}>
        <label htmlFor="waitlist-message" className={labelClass}>Why do you want to join?</label>
        <textarea
          id="waitlist-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Share a sentence or two"
          required
          minLength={10}
          maxLength={500}
          rows={3}
          disabled={status === "loading"}
          className={`${inputClass} resize-none`}
        />
      </div>

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

function SignInForm({ onBack }: { onBack: () => void }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => firstInputRef.current?.focus(), 520);
    return () => clearTimeout(t);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        const message =
          res.status === 429
            ? "Too many attempts. Please wait a moment and try again."
            : res.status === 400 || res.status === 401
              ? "The email or password you entered is incorrect."
              : "We couldn't complete your sign-in right now. Please try again shortly.";
        setError(message);
        return;
      }

      router.push("/");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col items-center gap-4 w-full max-w-[320px] md:max-w-[340px]"
    >
      <div className={fieldWrapClass} style={{ animation: "authFadeIn 500ms ease-out both", animationDelay: "0ms" }}>
        <label htmlFor="signin-email" className={labelClass}>Email</label>
        <input
          id="signin-email"
          ref={firstInputRef}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
          maxLength={254}
          autoComplete="email"
          spellCheck={false}
          disabled={loading}
          aria-describedby={error ? "signin-error" : undefined}
          className={inputClass}
        />
      </div>

      <div className={fieldWrapClass} style={{ animation: "authFadeIn 500ms ease-out both", animationDelay: "80ms" }}>
        <label htmlFor="signin-password" className={labelClass}>Password</label>
        <input
          id="signin-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"
          required
          autoComplete="current-password"
          disabled={loading}
          aria-describedby={error ? "signin-error" : undefined}
          className={inputClass}
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className={buttonClass}
        style={{
          ...(loading ? shimmerStyle : {}),
          animation: loading ? shimmerStyle.animation : "authFadeIn 500ms ease-out both",
          animationDelay: loading ? undefined : "160ms",
        }}
      >
        {loading ? "Signing in\u2026" : "Sign In"}
      </button>

      {error && (
        <p
          id="signin-error"
          role="alert"
          className="font-body text-[0.7rem] font-medium text-warmth outline-none"
        >
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={onBack}
        className={backLinkClass}
        style={{ animation: "authFadeIn 500ms ease-out both", animationDelay: "220ms" }}
      >
        Back
      </button>
    </form>
  );
}

export function LandingAuth() {
  const [view, setView] = useState<View>("buttons");
  const [exiting, setExiting] = useState(false);
  const nextViewRef = useRef<View>("buttons");

  const transitionTo = useCallback((next: View) => {
    nextViewRef.current = next;
    setExiting(true);
  }, []);

  useEffect(() => {
    if (!exiting) return;
    const t = setTimeout(() => {
      setView(nextViewRef.current);
      setExiting(false);
    }, 250); // matches authFadeOut duration
    return () => clearTimeout(t);
  }, [exiting]);

  const wrapStyle = exiting
    ? { animation: "authFadeOut 250ms ease-in forwards" }
    : { animation: "authFadeIn 400ms ease-out both" };

  if (view === "join") {
    return (
      <div style={wrapStyle} key="join">
        <JoinForm onBack={() => transitionTo("buttons")} />
      </div>
    );
  }

  if (view === "signin") {
    return (
      <div style={wrapStyle} key="signin">
        <SignInForm onBack={() => transitionTo("buttons")} />
      </div>
    );
  }

  return (
    <div style={wrapStyle} key="buttons" className="flex flex-col sm:flex-row items-center gap-4">
      <button
        onClick={() => transitionTo("join")}
        className={buttonClass}
        style={{ animation: "authFadeIn 500ms ease-out both", animationDelay: "0ms" }}
      >
        Join the Community
      </button>
      <button
        onClick={() => transitionTo("signin")}
        className={buttonClass}
        style={{ animation: "authFadeIn 500ms ease-out both", animationDelay: "100ms" }}
      >
        Sign In
      </button>
    </div>
  );
}
