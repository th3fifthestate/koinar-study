'use client'

import { useState, useEffect } from 'react'
import { ExternalLink } from 'lucide-react'
import type { BenchClippingSourceRef, CrossRef } from '@/lib/db/types'

type CrossRefChainRef = Extract<BenchClippingSourceRef, { type: 'cross-ref-chain' }>

interface CrossRefChainClippingProps {
  sourceRef: CrossRefChainRef | Record<string, unknown>
}

function refLabel(ref: CrossRef): string {
  const range =
    ref.to_verse_end && ref.to_verse_end !== ref.to_verse_start
      ? `${ref.to_verse_start}–${ref.to_verse_end}`
      : String(ref.to_verse_start)
  return `${ref.to_book} ${ref.to_chapter}:${range}`
}

export function CrossRefChainClipping({ sourceRef }: CrossRefChainClippingProps) {
  const ref = sourceRef as CrossRefChainRef
  const { from_book, from_chapter, from_verse } = ref

  const [refs, setRefs] = useState<CrossRef[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!from_book || !from_chapter || !from_verse) {
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    fetch(
      `/api/bench/cross-refs?book=${encodeURIComponent(from_book)}&chapter=${from_chapter}&verse=${from_verse}`
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { refs?: CrossRef[] } | null) => {
        if (!cancelled) setRefs(data?.refs ?? [])
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [from_book, from_chapter, from_verse])

  const openVerse = (crossRef: CrossRef) => {
    const label = refLabel(crossRef)
    // Navigate to the study reader searching for this reference
    window.open(`/reader?ref=${encodeURIComponent(label)}`, '_blank')
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-3 pt-2 pb-1.5 text-[11px] text-muted-foreground font-medium border-b border-border flex-shrink-0">
        {from_book} {from_chapter}:{from_verse} —{' '}
        {loading ? '…' : `${refs.length} cross-ref${refs.length === 1 ? '' : 's'}`}
      </div>
      <div className="flex-1 overflow-auto divide-y divide-border">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="mx-3 my-2 h-7 animate-pulse bg-muted rounded" />
          ))
        ) : refs.length === 0 ? (
          <p className="px-3 py-4 text-[13px] text-muted-foreground italic">
            No cross-references found.
          </p>
        ) : (
          refs.map((crossRef, i) => (
            <button
              key={i}
              onClick={() => openVerse(crossRef)}
              className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted/50 text-left group"
            >
              <span className="text-[13px] text-foreground">{refLabel(crossRef)}</span>
              <ExternalLink
                size={11}
                className="text-muted-foreground/40 group-hover:text-muted-foreground shrink-0"
              />
            </button>
          ))
        )}
      </div>
    </div>
  )
}
