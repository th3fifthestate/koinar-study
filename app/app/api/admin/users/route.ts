import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/middleware';
import { getDb } from '@/lib/db/connection';
import { parsePagination, paginatedResponse } from '@/lib/admin/pagination';

interface AdminUserRow {
  id: number;
  username: string;
  email: string;
  display_name: string | null;
  is_admin: number;
  is_approved: number;
  is_banned: number;
  created_at: string;
  study_count: number;
}

export async function GET(request: NextRequest) {
  const { response } = await requireAdmin();
  if (response) return response;

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search')?.trim() ?? '';
  const pg = parsePagination(searchParams);

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
    .all(...bindParams, pg.pageSize, pg.offset) as AdminUserRow[];

  const items = rows.map((u) => ({
    id: u.id,
    username: u.username,
    email: u.email,
    display_name: u.display_name,
    is_admin: u.is_admin,
    is_approved: u.is_approved,
    is_banned: u.is_banned,
    created_at: u.created_at,
    study_count: u.study_count,
  }));

  return NextResponse.json(paginatedResponse(items, countRow.total, pg));
}
