// app/app/api/admin/invite-codes/[id]/route.ts
//
// Admin-only endpoints for managing a single invite code.
//
// - PATCH: soft-invalidate (set is_active=0). Safe on any invite.
// - DELETE: hard-remove. Refused if the invite has already been used,
//   because used invites have a real FK relationship (users.invited_by)
//   and the consumed audit trail matters. If the admin truly wants to
//   nuke a used invite, they can do it from the DB shell.
//
// Both require admin. Route Handler is the sole auth surface per
// CVE-2025-29927 — middleware is redirect-only.
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/middleware';
import { getDb } from '@/lib/db/connection';
import { logAdminAction } from '@/lib/admin/actions';
import { createRateLimiter } from '@/lib/rate-limit';

// Per-admin throttle, shared across PATCH + DELETE. User-keyed so NAT-
// sharing admins don't 429 each other.
const isMutationLimited = createRateLimiter({ windowMs: 60_000, max: 30 });

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, response } = await requireAdmin();
  if (response) return response;

  if (isMutationLimited(`admin:${user.userId}`)) {
    return NextResponse.json(
      { error: 'Too many requests. Try again in a minute.' },
      { status: 429, headers: { 'Retry-After': '60' } }
    );
  }

  const { id } = await params;
  const codeId = parseInt(id, 10);
  if (isNaN(codeId)) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  }

  const db = getDb();

  // Block invalidating an already-consumed invite — nothing useful happens
  // and it muddies the audit trail. Also block double-invalidation to keep
  // the response honest.
  const row = db
    .prepare('SELECT is_active, used_at FROM invite_codes WHERE id = ?')
    .get(codeId) as { is_active: number; used_at: string | null } | undefined;

  if (!row) {
    return NextResponse.json({ error: 'Invite not found' }, { status: 404 });
  }
  if (row.used_at) {
    return NextResponse.json(
      { error: 'Invite has already been used and cannot be invalidated' },
      { status: 409 }
    );
  }
  if (!row.is_active) {
    return NextResponse.json(
      { error: 'Invite is already inactive' },
      { status: 409 }
    );
  }

  db.prepare('UPDATE invite_codes SET is_active = 0 WHERE id = ?').run(codeId);

  logAdminAction({
    adminId: user.userId,
    actionType: 'invalidate_invite_code',
    targetType: 'invite_code',
    targetId: codeId,
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, response } = await requireAdmin();
  if (response) return response;

  if (isMutationLimited(`admin:${user.userId}`)) {
    return NextResponse.json(
      { error: 'Too many requests. Try again in a minute.' },
      { status: 429, headers: { 'Retry-After': '60' } }
    );
  }

  const { id } = await params;
  const codeId = parseInt(id, 10);
  if (isNaN(codeId)) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  }

  const db = getDb();

  const row = db
    .prepare('SELECT used_at FROM invite_codes WHERE id = ?')
    .get(codeId) as { used_at: string | null } | undefined;

  if (!row) {
    return NextResponse.json({ error: 'Invite not found' }, { status: 404 });
  }
  if (row.used_at) {
    // Used invites stay in the DB — users.invited_by references created_by,
    // but the invite row itself is referenced in email-verification history.
    // Soft-invalidate via PATCH instead.
    return NextResponse.json(
      { error: 'Invite has already been used and cannot be deleted' },
      { status: 409 }
    );
  }

  // Delete any orphaned email verification codes tied to this invite so we
  // don't leave dangling rows. (email_verification_codes.invite_code_id FK
  // is ON DELETE CASCADE, but explicit delete keeps the transaction honest
  // if foreign-key enforcement is ever toggled.)
  db.transaction(() => {
    db.prepare(
      'DELETE FROM email_verification_codes WHERE invite_code_id = ?'
    ).run(codeId);
    db.prepare('DELETE FROM invite_codes WHERE id = ?').run(codeId);
  })();

  logAdminAction({
    adminId: user.userId,
    actionType: 'delete_invite_code',
    targetType: 'invite_code',
    targetId: codeId,
  });

  return NextResponse.json({ success: true });
}
