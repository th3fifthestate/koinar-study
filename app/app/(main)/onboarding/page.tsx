import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { getDb } from '@/lib/db/connection';
import { OnboardingFlow } from '@/components/onboarding/onboarding-flow';

export const dynamic = 'force-dynamic';

export default async function OnboardingPage() {
  const session = await getSession();
  if (!session.userId) redirect('/');
  if (!session.isApproved) redirect('/pending');

  const db = getDb();
  const user = db
    .prepare(
      'SELECT id, username, display_name, invited_by, onboarding_completed FROM users WHERE id = ?'
    )
    .get(session.userId) as
    | { id: number; username: string; display_name: string | null; invited_by: number | null; onboarding_completed: number }
    | undefined;

  if (!user) redirect('/');
  if (user.onboarding_completed) redirect('/');

  let inviterName: string | undefined;
  let linkedStudySlug: string | undefined;
  let linkedStudyTitle: string | undefined;

  if (user.invited_by) {
    const inviter = db
      .prepare('SELECT display_name, username FROM users WHERE id = ?')
      .get(user.invited_by) as { display_name: string | null; username: string } | undefined;
    inviterName = inviter?.display_name ?? inviter?.username;

    const invite = db
      .prepare(
        `SELECT s.slug, s.title
         FROM invite_codes ic
         JOIN studies s ON s.id = ic.linked_study_id
         WHERE ic.used_by = ?
         ORDER BY ic.used_at DESC
         LIMIT 1`
      )
      .get(user.id) as { slug: string; title: string } | undefined;
    linkedStudySlug = invite?.slug;
    linkedStudyTitle = invite?.title;
  }

  // Waitlist path (no inviter): try to pick a random public study so Step 3 has something real.
  if (!linkedStudySlug) {
    const random = db
      .prepare('SELECT slug, title FROM studies WHERE is_public = 1 ORDER BY RANDOM() LIMIT 1')
      .get() as { slug: string; title: string } | undefined;
    if (random) {
      linkedStudySlug = random.slug;
      linkedStudyTitle = random.title;
    }
  }

  return (
    <OnboardingFlow
      username={user.display_name || user.username}
      inviterName={inviterName}
      linkedStudySlug={linkedStudySlug}
      linkedStudyTitle={linkedStudyTitle}
    />
  );
}
