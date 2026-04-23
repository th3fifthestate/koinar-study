// app/app/(auth)/join/[token]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { use } from "react";
import { RegisterForm } from "@/components/auth/register-form";

type Step = "verify" | "register" | "invalid";

interface VerifyState {
  redactedEmail: string;
}

interface ConfirmState {
  inviterName: string;
  studyTitle: string | null;
  inviteeName: string;
  inviteeEmail: string;
}

export default function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [step, setStep] = useState<Step>("verify");
  const [verifyState, setVerifyState] = useState<VerifyState | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [codeSent, setCodeSent] = useState(false);

  // Send verification code on mount
  useEffect(() => {
    async function sendCode() {
      setLoading(true);
      try {
        const res = await fetch(`/api/join/${token}/verify`, { method: "POST" });
        const data = await res.json();
        if (!res.ok) {
          setStep("invalid");
          return;
        }
        setVerifyState({ redactedEmail: data.redactedEmail });
        setCodeSent(true);
      } catch {
        setStep("invalid");
      } finally {
        setLoading(false);
      }
    }
    sendCode();
  }, [token]);

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/join/${token}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Invalid code");
        return;
      }
      setConfirmState({
        inviterName: data.inviterName,
        studyTitle: data.studyTitle,
        inviteeName: data.inviteeName,
        inviteeEmail: data.inviteeEmail,
      });
      setStep("register");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (step === "invalid") {
    return (
      <div className="text-center space-y-2">
        <h2 className="text-xl font-medium text-stone-800">Invite not found</h2>
        <p className="text-stone-500 text-sm">This invite link may have expired or already been used.</p>
      </div>
    );
  }

  if (step === "verify") {
    return (
      <div className="space-y-5">
        <div>
          <h2 className="text-xl font-medium text-stone-800">Check your email</h2>
          {verifyState && (
            <p className="text-stone-500 text-sm mt-1.5">
              We sent a verification code to{" "}
              <span className="font-medium text-stone-700">{verifyState.redactedEmail}</span>
            </p>
          )}
          {loading && !codeSent && (
            <p className="text-stone-400 text-sm mt-1.5">Sending code…</p>
          )}
        </div>

        <form onSubmit={handleConfirm} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1.5" htmlFor="code">
              Verification code
            </label>
            <input
              id="code"
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              required
              className="w-full px-3.5 py-2.5 rounded-lg border border-stone-200 text-stone-800 text-center text-2xl tracking-widest focus:outline-none focus:ring-2 focus:ring-stone-400 focus:border-transparent"
              placeholder="000000"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3.5 py-2.5">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || code.length !== 6}
            className="w-full py-2.5 rounded-lg bg-stone-800 text-white text-sm font-medium hover:bg-stone-700 disabled:opacity-50 transition-colors"
          >
            {loading ? "Verifying…" : "Verify code"}
          </button>
        </form>
      </div>
    );
  }

  // step === "register"
  return (
    <div className="space-y-5">
      {confirmState?.studyTitle && (
        <div className="bg-stone-50 rounded-xl p-4 border border-stone-100">
          <p className="text-sm text-stone-600">
            <span className="font-medium text-stone-800">{confirmState.inviterName}</span>{" "}
            wants to study{" "}
            <span className="font-medium text-stone-800 italic">{confirmState.studyTitle}</span>{" "}
            with you.
          </p>
        </div>
      )}
      <h2 className="text-xl font-medium text-stone-800">Create your account</h2>
      <RegisterForm
        name={confirmState!.inviteeName}
        email={confirmState!.inviteeEmail}
        inviteToken={token}
      />
    </div>
  );
}
