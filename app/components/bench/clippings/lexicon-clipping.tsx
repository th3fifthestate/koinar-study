'use client'

import { useState, useEffect } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import type { BenchClippingSourceRef, LexiconEntry } from '@/lib/db/types'

type LexiconRef = Extract<BenchClippingSourceRef, { type: 'lexicon' }>

interface LexiconClippingProps {
  sourceRef: LexiconRef | Record<string, unknown>
}

const COLLAPSE_LINE_THRESHOLD = 3

export function LexiconClipping({ sourceRef }: LexiconClippingProps) {
  const ref = sourceRef as LexiconRef
  const { strongs_id } = ref

  const [entry, setEntry] = useState<LexiconEntry | null>(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (!strongs_id) {
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    fetch(`/api/bench/lexicon/${encodeURIComponent(strongs_id)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { entry?: LexiconEntry } | null) => {
        if (!cancelled) setEntry(data?.entry ?? null)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [strongs_id])

  if (loading) {
    return (
      <div className="p-3 flex flex-col gap-2">
        {[40, 24, 80, 60].map((w, i) => (
          <div
            key={i}
            className="h-4 animate-pulse bg-muted rounded"
            style={{ width: `${w}%` }}
          />
        ))}
      </div>
    )
  }

  if (!entry) {
    return (
      <p className="p-3 text-[13px] text-muted-foreground italic">
        Entry not found for {strongs_id}.
      </p>
    )
  }

  const definition = entry.definition ?? ''
  const defLines = definition.split('\n').filter(Boolean)
  const isLong = defLines.length > COLLAPSE_LINE_THRESHOLD
  const displayDef =
    !isLong || expanded ? definition : defLines.slice(0, COLLAPSE_LINE_THRESHOLD).join('\n') + '…'

  return (
    <div className="p-3 flex flex-col gap-2 overflow-auto h-full">
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="text-base font-serif text-foreground">{entry.lemma}</span>
        <span className="text-[13px] text-muted-foreground italic">{entry.transliteration}</span>
        <span className="text-[10px] font-mono text-muted-foreground/60 ml-auto">{strongs_id}</span>
      </div>

      <p className="text-[13px] font-medium text-foreground/80">{entry.gloss}</p>

      <div className="text-[12px] text-muted-foreground leading-relaxed">
        <p className="whitespace-pre-line">{displayDef}</p>
        {isLong && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1 mt-1 text-sage-600 hover:text-sage-700 text-[12px]"
          >
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {expanded ? 'Show less' : 'Show more'}
          </button>
        )}
      </div>

      {entry.morphology && (
        <p className="text-[10px] text-muted-foreground/60 font-mono">{entry.morphology}</p>
      )}
      {/* "Occurs in N verses" — deferred v2: no stored strongs_id → entity_verse_refs join */}
    </div>
  )
}
