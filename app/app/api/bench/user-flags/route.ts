import { requireAuth } from '@/lib/auth/middleware'
import { NextResponse } from 'next/server'
import { getUserFlags, patchUserFlags } from '@/lib/bench/user-flags'

export async function GET() {
  const { user, response } = await requireAuth()
  if (response) return response

  const flags = getUserFlags(String(user.userId))
  return NextResponse.json({
    has_seen_bench_intro: flags.has_seen_bench_intro === 1,
    has_drawn_first_connection: flags.has_drawn_first_connection === 1,
  })
}

export async function PATCH(req: Request) {
  const { user, response } = await requireAuth()
  if (response) return response

  const body = await req.json() as {
    has_seen_bench_intro?: boolean
    has_drawn_first_connection?: boolean
  }
  const patch: Parameters<typeof patchUserFlags>[1] = {}
  if (typeof body.has_seen_bench_intro === 'boolean') {
    patch.has_seen_bench_intro = body.has_seen_bench_intro ? 1 : 0
  }
  if (typeof body.has_drawn_first_connection === 'boolean') {
    patch.has_drawn_first_connection = body.has_drawn_first_connection ? 1 : 0
  }
  patchUserFlags(String(user.userId), patch)
  return NextResponse.json({ ok: true })
}
