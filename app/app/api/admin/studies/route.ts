import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/middleware';
import { getDb } from '@/lib/db/connection';
import { parsePagination, paginatedResponse } from '@/lib/admin/pagination';

interface StudyRow {
  id: number;
  title: string;
  slug: string;
  is_public: number;
  is_featured: number;
  created_at: string;
  created_by_username: string;
  category_name: string | null;
  tags: string | null;
  favorite_count: number;
  annotation_count: number;
}

export async function GET(request: NextRequest) {
  const { response } = await requireAdmin();
  if (response) return response;

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search')?.trim() ?? '';
  const pg = parsePagination(searchParams);

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
    .all(...queryParams, pg.pageSize, pg.offset) as StudyRow[];

  const items = rows.map((s) => ({
    id: s.id,
    title: s.title,
    slug: s.slug,
    is_public: s.is_public,
    is_featured: s.is_featured,
    created_at: s.created_at,
    created_by_username: s.created_by_username,
    category_name: s.category_name,
    tags: s.tags,
    favorite_count: s.favorite_count,
    annotation_count: s.annotation_count,
  }));

  return NextResponse.json(paginatedResponse(items, countRow.total, pg));
}
