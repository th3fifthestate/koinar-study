import type { InviteRow } from '@/lib/db/types';

interface Props { invitations: InviteRow[]; }

const STATUS_LABELS: Record<InviteRow['status'], string> = {
  pending: 'Pending',
  accepted: 'Accepted',
  expired: 'Expired',
};

export function InvitationsTab({ invitations }: Props) {
  if (invitations.length === 0) {
    return (
      <p className="font-body text-base text-stone-500">
        You haven&apos;t issued any invitations yet.{' '}
        <a
          href="/onboarding"
          className="text-sage-700 underline underline-offset-2 hover:text-sage-900"
        >
          Issue an invitation
        </a>
      </p>
    );
  }

  return (
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
          {invitations.map(inv => (
            <tr key={inv.code} className="border-b border-stone-100">
              <td className="py-3 pr-6 font-mono text-sm text-stone-600">{inv.code}</td>
              <td className="py-3 pr-6">
                <span className="block">{inv.inviteeName}</span>
                <span className="block text-sm text-stone-400">{inv.inviteeEmail}</span>
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
                  month: 'short', day: 'numeric', year: 'numeric',
                })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
