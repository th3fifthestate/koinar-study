'use client'

import { useState, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'
import type { BenchClippingSourceRef } from '@/lib/db/types'
import { useBenchBoardContext } from '../bench-board-context'
import { guardDrop } from '@/lib/bench/guard-drop'
import type { LicenseCapModalProps as GuardCapModalProps } from '@/lib/bench/guard-drop'
import { LicenseCapModal } from '../license-cap-modal'

type TranslationCompareRef = Extract<BenchClippingSourceRef, { type: 'translation-compare' }>

interface TranslationResult {
  id: string
  text: string | null
}

interface TranslationCompareClippingProps {
  sourceRef: TranslationCompareRef | Record<string, unknown>
  onUpdateSourceRef?: (next: TranslationCompareRef) => void
  boardId: string
}

const ALL_TRANSLATIONS = ['bsb', 'kjv', 'web', 'nlt', 'niv', 'nasb', 'esv']

export function TranslationCompareClipping({
  sourceRef,
  onUpdateSourceRef,
  boardId,
}: TranslationCompareClippingProps) {
  const ref = sourceRef as TranslationCompareRef
  const { book, chapter, verse } = ref

  const [translations, setTranslations] = useState<string[]>(ref.translations ?? ['bsb', 'niv'])
  const [results, setResults] = useState<TranslationResult[]>([])
  const [loading, setLoading] = useState(true)
  const [showMenu, setShowMenu] = useState(false)
  const [capModal, setCapModal] = useState<GuardCapModalProps | null>(null)

  const { clippings } = useBenchBoardContext()

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const translationKey = translations.join(',')

  useEffect(() => {
    if (!book || !chapter || !verse) {
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    fetch(
      `/api/bench/translations?book=${encodeURIComponent(book)}&chapter=${chapter}&verse=${verse}&translations=${translationKey}&boardId=${encodeURIComponent(boardId)}`
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { translations?: TranslationResult[] } | null) => {
        if (!cancelled) setResults(data?.translations ?? [])
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [book, chapter, verse, translationKey, boardId])

  const toggleTranslation = (t: string) => {
    const isAdding = !translations.includes(t)
    const next = isAdding
      ? [...translations, t].slice(0, 4)
      : translations.filter((x) => x !== t)
    if (next.length < 2) return

    // Guard cap only when adding a licensed translation
    if (isAdding) {
      const guard = guardDrop(
        { clippingType: 'translation-compare', translations: [t] },
        { id: boardId, clippings }
      )
      if (!guard.ok) {
        setCapModal(guard.modalProps)
        return
      }
    }

    setTranslations(next)
    onUpdateSourceRef?.({ ...ref, translations: next })
  }

  const refLabel = book && chapter && verse ? `${book} ${chapter}:${verse}` : ''

  return (
    <div className="flex flex-col gap-2 p-3 h-full overflow-auto">
      <div className="flex items-center justify-between flex-shrink-0">
        <span className="text-[11px] text-muted-foreground">{refLabel}</span>
        <button
          onClick={() => setShowMenu((v) => !v)}
          className="flex items-center gap-1 text-[11px] font-semibold text-sage-600 tracking-wide uppercase hover:text-sage-700"
          aria-label="Edit translations"
        >
          {translations.join(', ').toUpperCase()}
          <ChevronDown size={11} />
        </button>
      </div>

      {showMenu && (
        <div className="flex flex-wrap gap-1 pb-2 border-b border-border">
          {ALL_TRANSLATIONS.map((t) => (
            <button
              key={t}
              onClick={() => toggleTranslation(t)}
              className={`px-2 py-0.5 rounded text-[10px] font-medium border transition-colors ${
                translations.includes(t)
                  ? 'bg-sage-100 border-sage-400 text-sage-700'
                  : 'border-border text-muted-foreground hover:border-foreground/40'
              }`}
            >
              {t.toUpperCase()}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex flex-col gap-3">
          {translations.map((t) => (
            <div key={t} className="h-12 animate-pulse bg-muted rounded" />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {results.map(({ id, text }) => (
            <div key={id}>
              <span className="block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-0.5">
                {id}
              </span>
              {text ? (
                <p className="text-[13px] leading-relaxed text-foreground italic">{text}</p>
              ) : (
                <p className="text-[12px] text-muted-foreground italic">Not available</p>
              )}
            </div>
          ))}
        </div>
      )}

      {capModal && (
        <LicenseCapModal
          {...capModal}
          onClose={() => setCapModal(null)}
        />
      )}
    </div>
  )
}
