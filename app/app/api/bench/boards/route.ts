import { requireAuth } from '@/lib/auth/middleware'
import { createRateLimiter, getClientIp } from '@/lib/rate-limit'
import { z } from 'zod'
import { getBenchBoards, createBenchBoard } from '@/lib/db/bench/queries'

const isRateLimited = createRateLimiter({ windowMs: 60_000, max: 60 })

const createSchema = z.object({
  title: z.string().min(1).max(120),
})

export async function GET(request: Request) {
  const { user, response } = await requireAuth()
  if (response) return response

  const ip = getClientIp(request)
  if (isRateLimited(ip)) {
    return Response.json({ error: 'Too many requests' }, { status: 429 })
  }

  const boards = getBenchBoards(user.userId)
  return Response.json({ boards })
}

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

  const board = createBenchBoard(user.userId, parsed.data.title)
  return Response.json({ board }, { status: 201 })
}
