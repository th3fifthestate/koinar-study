import { requireAdmin } from '@/lib/auth/middleware'
import { createRateLimiter, getClientIp } from '@/lib/rate-limit'
import {
  getRecentClips,
  createRecentClip,
  purgeOldestRecentClips,
} from '@/lib/db/bench/recent-clips-queries'

const isRateLimited = createRateLimiter({ windowMs: 60_000, max: 60 })

export async function GET(request: Request) {
  const { user, response } = await requireAdmin()
  if (response) return response

  const clips = getRecentClips(user.userId, 50)
  return Response.json({ clips })
}

export async function POST(request: Request) {
  const { user, response } = await requireAdmin()
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

  if (typeof body !== 'object' || body === null) {
    return Response.json({ error: 'Invalid body' }, { status: 400 })
  }

  const { payload, clipped_from_route } = body as Record<string, unknown>

  if (typeof payload !== 'string' || payload.length === 0 || payload.length > 2000) {
    return Response.json({ error: 'payload must be a non-empty string ≤ 2000 chars' }, { status: 400 })
  }

  // Validate that payload is valid JSON
  try {
    JSON.parse(payload)
  } catch {
    return Response.json({ error: 'payload must be valid JSON' }, { status: 400 })
  }

  const route =
    typeof clipped_from_route === 'string' && clipped_from_route.length <= 500
      ? clipped_from_route
      : null

  const clip = createRecentClip(user.userId, payload, route)
  purgeOldestRecentClips(user.userId, 100)

  return Response.json({ clip }, { status: 201 })
}
