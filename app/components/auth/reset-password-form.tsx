// app/components/auth/reset-password-form.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PasswordInput } from "@/components/ui/password-input";

interface Props {
  token: string;
}

export function ResetPasswordForm({ token }: Props) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function clientValidate(): string | null {
    if (password.length < 8) return "Password must be at least 8 characters.";
    if (password !== confirm) return "Passwords do not match.";
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const clientError = clientValidate();
    if (clientError) {
      setError(clientError);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          (data as { error?: string }).error ??
            "We couldn't reset your password. Please try again."
        );
        return;
      }
      // Force a full nav so the (now-destroyed) iron-session cookie clears
      // from memory and we land on the public landing page.
      router.push("/?message=password-reset");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label
          htmlFor="reset-password"
          className="block font-body text-base text-stone-700 mb-1.5"
        >
          New password
        </label>
        <PasswordInput
          id="reset-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="8 characters minimum"
          className="w-full px-3.5 py-2.5 rounded-lg border border-stone-200 text-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-400 focus:border-transparent text-base"
          showToggle
        />
      </div>

      <div>
        <label
          htmlFor="reset-confirm"
          className="block font-body text-base text-stone-700 mb-1.5"
        >
          Confirm new password
        </label>
        <PasswordInput
          id="reset-confirm"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
          className="w-full px-3.5 py-2.5 rounded-lg border border-stone-200 text-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-400 focus:border-transparent text-base"
          aria-describedby={error ? "reset-error" : undefined}
          aria-invalid={error ? "true" : undefined}
          showToggle
        />
      </div>

      {error && (
        <p
          id="reset-error"
          role="alert"
          className="font-body text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3.5 py-2.5"
        >
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-2.5 rounded-lg bg-stone-800 text-white text-base font-medium hover:bg-stone-700 disabled:opacity-50 transition-colors"
      >
        {loading ? "Setting new password…" : "Set new password"}
      </button>

      <p className="font-body text-xs text-stone-400 text-center">
        All other sessions will be signed out.
      </p>
    </form>
  );
}
