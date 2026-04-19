// app/components/bench/templates/instantiate-template.ts
import { getDb } from '@/lib/db/connection'
import {
  createBenchBoardWithQuestion,
  createBenchClippingRaw,
  createBenchConnectionRaw,
} from '@/lib/db/bench/queries'
import type { TemplateDescriptor } from './types'

export async function instantiateTemplate(
  descriptor: TemplateDescriptor,
  opts: { userId: number; title: string; question: string }
): Promise<{ boardId: string }> {
  const db = getDb()

  // Map placeholder_id → inserted clipping id
  const idMap = new Map<string, string>()

  const board = createBenchBoardWithQuestion(opts.userId, opts.title, opts.question)

  db.transaction(() => {
    for (const tc of descriptor.clippings) {
      const clippingId = crypto.randomUUID()
      idMap.set(tc.placeholder_id, clippingId)

      const sourceRef = JSON.stringify({ placeholder: true, body: tc.placeholder_body ?? '' })

      createBenchClippingRaw({
        id: clippingId,
        board_id: board.id,
        clipping_type: tc.clipping_type,
        source_ref: sourceRef,
        x: tc.x,
        y: tc.y,
        width: tc.width,
        height: tc.height,
      })
    }

    for (const conn of descriptor.connections) {
      const fromId = idMap.get(conn.from_placeholder_id)
      const toId = idMap.get(conn.to_placeholder_id)
      if (!fromId || !toId) continue
      createBenchConnectionRaw(crypto.randomUUID(), board.id, fromId, toId, conn.label ?? null)
      if (conn.bidirectional) {
        createBenchConnectionRaw(crypto.randomUUID(), board.id, toId, fromId, conn.label ?? null)
      }
    }
  })()

  return { boardId: board.id }
}
