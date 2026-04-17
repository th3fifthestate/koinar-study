"use client";

import { useState } from "react";
import Link from "next/link";

export type ContactTopic = "feedback" | "bug" | "factcheck";

const TOPIC_LABELS: Record<ContactTopic, string> = {
  feedback: "General feedback",
  bug: "Report a bug",
  factcheck: "Flag a fact-check issue",
};

const labelClass =
  "font-body text-xs font-semibold uppercase tracking-[0.15em] text-stone-500 block mb-1.5";

const inputClass =
  "w-full py-2.5 px-0 font-body text-base text-stone-900 bg-transparent border-0 border-b border-stone-200 outline-none transition-[border-color] duration-200 placeholder:text-stone-300 focus:border-sage-500 disabled:opacity-50";

const errorClass = "font-body text-sm text-[var(--warmth)] mt-1";

export function ContactForm({
  initialName,
  initialEmail,
  isLoggedIn,
}: {
  initialName: string;
  initialEmail: string;
  isLoggedIn: boolean;
}) {
  const [topic, setTopic] = useState<ContactTopic>("feedback");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setSubmitting(true);

    const form = new FormData(e.currentTarget);

    // Client-side honeypot check (server is authoritative)
    if (form.get("honeypot")) {
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          subject: form.get("subject"),
          message: form.get("message"),
          name: form.get("name"),
          email: form.get("email"),
          studyContext: form.get("studyContext") ?? undefined,
          honeypot: form.get("honeypot") ?? "",
        }),
      });

      if (res.status === 429) {
        setError("Too many messages. Please try again in a few minutes.");
        return;
      }
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
          fields?: Record<string, string[]>;
        };
        if (body.fields) setFieldErrors(body.fields);
        else setError(body.error ?? "Something went wrong. Please try again.");
        return;
      }
      setSubmitted(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div role="status" className="rounded-lg bg-stone-100 border border-stone-200 p-8">
        <h2 className="font-display italic text-2xl text-stone-900">Thank you.</h2>
        <p className="mt-3 font-body text-base text-stone-600">
          We read every message. If a reply is needed, we&rsquo;ll be in touch.
        </p>
        <Link
          href={isLoggedIn ? "/library" : "/"}
          className="mt-6 inline-block font-body text-sm text-stone-500 underline underline-offset-2 hover:text-stone-700 transition-colors"
        >
          {isLoggedIn ? "Back to the library" : "Back to Koinar"}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-7" noValidate>
      {/* Top-level error banner */}
      {error && (
        <div role="alert" className="rounded-md bg-stone-100 border border-stone-200 px-4 py-3 font-body text-base text-[var(--warmth)]">
          {error}
        </div>
      )}

      {/* Topic */}
      <div>
        <label htmlFor="contact-topic" className={labelClass}>
          Topic
        </label>
        <select
          id="contact-topic"
          name="topic"
          value={topic}
          onChange={(e) => setTopic(e.target.value as ContactTopic)}
          disabled={submitting}
          className={`${inputClass} cursor-pointer`}
          aria-describedby={fieldErrors.topic ? "contact-topic-error" : undefined}
        >
          {(Object.entries(TOPIC_LABELS) as [ContactTopic, string][]).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        {fieldErrors.topic && (
          <p id="contact-topic-error" role="alert" className={errorClass}>
            {fieldErrors.topic[0]}
          </p>
        )}
      </div>

      {/* Name */}
      <div>
        <label htmlFor="contact-name" className={labelClass}>
          Name
        </label>
        <input
          id="contact-name"
          type="text"
          name="name"
          defaultValue={initialName}
          required
          minLength={2}
          maxLength={100}
          autoComplete="name"
          disabled={submitting}
          placeholder="Your name"
          className={inputClass}
          aria-describedby={fieldErrors.name ? "contact-name-error" : undefined}
        />
        {fieldErrors.name && (
          <p id="contact-name-error" role="alert" className={errorClass}>
            {fieldErrors.name[0]}
          </p>
        )}
      </div>

      {/* Email */}
      <div>
        <label htmlFor="contact-email" className={labelClass}>
          Email
        </label>
        <input
          id="contact-email"
          type="email"
          name="email"
          defaultValue={initialEmail}
          required
          maxLength={200}
          autoComplete="email"
          spellCheck={false}
          disabled={submitting}
          placeholder="you@example.com"
          className={inputClass}
          aria-describedby={fieldErrors.email ? "contact-email-error" : undefined}
        />
        {fieldErrors.email && (
          <p id="contact-email-error" role="alert" className={errorClass}>
            {fieldErrors.email[0]}
          </p>
        )}
      </div>

      {/* Subject */}
      <div>
        <label htmlFor="contact-subject" className={labelClass}>
          Subject
        </label>
        <input
          id="contact-subject"
          type="text"
          name="subject"
          required
          minLength={5}
          maxLength={140}
          disabled={submitting}
          placeholder="Brief summary"
          className={inputClass}
          aria-describedby={fieldErrors.subject ? "contact-subject-error" : undefined}
        />
        {fieldErrors.subject && (
          <p id="contact-subject-error" role="alert" className={errorClass}>
            {fieldErrors.subject[0]}
          </p>
        )}
      </div>

      {/* Message */}
      <div>
        <label htmlFor="contact-message" className={labelClass}>
          Message
        </label>
        <textarea
          id="contact-message"
          name="message"
          required
          minLength={20}
          maxLength={4000}
          rows={6}
          disabled={submitting}
          placeholder="Tell us what's on your mind…"
          className={`${inputClass} resize-none`}
          aria-describedby={fieldErrors.message ? "contact-message-error" : undefined}
        />
        {fieldErrors.message && (
          <p id="contact-message-error" role="alert" className={errorClass}>
            {fieldErrors.message[0]}
          </p>
        )}
      </div>

      {/* Conditional study context for fact-check */}
      {topic === "factcheck" && (
        <div>
          <label htmlFor="contact-study" className={labelClass}>
            Which study? <span className="normal-case tracking-normal font-normal">(URL or title — optional)</span>
          </label>
          <input
            id="contact-study"
            type="text"
            name="studyContext"
            maxLength={500}
            disabled={submitting}
            placeholder="e.g. Romans 8 deep dive"
            className={inputClass}
            aria-describedby={fieldErrors.studyContext ? "contact-study-error" : undefined}
          />
          {fieldErrors.studyContext && (
            <p id="contact-study-error" role="alert" className={errorClass}>
              {fieldErrors.studyContext[0]}
            </p>
          )}
        </div>
      )}

      {/* Honeypot — off-screen, hidden from real users */}
      <div aria-hidden="true" style={{ position: "absolute", left: "-9999px" }}>
        <input
          type="text"
          name="honeypot"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={submitting}
        aria-busy={submitting}
        className="mt-2 py-3 px-9 font-body text-[0.75rem] font-medium tracking-[0.14em] uppercase text-stone-600 bg-transparent border border-stone-300 rounded-[4px] cursor-pointer transition-all duration-200 min-h-[44px] hover:text-stone-900 hover:border-stone-500 focus-visible:outline-2 focus-visible:outline-[var(--sage-500)] focus-visible:outline-offset-2 disabled:cursor-wait disabled:opacity-60"
      >
        {submitting ? "Sending\u2026" : "Send message"}
      </button>
    </form>
  );
}
