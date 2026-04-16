import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/middleware';
import { getDb } from '@/lib/db/connection';
import { parsePagination, paginatedResponse } from '@/lib/admin/pagination';

interface InviteCodeRow {
  id: number;
  code: string;
  invitee_name: string;
  invitee_email: string;
  is_active: number;
  used_at: string | null;
  created_at: string;
  linked_study_id: number | null;
  created_by_username: string;
  linked_study_title: string | null;
}

export async function GET(request: NextRequest) {
  const { response } = await requireAdmin();
  if (response) return response;

  const { searchParams } = new URL(request.url);
  const pg = parsePagination(searchParams);

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
    .all(pg.pageSize, pg.offset) as InviteCodeRow[];

  const items = rows.map((ic) => ({
    id: ic.id,
    code: ic.code,
    invitee_name: ic.invitee_name,
    invitee_email: ic.invitee_email,
    is_active: ic.is_active,
    used_at: ic.used_at,
    created_at: ic.created_at,
    linked_study_id: ic.linked_study_id,
    created_by_username: ic.created_by_username,
    linked_study_title: ic.linked_study_title,
  }));

  return NextResponse.json(paginatedResponse(items, countRow.total, pg));
}
