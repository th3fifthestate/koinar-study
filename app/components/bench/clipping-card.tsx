'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import { useReducedMotion } from 'framer-motion'
import type { BenchClipping } from '@/lib/db/types'
import { useBenchCanvas } from './canvas-camera'
import { useBenchBoardContext } from './bench-board-context'

// Clipping content components are imported lazily to avoid circular deps
import { VerseClipping } from './clippings/verse-clipping'
import { EntityClipping } from './clippings/entity-clipping'
import { NoteClipping } from './clippings/note-clipping'
import { TranslationCompareClipping } from './clippings/translation-compare-clipping'
import { CrossRefChainClipping } from './clippings/cross-ref-chain-clipping'
import { LexiconClipping } from './clippings/lexicon-clipping'
import dynamic from 'next/dynamic'

const StudySectionClipping = dynamic(
  () => import('./clippings/study-section-clipping').then(m => ({ default: m.StudySectionClipping })),
  { loading: () => <div className="w-full h-24 animate-pulse rounded bg-muted" aria-label="Loading…" /> }
)
import { PlaceholderCard } from './clippings/placeholder-card'
import type { BenchClippingSourceRef } from '@/lib/db/types'

type TranslationCompareRef = Extract<BenchClippingSourceRef, { type: 'translation-compare' }>

// These types manage their own internal padding and fill the card edge-to-edge
const FULL_BLEED_TYPES = new Set(['translation-compare', 'cross-ref-chain', 'lexicon', 'study-section'])

interface ClippingCardProps {
  clipping: BenchClipping
  boardId: string
  onMove: (id: string, x: number, y: number) => void
  onResize: (id: string, w: number, h: number) => void
  onDelete: (id: string) => void
  onAddConnection: (fromId: string, toId: string, label: string | null) => void
  onUpdateSourceRef?: (clippingId: string, newSourceRef: string) => void
}

