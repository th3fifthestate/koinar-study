import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/middleware';
import { getDb } from '@/lib/db/connection';
import { logAdminAction } from '@/lib/admin/actions';

const patchSchema = z.object({
  is_approved: z.boolean().optional(),
  is_banned: z.boolean().optional(),
  is_admin: z.boolean().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, response } = await requireAdmin();
  if (response) return response;

  const { id } = await params;
  const targetId = parseInt(id, 10);
  if (isNaN(targetId)) {
    return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  const { is_approved, is_banned, is_admin } = parsed.data;
  const db = getDb();

  const target = db
    .prepare('SELECT id, username FROM users WHERE id = ?')
    .get(targetId) as { id: number; username: string } | undefined;
  if (!target) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Self-protection: admins cannot modify their own admin or banned status at all
  if (targetId === user.userId && (is_admin !== undefined || is_banned !== undefined)) {
    return NextResponse.json(
      { error: 'Cannot modify your own admin or banned status' },
      { status: 400 }
    );
  }

  if (is_approved !== undefined) {
    db.prepare('UPDATE users SET is_approved = ? WHERE id = ?').run(
      is_approved ? 1 : 0,
      targetId
    );
    logAdminAction({
      adminId: user.userId,
      actionType: is_approved ? 'approve_user' : 'unapprove_user',
      targetType: 'user',
      targetId,
      details: { username: target.username },
    });
  }

  if (is_banned !== undefined) {
    db.prepare('UPDATE users SET is_banned = ? WHERE id = ?').run(
      is_banned ? 1 : 0,
      targetId
    );
    logAdminAction({
      adminId: user.userId,
      actionType: is_banned ? 'ban_user' : 'unban_user',
      targetType: 'user',
      targetId,
      details: { username: target.username },
    });
  }

  if (is_admin !== undefined) {
    db.prepare('UPDATE users SET is_admin = ? WHERE id = ?').run(
      is_admin ? 1 : 0,
      targetId
    );
    logAdminAction({
      adminId: user.userId,
      actionType: is_admin ? 'grant_admin' : 'revoke_admin',
      targetType: 'user',
      targetId,
      details: { username: target.username },
    });
  }

  const updated = db
    .prepare(
      `SELECT
         id, username, email, display_name,
         is_admin, is_approved, is_banned, created_at,
         (SELECT COUNT(*) FROM studies s WHERE s.created_by = users.id) as study_count
       FROM users WHERE id = ?`
    )
    .get(targetId) as {
    id: number;
    username: string;
    email: string;
    display_name: string | null;
    is_admin: number;
    is_approved: number;
    is_banned: number;
    created_at: string;
    study_count: number;
  };

  return NextResponse.json({
    user: {
      id: updated.id,
      username: updated.username,
      email: updated.email,
      display_name: updated.display_name,
      is_admin: updated.is_admin,
      is_approved: updated.is_approved,
      is_banned: updated.is_banned,
      created_at: updated.created_at,
      study_count: updated.study_count,
    },
  });
}
