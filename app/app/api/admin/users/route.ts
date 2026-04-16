import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/middleware';
import { getDb } from '@/lib/db/connection';

export async function GET(request: NextRequest) {
  const { response } = await requireAdmin();
  if (response) return response;

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search')?.trim() ?? '';
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') ?? '50', 10)));
  const offset = (page - 1) * pageSize;

  const db = getDb();

  const whereClause = search ? `WHERE u.username LIKE ? OR u.email LIKE ?` : '';
  const bindParams = search ? [`%${search}%`, `%${search}%`] : [];

  const countRow = db
    .prepare(`SELECT COUNT(*) as total FROM users u ${whereClause}`)
    .get(...bindParams) as { total: number };

  const rows = db
    .prepare(
      `SELECT
         u.id, u.username, u.email, u.display_name,
         u.is_admin, u.is_approved, u.is_banned, u.created_at,
         (SELECT COUNT(*) FROM studies s WHERE s.created_by = u.id) as study_count
       FROM users u
       ${whereClause}
       ORDER BY u.created_at DESC
       LIMIT ? OFFSET ?`
    )
    .all(...bindParams, pageSize, offset);

  const total = countRow.total;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return NextResponse.json({ items: rows, page, pageSize, total, totalPages });
}
