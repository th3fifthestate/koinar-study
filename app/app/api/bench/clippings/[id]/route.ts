import { requireAuth } from '@/lib/auth/middleware'
import { createRateLimiter, getClientIp } from '@/lib/rate-limit'
import { z } from 'zod'
import { updateBenchClipping, deleteBenchClipping } from '@/lib/db/bench/queries'
import { getDb } from '@/lib/db/connection'
import type { BenchClipping } from '@/lib/db/types'

const isRateLimited = createRateLimiter({ windowMs: 60_000, max: 240 })

const patchSchema = z.object({
  x: z.number().optional(),
  y: z.number().optional(),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  color: z.string().nullable().optional(),
  user_label: z.string().max(80).nullable().optional(),
  z_index: z.number().int().optional(),
  source_ref: z.string().optional(),
})

function getClippingForUser(clippingId: string, userId: string): BenchClipping | null {
  return (
    (getDb()
      .prepare(
        `SELECT c.* FROM bench_clippings c
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
  const { user, response } = await requireAuth()
  if (response) return response

  const ip = getClientIp(request)
  if (isRateLimited(ip)) {
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
  const { user, response } = await requireAuth()
  if (response) return response

  const ip = getClientIp(request)
  if (isRateLimited(ip)) {
    return Response.json({ error: 'Too many requests' }, { status: 429 })
  }

  const { id } = await params
  const clipping = getClippingForUser(id, user.userId)
  if (!clipping) return Response.json({ error: 'Not found' }, { status: 404 })

  deleteBenchClipping(id, clipping.board_id)
  return Response.json({ ok: true })
}
