'use client'

import { useState, useCallback } from 'react'
import type { BenchClipping, BenchConnection, BenchClippingSourceRef } from '@/lib/db/types'

const DEFAULT_DIMENSIONS: Record<BenchClipping['clipping_type'], { width: number; height: number }> = {
  verse: { width: 300, height: 140 },
  entity: { width: 320, height: 200 },
  note: { width: 300, height: 180 },
  'translation-compare': { width: 580, height: 260 },
  'cross-ref-chain': { width: 320, height: 420 },
  lexicon: { width: 260, height: 160 },
  'study-section': { width: 500, height: 380 },
}

export interface AddClippingInput {
  clipping_type: BenchClipping['clipping_type']
  source_ref: BenchClippingSourceRef
  x: number
  y: number
}

export function useBenchBoard(
  boardId: string,
  initialClippings: BenchClipping[],
  initialConnections: BenchConnection[]
) {
  const [clippings, setClippings] = useState<BenchClipping[]>(initialClippings)
  const [connections, setConnections] = useState<BenchConnection[]>(initialConnections)

  const addClipping = useCallback(
    async (input: AddClippingInput) => {
      const { width, height } = DEFAULT_DIMENSIONS[input.clipping_type]
      const tempId = `temp-${Date.now()}`
      const optimistic: BenchClipping = {
        id: tempId,
        board_id: boardId,
        clipping_type: input.clipping_type,
        source_ref: JSON.stringify(input.source_ref),
        x: input.x,
        y: input.y,
        width,
        height,
        color: null,
        user_label: null,
        z_index: 0,
        created_at: new Date().toISOString(),
      }
      setClippings((prev) => [...prev, optimistic])

      try {
        const res = await fetch('/api/bench/clippings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            board_id: boardId,
            clipping_type: input.clipping_type,
            source_ref: input.source_ref,
            x: input.x,
            y: input.y,
            width,
            height,
          }),
        })
        if (!res.ok) throw new Error('server error')
        const { clipping } = (await res.json()) as { clipping: BenchClipping }
        setClippings((prev) => prev.map((c) => (c.id === tempId ? clipping : c)))
      } catch {
        setClippings((prev) => prev.filter((c) => c.id !== tempId))
      }
    },
    [boardId]
  )

  const moveClipping = useCallback(
    async (id: string, x: number, y: number) => {
      const prev = clippings
      setClippings((cs) => cs.map((c) => (c.id === id ? { ...c, x, y } : c)))
      try {
        const res = await fetch(`/api/bench/clippings/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ x, y }),
        })
        if (!res.ok) throw new Error('server error')
      } catch {
        setClippings(prev)
      }
    },
    [clippings]
  )

  const resizeClipping = useCallback(
    async (id: string, width: number, height: number) => {
      const prev = clippings
      setClippings((cs) => cs.map((c) => (c.id === id ? { ...c, width, height } : c)))
      try {
        const res = await fetch(`/api/bench/clippings/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ width, height }),
        })
        if (!res.ok) throw new Error('server error')
      } catch {
        setClippings(prev)
      }
    },
    [clippings]
  )

  const deleteClipping = useCallback(
    async (id: string) => {
      const prevClippings = clippings
      const prevConnections = connections
      setClippings((c) => c.filter((x) => x.id !== id))
      setConnections((c) =>
        c.filter((x) => x.from_clipping_id !== id && x.to_clipping_id !== id)
      )
      try {
        const res = await fetch(`/api/bench/clippings/${id}`, { method: 'DELETE' })
        if (!res.ok) throw new Error('server error')
      } catch {
        setClippings(prevClippings)
        setConnections(prevConnections)
      }
    },
    [clippings, connections]
  )

  const addConnection = useCallback(
    async (fromId: string, toId: string, label: string | null) => {
      try {
        const res = await fetch('/api/bench/connections', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            board_id: boardId,
            from_clipping_id: fromId,
            to_clipping_id: toId,
            label,
          }),
        })
        if (!res.ok) throw new Error('server error')
        const { connection } = (await res.json()) as { connection: BenchConnection }
        setConnections((prev) => [...prev, connection])
      } catch {
        // no optimistic add for connections — avoids ghost arrows with temp IDs
      }
    },
    [boardId]
  )

  const deleteConnection = useCallback(
    async (id: string) => {
      const prev = connections
      setConnections((c) => c.filter((x) => x.id !== id))
      try {
        const res = await fetch(`/api/bench/connections/${id}`, { method: 'DELETE' })
        if (!res.ok) throw new Error('server error')
      } catch {
        setConnections(prev)
      }
    },
    [connections]
  )

  const updateSourceRef = useCallback(
    async (id: string, newSourceRef: string) => {
      const prev = clippings
      setClippings((cs) =>
        cs.map((c) => (c.id === id ? { ...c, source_ref: newSourceRef } : c))
      )
      try {
        const res = await fetch(`/api/bench/clippings/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source_ref: newSourceRef }),
        })
        if (!res.ok) throw new Error('server error')
      } catch {
        setClippings(prev)
      }
    },
    [clippings]
  )

  return {
    clippings,
    connections,
    addClipping,
    moveClipping,
    resizeClipping,
    deleteClipping,
    updateSourceRef,
    addConnection,
    deleteConnection,
  }
}
