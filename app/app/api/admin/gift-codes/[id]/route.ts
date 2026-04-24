import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/middleware';
import { getDb } from '@/lib/db/connection';
import { logAdminAction } from '@/lib/admin/actions';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { response } = await requireAdmin();
  if (response) return response;

  const { id } = await params;
  const codeId = parseInt(id, 10);
  if (isNaN(codeId)) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  }

  const db = getDb();
  const row = db
    .prepare(
      `SELECT
         gc.id, gc.code, gc.format_locked, gc.max_uses, gc.uses_remaining,
         gc.created_at, gc.expires_at,
         recipient.username as recipient_username
       FROM study_gift_codes gc
       JOIN users recipient ON recipient.id = gc.user_id
       WHERE gc.id = ?`
    )
    .get(codeId) as {
    id: number;
    code: string;
    format_locked: string;
    max_uses: number;
    uses_remaining: number;
    created_at: string;
    expires_at: string | null;
    recipient_username: string;
  } | undefined;

  if (!row) {
    return NextResponse.json({ error: 'Gift code not found' }, { status: 404 });
  }

  return NextResponse.json({
    giftCode: {
      id: row.id,
      code: row.code,
      format_locked: row.format_locked,
      max_uses: row.max_uses,
      uses_remaining: row.uses_remaining,
      created_at: row.created_at,
      expires_at: row.expires_at,
      recipient_username: row.recipient_username,
    },
  });
}

// PATCH: soft-invalidate by zeroing out remaining uses. Preserves the row
// for audit (we keep "Josh was sent 5 Standard credits and the admin later
// revoked 3 unused"), which a hard-delete would erase. Block when already
// depleted so the response is honest.
export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, response } = await requireAdmin();
  if (response) return response;

  const { id } = await params;
  const codeId = parseInt(id, 10);
  if (isNaN(codeId)) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  }

  const db = getDb();
  const row = db
    .prepare(
      'SELECT uses_remaining, max_uses FROM study_gift_codes WHERE id = ?'
    )
    .get(codeId) as { uses_remaining: number; max_uses: number } | undefined;

  if (!row) {
    return NextResponse.json({ error: 'Gift code not found' }, { status: 404 });
  }
  if (row.uses_remaining === 0) {
    return NextResponse.json(
      { error: 'Gift code is already depleted' },
      { status: 409 }
    );
  }

  db.prepare(
    'UPDATE study_gift_codes SET uses_remaining = 0 WHERE id = ?'
  ).run(codeId);

  logAdminAction({
    adminId: user.userId,
    actionType: 'invalidate_gift_code',
    targetType: 'gift_code',
    targetId: codeId,
    details: { uses_revoked: row.uses_remaining, max_uses: row.max_uses },
  });

  return NextResponse.json({ success: true });
}

// DELETE: hard-remove. Only allowed on fully-untouched codes so we don't
// lose records of redemptions. An already-consumed code should be soft-
// invalidated via PATCH instead.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, response } = await requireAdmin();
  if (response) return response;

  const { id } = await params;
  const codeId = parseInt(id, 10);
  if (isNaN(codeId)) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  }

  const db = getDb();
  const row = db
    .prepare(
      'SELECT uses_remaining, max_uses FROM study_gift_codes WHERE id = ?'
    )
    .get(codeId) as { uses_remaining: number; max_uses: number } | undefined;

  if (!row) {
    return NextResponse.json({ error: 'Gift code not found' }, { status: 404 });
  }
  if (row.uses_remaining !== row.max_uses) {
    return NextResponse.json(
      { error: 'Gift code has already been used and cannot be deleted' },
      { status: 409 }
    );
  }

  db.prepare('DELETE FROM study_gift_codes WHERE id = ?').run(codeId);

  logAdminAction({
    adminId: user.userId,
    actionType: 'delete_gift_code',
    targetType: 'gift_code',
    targetId: codeId,
    details: { max_uses: row.max_uses },
  });

  return NextResponse.json({ success: true });
}
