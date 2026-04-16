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

  const conditions: string[] = [];
  const queryParams: (string | number)[] = [];

  if (search) {
    conditions.push('(s.title LIKE ? OR s.summary LIKE ?)');
    queryParams.push(`%${search}%`, `%${search}%`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countRow = db
    .prepare(
      `SELECT COUNT(*) as total
       FROM studies s
       LEFT JOIN categories c ON c.id = s.category_id
       ${whereClause}`
    )
    .get(...queryParams) as { total: number };

  const rows = db
    .prepare(
      `SELECT
         s.id, s.title, s.slug, s.is_public, s.is_featured, s.created_at,
         u.username as created_by_username,
         c.name as category_name,
         (SELECT GROUP_CONCAT(st.tag_name, ',')
          FROM study_tags st WHERE st.study_id = s.id) as tags,
         (SELECT COUNT(*) FROM favorites f WHERE f.study_id = s.id) as favorite_count,
         (SELECT COUNT(*) FROM annotations a WHERE a.study_id = s.id) as annotation_count
       FROM studies s
       JOIN users u ON u.id = s.created_by
       LEFT JOIN categories c ON c.id = s.category_id
       ${whereClause}
       ORDER BY s.created_at DESC
       LIMIT ? OFFSET ?`
    )
    .all(...queryParams, pageSize, offset);

  const total = countRow.total;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return NextResponse.json({ items: rows, page, pageSize, total, totalPages });
}
