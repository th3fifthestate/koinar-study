import { requireAuth } from '@/lib/auth/middleware'
import { createRateLimiter, getClientIp } from '@/lib/rate-limit'
import { z } from 'zod'
import { getBenchBoard, getBenchClippings, createBenchClipping } from '@/lib/db/bench/queries'
import { generateClippingId } from '@/lib/bench/clipping-id'
import { guardDrop } from '@/lib/bench/guard-drop'

const isRateLimited = createRateLimiter({ windowMs: 60_000, max: 120 })

// Placeholder source_refs are server-side-only (materialized via instantiateTemplate) and
// intentionally excluded from this public-API discriminated union.
const sourceRefSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('verse'),
    book: z.string().min(1),
    chapter: z.number().int().positive(),
    verse: z.number().int().positive(),
    translation: z.string().min(1),
  }),
  z.object({
    type: z.literal('entity'),
    entity_id: z.string().min(1),
  }),
  z.object({
    type: z.literal('note'),
    content: z.string().max(10000).optional().default(''),
  }),
  z.object({
    type: z.literal('translation-compare'),
    book: z.string().min(1),
    chapter: z.number().int().positive(),
    verse: z.number().int().positive(),
    translations: z.array(z.string().min(1)).min(2).max(4),
  }),
  z.object({
    type: z.literal('cross-ref-chain'),
    from_book: z.string().min(1),
    from_chapter: z.number().int().positive(),
    from_verse: z.number().int().positive(),
  }),
  z.object({
    type: z.literal('lexicon'),
    strongs_id: z.string().min(1),
  }),
  z.object({
    type: z.literal('study-section'),
    study_id: z.number().int().positive(),
    section_heading: z.string().min(1).max(200),
  }),
])

const createSchema = z.object({
  board_id: z.string().min(1),
  clipping_type: z.enum([
    'verse',
    'entity',
    'note',
    'translation-compare',
    'cross-ref-chain',
    'lexicon',
    'study-section',
  ]),
  source_ref: sourceRefSchema,
  x: z.number(),
  y: z.number(),
  width: z.number().positive(),
  height: z.number().positive(),
  color: z.string().nullable().optional(),
  user_label: z.string().max(80).nullable().optional(),
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

  const { board_id, clipping_type, source_ref, x, y, width, height, color, user_label } =
    parsed.data

  if (source_ref.type !== clipping_type) {
    return Response.json(
      { error: 'clipping_type must match source_ref.type' },
      { status: 400 }
    )
  }

  if (!getBenchBoard(board_id, user.userId)) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  // Server-side license-cap enforcement (client guardDrop is UNTRUSTED per CLAUDE.md §1).
  if (source_ref.type === 'verse' || source_ref.type === 'translation-compare') {
    const existing = getBenchClippings(board_id)
    const intended =
      source_ref.type === 'verse'
        ? { clippingType: 'verse' as const, translation: source_ref.translation }
        : { clippingType: 'translation-compare' as const, translations: source_ref.translations }
    const guard = guardDrop(intended, { id: board_id, clippings: existing })
    if (!guard.ok) {
      return Response.json(
        {
          error: 'License cap reached',
          reason: guard.reason,
          translation: guard.modalProps.translation,
          count: guard.modalProps.count,
          cap: guard.modalProps.cap,
        },
        { status: 409 }
      )
    }
  }

  const clipping = createBenchClipping({
    id: generateClippingId(),
    board_id,
    clipping_type,
    source_ref: JSON.stringify(source_ref),
    x,
    y,
    width,
    height,
    color: color ?? null,
    user_label: user_label ?? null,
    z_index: 0,
  })

  return Response.json({ clipping }, { status: 201 })
}
