// app/app/(auth)/reset/[token]/page.tsx
//
// Server-side pre-validates the password-reset token, then hands off to
// the client form. The GET here has NO side effects — email prefetchers
// and corporate link-scanners can open this page safely without consuming
// the token. The actual password change is a separate POST to
// /api/auth/reset-password carrying both the token and the new password.
//
// Noindex metadata is essential: we don't want this URL crawled and the
// token ending up in search-engine caches.
import type { Metadata } from "next";
import { createHash } from "crypto";
import { findActivePasswordResetToken } from "@/lib/db/queries";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata: Metadata = {
  title: "Reset password — Koinar",
  // Robots meta is belt-and-suspenders alongside the deny rules we want
  // at the edge. Either way, noindex + nofollow prevents legitimate
  // crawlers from storing the URL.
  robots: { index: false, follow: false },
};

interface Props {
  params: Promise<{ token: string }>;
}

export default async function ResetPasswordPage({ params }: Props) {
  const { token } = await params;

  // sha256 hash the incoming token to check against what's stored. Never
  // compare raw tokens — if the stored-hash approach is ever compromised
  // (e.g. someone diffs this file) the attacker still can't use leaked
  // DB rows to forge a reset.
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const row = findActivePasswordResetToken(tokenHash);

  if (!row) {
    return (
      <div className="text-center space-y-4">
        <h2 className="font-display text-xl font-normal text-stone-900">
          Link expired
        </h2>
        <p className="font-body text-sm text-stone-500 leading-relaxed">
          This reset link is invalid or has expired. Head back and request a
          new one — links are valid for 30 minutes and can only be used once.
        </p>
        <a
          href="/"
          className="inline-block font-body text-sm text-sage-700 underline underline-offset-2 hover:text-sage-900"
        >
          Back to sign in
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="font-display text-xl font-normal text-stone-900">
          Set a new password
        </h2>
        <p className="font-body text-sm text-stone-500 leading-relaxed">
          Choose a password you don't use anywhere else. 8 characters or more.
        </p>
      </div>
      <ResetPasswordForm token={token} />
    </div>
  );
}
