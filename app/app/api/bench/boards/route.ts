import { requireAdmin } from '@/lib/auth/middleware'
import { createRateLimiter, getClientIp } from '@/lib/rate-limit'
import { z } from 'zod'
import { getBenchBoards, createBenchBoard } from '@/lib/db/bench/queries'
import { TEMPLATES } from '@/components/bench/templates'
import { instantiateTemplate } from '@/components/bench/templates/instantiate-template'

const isRateLimited = createRateLimiter({ windowMs: 60_000, max: 60 })
const isUserRateLimited = createRateLimiter({ windowMs: 60_000, max: 60 })

const createSchema = z.object({
  title: z.string().min(1).max(120),
  question: z.string().max(140).optional(),
  template_id: z.enum(['blank', 'word-study', 'character-study', 'passage-study']).optional(),
})

export async function GET(request: Request) {
  const { user, response } = await requireAdmin()
  if (response) return response

  const ip = getClientIp(request)
  if (isRateLimited(ip)) {
    return Response.json({ error: 'Too many requests' }, { status: 429 })
  }

  const boards = getBenchBoards(user.userId)
  return Response.json({ boards })
}

export async function POST(request: Request) {
  const { user, response } = await requireAdmin()
  if (response) return response

  const ip = getClientIp(request)
  if (isRateLimited(ip)) {
    return Response.json({ error: 'Too many requests' }, { status: 429 })
  }

  if (isUserRateLimited(`user-${user.userId}`)) {
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

  const { title, question = '', template_id } = parsed.data

  if (template_id && template_id !== 'blank') {
    const descriptor = TEMPLATES[template_id]
    const { board } = await instantiateTemplate(descriptor, {
      userId: user.userId,
      title,
      question,
    })
    return Response.json({ board }, { status: 201 })
  }

  const board = createBenchBoard(user.userId, title)
  return Response.json({ board }, { status: 201 })
}
