import { requireAuth } from '@/lib/auth/middleware'
import { createRateLimiter, getClientIp } from '@/lib/rate-limit'
import { deleteRecentClip } from '@/lib/db/bench/recent-clips-queries'

const isRateLimited = createRateLimiter({ windowMs: 60_000, max: 60 })

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ip = getClientIp(request)
  if (isRateLimited(ip)) {
    return Response.json({ error: 'Too many requests' }, { status: 429 })
  }

  const { user, response } = await requireAuth()
  if (response) return response

  const { id } = await params

  if (!id || typeof id !== 'string') {
    return Response.json({ error: 'Invalid id' }, { status: 400 })
  }

  deleteRecentClip(id, user.userId)
  return new Response(null, { status: 204 })
}
