import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getCurrentUser } from '@/lib/auth/session';
import { getActiveGiftCodesForUser } from '@/lib/db/queries';
import { getDb } from '@/lib/db/connection';
import { GenerateClient } from './generate-client';
import type { Entitlement, Format } from './types';

export const metadata: Metadata = {
  title: 'Begin a study \u2014 Koinar',
  description: 'Choose a passage, a question, or a topic. Koinar will work through it with care.',
};

export default async function GeneratePage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/generate');
  if (!user.isApproved) redirect('/pending');

  // Resolve entitlement — never expose the encrypted key
  const userRow = getDb()
    .prepare('SELECT api_key_encrypted FROM users WHERE id = ?')
    .get(user.userId) as { api_key_encrypted: string | null } | undefined;

  const hasApiKey = Boolean(userRow?.api_key_encrypted);
  const giftCodes = getActiveGiftCodesForUser(user.userId);

  let entitlement: Entitlement;
  if (hasApiKey) {
    entitlement = { kind: 'byok' };
  } else if (user.isAdmin) {
    entitlement = { kind: 'admin' };
  } else if (giftCodes.length > 0) {
    // Aggregate credits by format
    const credits: Partial<Record<Format, number>> = {};
    for (const gc of giftCodes) {
      const fmt = gc.format_locked as Format;
      credits[fmt] = (credits[fmt] ?? 0) + gc.uses_remaining;
    }
    entitlement = { kind: 'gift', credits };
  } else {
    entitlement = { kind: 'none' };
  }

  return <GenerateClient user={user} entitlement={entitlement} />;
}
