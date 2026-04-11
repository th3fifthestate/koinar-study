// app/components/auth/register-form.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface RegisterFormProps {
  name: string;
  email: string;
  inviteToken?: string;    // for invite path (/join/[token])
  welcomeToken?: string;   // for waitlist path (/welcome/[token])
}

export function RegisterForm({ name, email, inviteToken, welcomeToken }: RegisterFormProps) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setError(null);
    setLoading(true);

    try {
      const endpoint = inviteToken ? "/api/auth/register" : "/api/auth/register-welcome";
      const body = inviteToken
        ? { name, email, password, inviteToken }
        : { name, email, password, welcomeToken };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Registration failed");
        return;
      }

      router.push("/onboarding");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-stone-700 mb-1.5">Name</label>
        <input
          type="text"
          value={name}
          readOnly
          className="w-full px-3.5 py-2.5 rounded-lg border border-stone-200 bg-stone-50 text-stone-500 text-sm cursor-not-allowed"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-stone-700 mb-1.5">Email</label>
        <input
          type="email"
          value={email}
          readOnly
          className="w-full px-3.5 py-2.5 rounded-lg border border-stone-200 bg-stone-50 text-stone-500 text-sm cursor-not-allowed"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-stone-700 mb-1.5" htmlFor="password">
          Create password
        </label>
        <div className="relative">
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            className="w-full px-3.5 py-2.5 pr-11 rounded-lg border border-stone-200 text-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-400 focus:border-transparent text-sm"
            placeholder="8 characters minimum"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 text-xs"
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3.5 py-2.5">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-2.5 rounded-lg bg-stone-800 text-white text-sm font-medium hover:bg-stone-700 disabled:opacity-50 transition-colors"
      >
        {loading ? "Creating account…" : "Create account"}
      </button>

      <p className="text-center text-sm text-stone-500">
        Already have an account?{" "}
        <Link href="/login" className="underline underline-offset-2 hover:text-stone-700">
          Sign in
        </Link>
      </p>
    </form>
  );
}
