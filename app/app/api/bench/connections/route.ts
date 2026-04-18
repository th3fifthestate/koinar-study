import { requireAuth } from '@/lib/auth/middleware'
import { createRateLimiter, getClientIp } from '@/lib/rate-limit'
import { z } from 'zod'
import {
  getBenchBoard,
  createBenchConnection,
  getBenchClippingBoardId,
} from '@/lib/db/bench/queries'

const isRateLimited = createRateLimiter({ windowMs: 60_000, max: 60 })

const createSchema = z.object({
  board_id: z.string().min(1),
  from_clipping_id: z.string().min(1),
  to_clipping_id: z.string().min(1),
  label: z.string().max(60).nullable().optional(),
})

export async function POST(request: Request) {
  const { user, response } = await requireAuth()
  if (response) return response

  const ip = getClientIp(request)
  if (isRateLimited(ip)) {
    return Response.json({ error: 'Too many requests' }, { status: 429 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json(
      { error: 'Invalid request', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { board_id, from_clipping_id, to_clipping_id, label } = parsed.data

  if (!getBenchBoard(board_id, user.userId)) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  if (
    getBenchClippingBoardId(from_clipping_id) !== board_id ||
    getBenchClippingBoardId(to_clipping_id) !== board_id
  ) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  const connection = createBenchConnection(board_id, from_clipping_id, to_clipping_id, label ?? null)
  return Response.json({ connection }, { status: 201 })
}
