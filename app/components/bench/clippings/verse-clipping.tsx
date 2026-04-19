'use client'

import { useState, useEffect } from 'react'
import type { BenchClippingSourceRef } from '@/lib/db/types'

type VerseRef = Extract<BenchClippingSourceRef, { type: 'verse' }>

interface VerseClippingProps {
  sourceRef: VerseRef | Record<string, unknown>
  boardId: string
}

export function VerseClipping({ sourceRef, boardId }: VerseClippingProps) {
  const ref = sourceRef as VerseRef
  const { book, chapter, verse, translation } = ref
  const [text, setText] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!book || !chapter || !verse || !translation || !boardId) {
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    fetch(
      `/api/bench/verse?translation=${encodeURIComponent(translation)}&book=${encodeURIComponent(book)}&chapter=${chapter}&verse=${verse}&boardId=${encodeURIComponent(boardId)}`
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { text?: string } | null) => {
        if (!cancelled && data?.text) setText(data.text)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [book, chapter, verse, translation, boardId])

  const label = book && chapter && verse ? `${book} ${chapter}:${verse}` : 'Verse'
  const translationLabel = translation?.toUpperCase() ?? ''

  return (
    <div className="flex flex-col h-full gap-1.5">
      <div className="flex items-center justify-between flex-shrink-0">
        <span className="text-[11px] font-semibold text-sage-600 tracking-wide uppercase">
          {translationLabel}
        </span>
        <span className="text-[11px] text-muted-foreground">{label}</span>
      </div>
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-4 h-4 rounded-full border-2 border-sage-300 border-t-transparent animate-spin" />
        </div>
      ) : text ? (
        <p className="text-[13px] leading-relaxed text-foreground line-clamp-6 italic">{text}</p>
      ) : (
        <p className="text-[12px] text-muted-foreground italic">Verse text unavailable</p>
      )}
    </div>
  )
}
