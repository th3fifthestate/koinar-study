'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { InviteRow } from '@/lib/db/types';

interface Props {
  invitations: InviteRow[];
  invitesRemaining: number | null;
  studyOptions: { id: number; title: string }[];
}

const STATUS_LABELS: Record<InviteRow['status'], string> = {
  pending: 'Pending',
  accepted: 'Accepted',
  expired: 'Expired',
};

export function InvitationsTab({ invitations, invitesRemaining, studyOptions }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [studyId, setStudyId] = useState<string>(
    studyOptions[0] ? String(studyOptions[0].id) : '',
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const formDisabled =
    submitting ||
    (invitesRemaining !== null && invitesRemaining <= 0) ||
    studyOptions.length === 0;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!name.trim() || !email.trim() || !studyId) {
      setError('Please fill every field.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inviteeName: name.trim(),
          inviteeEmail: email.trim(),
          linkedStudyId: Number(studyId),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'Could not send invitation.');
        return;
      }
      setSuccess(`Invitation sent to ${email.trim()}.`);
      setName('');
      setEmail('');
      startTransition(() => router.refresh());
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-10">
      <section aria-labelledby="invite-form-heading">
        <h2
          id="invite-form-heading"
          className="font-display text-xl text-stone-900 mb-2"
        >
          Send an invitation
        </h2>
        <p className="font-body text-base text-stone-600 mb-5">
          {invitesRemaining === null
            ? 'Unlimited invitations available.'
            : `${invitesRemaining} of 2 invitations remaining this month.`}
        </p>

        {studyOptions.length === 0 ? (
          <p className="font-body text-base text-stone-500">
            You&apos;ll be able to send invitations once at least one study is
            available to share.
          </p>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4 max-w-md">
            <div>
              <label
                htmlFor="invite-name"
                className="block font-body text-base text-stone-700 mb-1"
              >
                Recipient name
              </label>
              <input
                id="invite-name"
                type="text"
                required
                minLength={2}
                maxLength={100}
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={formDisabled}
                className="w-full font-body text-base px-3 py-2 border border-stone-300 rounded bg-white focus:border-sage-500 focus:outline-none disabled:bg-stone-100 disabled:text-stone-400"
              />
            </div>

            <div>
              <label
                htmlFor="invite-email"
                className="block font-body text-base text-stone-700 mb-1"
              >
                Recipient email
              </label>
              <input
                id="invite-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={formDisabled}
                className="w-full font-body text-base px-3 py-2 border border-stone-300 rounded bg-white focus:border-sage-500 focus:outline-none disabled:bg-stone-100 disabled:text-stone-400"
              />
            </div>

            <div>
              <label
                htmlFor="invite-study"
                className="block font-body text-base text-stone-700 mb-1"
              >
                Study to share
              </label>
              <select
                id="invite-study"
                value={studyId}
                onChange={(e) => setStudyId(e.target.value)}
                disabled={formDisabled}
                className="w-full font-body text-base px-3 py-2 border border-stone-300 rounded bg-white focus:border-sage-500 focus:outline-none disabled:bg-stone-100 disabled:text-stone-400"
              >
                {studyOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={formDisabled}
              aria-describedby={error ? 'invite-error' : undefined}
              className="font-body text-base px-4 py-2 bg-sage-600 text-white rounded hover:bg-sage-700 transition-colors disabled:bg-stone-300 disabled:text-stone-500"
            >
              {submitting || isPending ? 'Sending…' : 'Send invitation'}
            </button>

            {invitesRemaining === 0 && (
              <p className="font-body text-sm text-stone-500">
                You&apos;ve reached your monthly invitation limit. It resets 30
                days after your earliest active invite.
              </p>
            )}

            {error && (
              <p
                id="invite-error"
                role="alert"
                aria-live="assertive"
                className="font-body text-base text-red-700"
              >
                {error}
              </p>
            )}
            {success && (
              <p
                role="status"
                aria-live="polite"
                className="font-body text-base text-sage-700"
              >
                {success}
              </p>
            )}
          </form>
        )}
      </section>

      <section aria-labelledby="invite-history-heading">
        <h2
          id="invite-history-heading"
          className="font-display text-xl text-stone-900 mb-4"
        >
          Your invitations
        </h2>
        {invitations.length === 0 ? (
          <p className="font-body text-base text-stone-500">
            You haven&apos;t issued any invitations yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full font-body text-base text-stone-700">
              <thead>
                <tr className="border-b border-stone-200 text-left">
                  <th className="pb-2 font-medium text-stone-900 pr-6">Code</th>
                  <th className="pb-2 font-medium text-stone-900 pr-6">Recipient</th>
                  <th className="pb-2 font-medium text-stone-900 pr-6">Status</th>
                  <th className="pb-2 font-medium text-stone-900">Issued</th>
                </tr>
              </thead>
              <tbody>
                {invitations.map((inv) => (
                  <tr key={inv.code} className="border-b border-stone-100">
                    <td className="py-3 pr-6 font-mono text-sm text-stone-600">
                      {inv.code}
                    </td>
                    <td className="py-3 pr-6">
                      <span className="block">{inv.inviteeName}</span>
                      <span className="block text-sm text-stone-400">
                        {inv.inviteeEmail}
                      </span>
                    </td>
                    <td className="py-3 pr-6">
                      <span
                        className={
                          inv.status === 'accepted'
                            ? 'text-sage-700'
                            : inv.status === 'expired'
                              ? 'text-stone-400'
                              : 'text-stone-600'
                        }
                      >
                        {STATUS_LABELS[inv.status]}
                      </span>
                    </td>
                    <td className="py-3 text-sm text-stone-500">
                      {new Date(inv.createdAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
