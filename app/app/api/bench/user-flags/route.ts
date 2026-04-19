import { requireAuth } from '@/lib/auth/middleware'
import { createRateLimiter, getClientIp } from '@/lib/rate-limit'
import { NextResponse } from 'next/server'
import { getUserFlags, patchUserFlags } from '@/lib/bench/user-flags'

const isRateLimited = createRateLimiter({ windowMs: 60_000, max: 60 })

export async function GET(request: Request) {
  const { user, response } = await requireAuth()
  if (response) return response

  const ip = getClientIp(request)
  if (isRateLimited(ip)) {
    return Response.json({ error: 'Too many requests' }, { status: 429 })
  }

  const flags = getUserFlags(String(user.userId))
  return NextResponse.json({
    has_seen_bench_intro: flags.has_seen_bench_intro === 1,
    has_drawn_first_connection: flags.has_drawn_first_connection === 1,
  })
}

export async function PATCH(request: Request) {
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

  const b = body as {
    has_seen_bench_intro?: boolean
    has_drawn_first_connection?: boolean
  }
  const patch: Parameters<typeof patchUserFlags>[1] = {}
  if (typeof b.has_seen_bench_intro === 'boolean') {
    patch.has_seen_bench_intro = b.has_seen_bench_intro ? 1 : 0
  }
  if (typeof b.has_drawn_first_connection === 'boolean') {
    patch.has_drawn_first_connection = b.has_drawn_first_connection ? 1 : 0
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: true })
  }

  patchUserFlags(String(user.userId), patch)
  return NextResponse.json({ ok: true })
}
