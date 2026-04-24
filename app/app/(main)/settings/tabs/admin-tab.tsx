import Link from 'next/link';
import { TotpEnrollFlow } from '@/components/admin-security/totp-enroll-flow';

export function AdminTab() {
  return (
    <div className="space-y-12">
      <div className="border-t border-stone-200 pt-10">
        <span className="font-body text-[0.7rem] uppercase tracking-[0.3em] text-stone-400">
          Admin
        </span>
        <h2 className="mt-4 font-display text-2xl md:text-3xl font-normal text-stone-900">
          The Admin panel.
        </h2>
        <p className="mt-4 font-body text-base leading-relaxed text-stone-600 max-w-xl">
          Manage studies, gift codes, waitlist approvals, users, and image generation.
          The panel has its own navigation and audit log.
        </p>
        <Link
          href="/admin"
          className="mt-6 inline-block font-body text-base text-sage-700 underline underline-offset-2 hover:text-sage-900 transition-colors"
        >
          Open the Admin panel →
        </Link>
      </div>

      <TotpEnrollFlow />
    </div>
  );
}
