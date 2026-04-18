import { requireAuth } from '@/lib/auth/middleware'
import { createRateLimiter, getClientIp } from '@/lib/rate-limit'
import { getStudies } from '@/lib/db/queries'

const isRateLimited = createRateLimiter({ windowMs: 60_000, max: 120 })

export async function GET(request: Request) {
  const ip = getClientIp(request)
  if (isRateLimited(ip)) {
    return Response.json({ error: 'Too many requests' }, { status: 429 })
  }

  const { user, response } = await requireAuth()
  if (response) return response

  const url = new URL(request.url)
  const q = url.searchParams.get('q') ?? ''

  if (!q.trim() || q.trim().length < 2 || q.length > 200) {
    return Response.json({ studies: [] })
  }

  const { studies } = getStudies({ q, userId: user.userId, limit: 20 })
  return Response.json({ studies })
}
