import { requireAuth } from '@/lib/auth/middleware'
import { createRateLimiter, getClientIp } from '@/lib/rate-limit'
import { getBenchBoard } from '@/lib/db/bench/queries'
import { prewarmBoard } from '@/lib/bench/prewarm'

const isRateLimited = createRateLimiter({ windowMs: 60_000, max: 10 })

interface Props {
  params: Promise<{ boardId: string }>
}

export async function POST(request: Request, { params }: Props) {
  const { user, response } = await requireAuth()
  if (response) return response

  const ip = getClientIp(request)
  if (isRateLimited(ip)) {
    return Response.json({ error: 'Too many requests' }, { status: 429 })
  }

  const { boardId } = await params
  const board = getBenchBoard(boardId, user.userId)
  if (!board) return Response.json({ error: 'Not found' }, { status: 404 })

  await prewarmBoard(boardId)
  return Response.json({ ok: true })
}
