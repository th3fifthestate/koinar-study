import { requireAdmin } from '@/lib/auth/middleware'
import { createRateLimiter, getClientIp } from '@/lib/rate-limit'
import { z } from 'zod'
import {
  getBenchBoard,
  updateBenchBoard,
  deleteBenchBoard,
  getBenchClippings,
  getBenchConnections,
} from '@/lib/db/bench/queries'

const isRateLimited = createRateLimiter({ windowMs: 60_000, max: 120 })

const patchSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  question: z.string().max(140).optional(),
  camera_x: z.number().optional(),
  camera_y: z.number().optional(),
  camera_zoom: z.number().min(0.25).max(2).optional(),
  is_archived: z.union([z.literal(0), z.literal(1)]).optional(),
})

export async function GET(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const { user, response } = await requireAdmin()
  if (response) return response

  const ip = getClientIp(request)
  if (isRateLimited(ip)) {
    return Response.json({ error: 'Too many requests' }, { status: 429 })
  }

  const { boardId } = await params
  const board = getBenchBoard(boardId, user.userId)
  if (!board) return Response.json({ error: 'Not found' }, { status: 404 })

  const clippings = getBenchClippings(boardId)
  const connections = getBenchConnections(boardId)
  return Response.json({ board, clippings, connections })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const { user, response } = await requireAdmin()
  if (response) return response

  const ip = getClientIp(request)
  if (isRateLimited(ip)) {
    return Response.json({ error: 'Too many requests' }, { status: 429 })
  }

  const { boardId } = await params
  if (!getBenchBoard(boardId, user.userId)) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

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

  const board = updateBenchBoard(boardId, user.userId, parsed.data)
  return Response.json({ board })
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const { user, response } = await requireAdmin()
  if (response) return response

  const ip = getClientIp(request)
  if (isRateLimited(ip)) {
    return Response.json({ error: 'Too many requests' }, { status: 429 })
  }

  const { boardId } = await params
  if (!getBenchBoard(boardId, user.userId)) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  deleteBenchBoard(boardId, user.userId)
  return Response.json({ ok: true })
}
