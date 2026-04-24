import { requireAdmin } from '@/lib/auth/middleware'
import { createRateLimiter, getClientIp } from '@/lib/rate-limit'
import { z } from 'zod'
import { updateBenchClipping, deleteBenchClipping } from '@/lib/db/bench/queries'
import { getDb } from '@/lib/db/connection'
import type { BenchClipping } from '@/lib/db/types'

const isRateLimited = createRateLimiter({ windowMs: 60_000, max: 240 })
const isUserRateLimited = createRateLimiter({ windowMs: 60_000, max: 240 })

// source_ref is intentionally not patchable — it is the typed payload set at
// creation and later mutations would require re-validating the discriminated
// union. Clients should delete + recreate the clipping instead.
const patchSchema = z.object({
  x: z.number().finite().optional(),
  y: z.number().finite().optional(),
  width: z.number().positive().finite().optional(),
  height: z.number().positive().finite().optional(),
  color: z.string().max(32).nullable().optional(),
  user_label: z.string().max(80).nullable().optional(),
  z_index: z.number().int().optional(),
})

const CLIPPING_COLS_JOIN =
  'c.id, c.board_id, c.clipping_type, c.source_ref, c.x, c.y, c.width, c.height, c.color, c.user_label, c.z_index, c.created_at'

function getClippingForUser(clippingId: string, userId: number): BenchClipping | null {
  return (
    (getDb()
      .prepare(
        `SELECT ${CLIPPING_COLS_JOIN} FROM bench_clippings c
         JOIN bench_boards b ON c.board_id = b.id
         WHERE c.id = ? AND b.user_id = ?`
      )
      .get(clippingId, userId) as BenchClipping | undefined) ?? null
  )
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, response } = await requireAdmin()
  if (response) return response

  const ip = getClientIp(request)
  if (isRateLimited(ip)) {
    return Response.json({ error: 'Too many requests' }, { status: 429 })
  }

  if (isUserRateLimited(`user-${user.userId}`)) {
    return Response.json({ error: 'Too many requests' }, { status: 429 })
  }

  const { id } = await params
  const clipping = getClippingForUser(id, user.userId)
  if (!clipping) return Response.json({ error: 'Not found' }, { status: 404 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json(
      { error: 'Invalid request', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const updated = updateBenchClipping(id, clipping.board_id, parsed.data)
  return Response.json({ clipping: updated })
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, response } = await requireAdmin()
  if (response) return response

  const ip = getClientIp(request)
  if (isRateLimited(ip)) {
    return Response.json({ error: 'Too many requests' }, { status: 429 })
  }

  if (isUserRateLimited(`user-${user.userId}`)) {
    return Response.json({ error: 'Too many requests' }, { status: 429 })
  }

  const { id } = await params
  const clipping = getClippingForUser(id, user.userId)
  if (!clipping) return Response.json({ error: 'Not found' }, { status: 404 })

  deleteBenchClipping(id, clipping.board_id)
  return Response.json({ ok: true })
}