export function ClippingCard({
  clipping,
  boardId,
  onMove,
  onDelete,
  onAddConnection,
  onUpdateSourceRef,
}: ClippingCardProps) {
  const { camera } = useBenchCanvas()
  const { isReadOnly } = useBenchBoardContext()
  const cardRef = useRef<HTMLDivElement>(null)
  const dragStart = useRef<{ mx: number; my: number; cx: number; cy: number } | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const connectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [pendingConnection, setPendingConnection] = useState(false)
  const [connLabel, setConnLabel] = useState('')
  const [connTarget, setConnTarget] = useState<string | null>(null)
  const prefersReduced = useReducedMotion()

  // Drag to move
  const onCardPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (isReadOnly) return
      // Only primary button; ignore edge zones
      if (e.button !== 0) return
      if ((e.target as HTMLElement).closest('[data-edge-zone]')) return
      if ((e.target as HTMLElement).closest('button, input, textarea, [role="button"]')) return
      e.stopPropagation()
      cardRef.current?.setPointerCapture(e.pointerId)
      dragStart.current = { mx: e.clientX, my: e.clientY, cx: clipping.x, cy: clipping.y }
    },
    [isReadOnly, clipping.x, clipping.y]
  )

  const onCardPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragStart.current) return
      const dx = (e.clientX - dragStart.current.mx) / camera.zoom
      const dy = (e.clientY - dragStart.current.my) / camera.zoom
      if (!isDragging && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) setIsDragging(true)
      if (isDragging) {
        onMove(clipping.id, dragStart.current.cx + dx, dragStart.current.cy + dy)
      }
    },
    [isDragging, camera.zoom, clipping.id, onMove]
  )

  const onCardPointerUp = useCallback(() => {
    dragStart.current = null
    setIsDragging(false)
  }, [])

  // Long-press on edge zone to start connection
  const onEdgePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (isReadOnly) return
      e.stopPropagation()
      connectTimer.current = setTimeout(() => {
        setPendingConnection(true)
        connectTimer.current = null
      }, 300)
    },
    [isReadOnly]
  )

  const onEdgePointerUp = useCallback(() => {
    if (connectTimer.current) {
      clearTimeout(connectTimer.current)
      connectTimer.current = null
    }
  }, [])

  // Handle drop onto this card when another card is in connection mode
  const onCardPointerEnter = useCallback(() => {
    // Visual feedback when a connection drag is active — handled by CSS/state in canvas
  }, [])

  // ESC cancels pending connection
  useEffect(() => {
    if (!pendingConnection) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPendingConnection(false)
        setConnTarget(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pendingConnection])

  const confirmConnection = useCallback(() => {
    if (connTarget) {
      onAddConnection(clipping.id, connTarget, connLabel || null)
    }
    setPendingConnection(false)
    setConnTarget(null)
    setConnLabel('')
  }, [connTarget, connLabel, clipping.id, onAddConnection])

  const shadow = isDragging
    ? '0 8px 24px rgba(44, 41, 36, 0.14)'
    : '0 1px 2px rgba(44, 41, 36, 0.06), 0 0 0 1px rgba(44, 41, 36, 0.04)'

  const sourceRef = (() => {
    try {
      return JSON.parse(clipping.source_ref)
    } catch {
      return {}
    }
  })()

  return (
    <div
      ref={cardRef}
      role="article"
      tabIndex={0}
      aria-label={`${clipping.clipping_type} clipping`}
      className="group absolute outline-none focus-visible:ring-2 focus-visible:ring-sage-400"
      style={{
        left: clipping.x,
        top: clipping.y,
        width: clipping.width,
        height: clipping.height,
        borderRadius: 10,
        background: 'var(--ivory-paper, #fdfaf3)',
        boxShadow: shadow,
        cursor: isDragging ? 'grabbing' : 'grab',
        userSelect: 'none',
        zIndex: clipping.z_index,
        willChange: isDragging ? 'transform' : undefined,
        transition:
          prefersReduced || isDragging ? undefined : 'box-shadow 150ms ease',
      }}
      onPointerDown={onCardPointerDown}
      onPointerMove={onCardPointerMove}
      onPointerUp={onCardPointerUp}
      onPointerEnter={onCardPointerEnter}
      onKeyDown={(e) => {
        if (isReadOnly) return
        const step = e.shiftKey ? 256 : 64
        if (e.key === 'Delete' || e.key === 'Backspace') {
          e.preventDefault()
          onDelete(clipping.id)
        }
        if (e.key === 'ArrowLeft') { e.preventDefault(); onMove(clipping.id, clipping.x - step, clipping.y) }
        if (e.key === 'ArrowRight') { e.preventDefault(); onMove(clipping.id, clipping.x + step, clipping.y) }
        if (e.key === 'ArrowUp') { e.preventDefault(); onMove(clipping.id, clipping.x, clipping.y - step) }
        if (e.key === 'ArrowDown') { e.preventDefault(); onMove(clipping.id, clipping.x, clipping.y + step) }
      }}
    >
      {/* Edge zones for drag-to-connect */}
      {(['top', 'right', 'bottom', 'left'] as const).map((side) => (
        <div
          key={side}
          data-edge-zone={side}
          className="absolute opacity-0 hover:opacity-100 hover:bg-sage-200/40 z-10 transition-opacity"
          style={{
            ...(side === 'top' && { top: 0, left: 8, right: 8, height: 8, cursor: 'crosshair' }),
            ...(side === 'bottom' && { bottom: 0, left: 8, right: 8, height: 8, cursor: 'crosshair' }),
            ...(side === 'left' && { left: 0, top: 8, bottom: 8, width: 8, cursor: 'crosshair' }),
            ...(side === 'right' && { right: 0, top: 8, bottom: 8, width: 8, cursor: 'crosshair' }),
          }}
          onPointerDown={onEdgePointerDown}
          onPointerUp={onEdgePointerUp}
          title="Long-press to draw a connection"
          aria-label={`Connect from ${side} edge`}
        />
      ))}

      {/* Card content — full-bleed types manage their own padding */}
      <div
        className={`h-full overflow-hidden rounded-[10px] ${
          FULL_BLEED_TYPES.has(clipping.clipping_type) ? '' : 'p-3'
        }`}
      >
        {'placeholder' in sourceRef && sourceRef.placeholder ? (
          <PlaceholderCard
            body={(sourceRef as { body: string }).body}
            type={clipping.clipping_type}
          />
        ) : (
          <>
            {clipping.clipping_type === 'verse' && <VerseClipping sourceRef={sourceRef} boardId={boardId} />}
            {clipping.clipping_type === 'entity' && <EntityClipping sourceRef={sourceRef} />}
            {clipping.clipping_type === 'note' && (
              <NoteClipping clippingId={clipping.id} sourceRef={sourceRef} />
            )}
            {clipping.clipping_type === 'translation-compare' && (
              <TranslationCompareClipping
                sourceRef={sourceRef}
                boardId={boardId}
                onUpdateSourceRef={(next: TranslationCompareRef) =>
                  onUpdateSourceRef?.(clipping.id, JSON.stringify(next))
                }
              />
            )}
            {clipping.clipping_type === 'cross-ref-chain' && (
              <CrossRefChainClipping sourceRef={sourceRef} />
            )}
            {clipping.clipping_type === 'lexicon' && <LexiconClipping sourceRef={sourceRef} />}
            {clipping.clipping_type === 'study-section' && (
              <StudySectionClipping sourceRef={sourceRef} />
            )}
          </>
        )}
      </div>

      {/* Delete button (visible on group-hover / focus) */}
      {!isReadOnly && (
        <button
          className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-red-100 text-red-600 text-xs
                     opacity-0 group-hover:opacity-100 focus:opacity-100
                     flex items-center justify-center leading-none z-20
                     transition-opacity"
          onClick={(e) => {
            e.stopPropagation()
            onDelete(clipping.id)
          }}
          aria-label="Delete clipping"
          tabIndex={-1}
        >
          ×
        </button>
      )}

      {/* Connection label popover (shown when pendingConnection and connTarget selected) */}
      {pendingConnection && connTarget && (
        <div
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50
                     bg-popover border border-border rounded-lg shadow-lg p-3 flex gap-2"
          role="dialog"
          aria-label="Add connection label"
        >
          <input
            className="text-[12px] px-2 py-1 border border-border rounded bg-background min-w-[140px]"
            placeholder="Label (optional)"
            value={connLabel}
            onChange={(e) => setConnLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') confirmConnection()
              if (e.key === 'Escape') {
                setPendingConnection(false)
                setConnTarget(null)
              }
            }}
            maxLength={60}
            autoFocus
          />
          <button
            className="text-[12px] px-2 py-1 rounded bg-sage-600 text-white"
            onClick={confirmConnection}
          >
            Connect
          </button>
        </div>
      )}
    </div>
  )
}
