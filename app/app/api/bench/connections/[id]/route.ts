import { requireAdmin } from '@/lib/auth/middleware'
import { createRateLimiter, getClientIp } from '@/lib/rate-limit'
import { z } from 'zod'
import { updateBenchConnection, deleteBenchConnection } from '@/lib/db/bench/queries'
import { getDb } from '@/lib/db/connection'
import type { BenchConnection } from '@/lib/db/types'

const isRateLimited = createRateLimiter({ windowMs: 60_000, max: 60 })

const patchSchema = z.object({
  label: z.string().max(60).nullable(),
})

function getConnectionForUser(id: string, userId: number): BenchConnection | null {
  return (
    (getDb()
      .prepare(
        `SELECT cn.* FROM bench_connections cn
         JOIN bench_boards b ON cn.board_id = b.id
         WHERE cn.id = ? AND b.user_id = ?`
      )
      .get(id, userId) as BenchConnection | undefined) ?? null
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

  const { id } = await params
  const conn = getConnectionForUser(id, user.userId)
  if (!conn) return Response.json({ error: 'Not found' }, { status: 404 })

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

  const updated = updateBenchConnection(id, conn.board_id, parsed.data.label)
  return Response.json({ connection: updated })
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

  const { id } = await params
  const conn = getConnectionForUser(id, user.userId)
  if (!conn) return Response.json({ error: 'Not found' }, { status: 404 })

  deleteBenchConnection(id, conn.board_id)
  return Response.json({ ok: true })
}
