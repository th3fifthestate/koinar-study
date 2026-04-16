import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/middleware';
import { getDb } from '@/lib/db/connection';

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
         recipient.id as recipient_id,
         recipient.username as recipient_username
       FROM study_gift_codes gc
       JOIN users recipient ON recipient.id = gc.user_id
       WHERE gc.id = ?`
    )
    .get(codeId);

  if (!row) {
    return NextResponse.json({ error: 'Gift code not found' }, { status: 404 });
  }

  return NextResponse.json({ giftCode: row });
}
