import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import { requireAdmin } from '@/lib/auth/middleware';
import { getDb } from '@/lib/db/connection';
import { logAdminAction } from '@/lib/admin/actions';

const createSchema = z.object({
  user_id: z.number().int().positive(),
  format_locked: z.enum(['simple', 'standard', 'comprehensive']),
  max_uses: z.number().int().min(1).max(100).default(1),
  expires_at: z.string().datetime({ offset: true }).nullable().optional(),
});

function deriveStatus(
  usesRemaining: number,
  expiresAt: string | null
): 'active' | 'depleted' | 'expired' {
  if (expiresAt && new Date(expiresAt) < new Date()) return 'expired';
  if (usesRemaining === 0) return 'depleted';
  return 'active';
}

export async function GET(request: NextRequest) {
  const { response } = await requireAdmin();
  if (response) return response;

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') ?? '50', 10)));
  const offset = (page - 1) * pageSize;

  const db = getDb();

  const countRow = db
    .prepare('SELECT COUNT(*) as total FROM study_gift_codes')
    .get() as { total: number };

  const rows = db
    .prepare(
      `SELECT
         gc.id, gc.code, gc.format_locked, gc.max_uses, gc.uses_remaining,
         gc.created_at, gc.expires_at,
         recipient.id as recipient_id,
         recipient.username as recipient_username
       FROM study_gift_codes gc
       JOIN users recipient ON recipient.id = gc.user_id
       ORDER BY gc.created_at DESC
       LIMIT ? OFFSET ?`
    )
    .all(pageSize, offset) as Array<{
    id: number;
    code: string;
    format_locked: 'simple' | 'standard' | 'comprehensive';
    max_uses: number;
    uses_remaining: number;
    created_at: string;
    expires_at: string | null;
    recipient_id: number;
    recipient_username: string;
  }>;

  const items = rows.map((r) => ({
    ...r,
    status: deriveStatus(r.uses_remaining, r.expires_at),
  }));

  const total = countRow.total;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return NextResponse.json({ items, page, pageSize, total, totalPages });
}

export async function POST(request: NextRequest) {
  const { user, response } = await requireAdmin();
  if (response) return response;

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { user_id, format_locked, max_uses, expires_at } = parsed.data;
  const db = getDb();

  const recipient = db
    .prepare('SELECT id, username FROM users WHERE id = ?')
    .get(user_id) as { id: number; username: string } | undefined;
  if (!recipient) {
    return NextResponse.json({ error: 'Recipient user not found' }, { status: 404 });
  }

  const code = randomBytes(16).toString('hex').toUpperCase();

  const result = db
    .prepare(
      `INSERT INTO study_gift_codes
         (code, user_id, format_locked, max_uses, uses_remaining, created_by, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(code, user_id, format_locked, max_uses, max_uses, user.userId, expires_at ?? null);

  logAdminAction({
    adminId: user.userId,
    actionType: 'create_gift_code',
    targetType: 'gift_code',
    targetId: result.lastInsertRowid as number,
    details: { recipient: recipient.username, format_locked, max_uses },
  });

  const created = db
    .prepare('SELECT * FROM study_gift_codes WHERE id = ?')
    .get(result.lastInsertRowid);

  return NextResponse.json({ giftCode: created }, { status: 201 });
}
