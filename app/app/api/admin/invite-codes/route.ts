import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/middleware';
import { getDb } from '@/lib/db/connection';

export async function GET(request: NextRequest) {
  const { response } = await requireAdmin();
  if (response) return response;

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') ?? '50', 10)));
  const offset = (page - 1) * pageSize;

  const db = getDb();

  const countRow = db
    .prepare('SELECT COUNT(*) as total FROM invite_codes')
    .get() as { total: number };

  const rows = db
    .prepare(
      `SELECT
         ic.id, ic.code, ic.invitee_name, ic.invitee_email,
         ic.is_active, ic.used_at, ic.created_at,
         ic.linked_study_id,
         creator.username as created_by_username,
         s.title as linked_study_title
       FROM invite_codes ic
       JOIN users creator ON creator.id = ic.created_by
       LEFT JOIN studies s ON s.id = ic.linked_study_id
       ORDER BY ic.created_at DESC
       LIMIT ? OFFSET ?`
    )
    .all(pageSize, offset);

  const total = countRow.total;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return NextResponse.json({ items: rows, page, pageSize, total, totalPages });
}
