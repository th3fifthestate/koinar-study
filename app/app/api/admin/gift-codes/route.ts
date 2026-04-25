import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import { requireAdmin } from '@/lib/auth/middleware';
import { getDb } from '@/lib/db/connection';
import { logAdminAction } from '@/lib/admin/actions';
import { parsePagination, paginatedResponse } from '@/lib/admin/pagination';
import { createRateLimiter } from '@/lib/rate-limit';

// Per-admin throttle on mutating writes. User-keyed (not IP) because admins
// may share corporate NAT. 30 creates/minute is generous for legitimate bulk
// work, tight enough to stop a hijacked session or runaway script.
const isMutationLimited = createRateLimiter({ windowMs: 60_000, max: 30 });

const createSchema = z.object({
  user_id: z.number().int().positive(),
  format_locked: z.enum(['quick', 'standard', 'comprehensive']),
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
  const pg = parsePagination(searchParams);

  const db = getDb();

  const countRow = db
    .prepare('SELECT COUNT(*) as total FROM study_gift_codes')
    .get() as { total: number };

  const rows = db
    .prepare(
      `SELECT
         gc.id, gc.code, gc.format_locked, gc.max_uses, gc.uses_remaining,
         gc.created_at, gc.expires_at,
         recipient.username as recipient_username
       FROM study_gift_codes gc
       JOIN users recipient ON recipient.id = gc.user_id
       ORDER BY gc.created_at DESC
       LIMIT ? OFFSET ?`
    )
    .all(pg.pageSize, pg.offset) as Array<{
    id: number;
    code: string;
    format_locked: 'quick' | 'standard' | 'comprehensive';
    max_uses: number;
    uses_remaining: number;
    created_at: string;
    expires_at: string | null;
    recipient_username: string;
  }>;

  const items = rows.map((r) => ({
    id: r.id,
    code: r.code,
    format_locked: r.format_locked,
    max_uses: r.max_uses,
    uses_remaining: r.uses_remaining,
    created_at: r.created_at,
    expires_at: r.expires_at,
    recipient_username: r.recipient_username,
    status: deriveStatus(r.uses_remaining, r.expires_at),
  }));

  return NextResponse.json(paginatedResponse(items, countRow.total, pg));
}

export async function POST(request: NextRequest) {
  const { user, response } = await requireAdmin();
  if (response) return response;

  if (isMutationLimited(`admin:${user.userId}`)) {
    return NextResponse.json(
      { error: 'Too many requests. Try again in a minute.' },
      { status: 429, headers: { 'Retry-After': '60' } }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
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
    .prepare(
      `SELECT gc.id, gc.code, gc.format_locked, gc.max_uses, gc.uses_remaining,
              gc.created_at, gc.expires_at,
              recipient.username as recipient_username
       FROM study_gift_codes gc
       JOIN users recipient ON recipient.id = gc.user_id
       WHERE gc.id = ?`
    )
    .get(result.lastInsertRowid) as {
    id: number;
    code: string;
    format_locked: string;
    max_uses: number;
    uses_remaining: number;
    created_at: string;
    expires_at: string | null;
    recipient_username: string;
  };

  return NextResponse.json({
    giftCode: {
      id: created.id,
      code: created.code,
      format_locked: created.format_locked,
      max_uses: created.max_uses,
      uses_remaining: created.uses_remaining,
      created_at: created.created_at,
      expires_at: created.expires_at,
      recipient_username: created.recipient_username,
      status: deriveStatus(created.uses_remaining, created.expires_at),
    },
  }, { status: 201 });
}
