'use client'

import { useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import type { BenchClippingSourceRef } from '@/lib/db/types'

interface VerseRow {
  source_ref: string
  created_at: string
}

interface EntityRow {
  id: string
  canonical_name: string
  entity_type: string
}

interface SourceDrawerProps {
  verseSeeds: VerseRow[]
  boardId: string
}

type Tab = 'verses' | 'entities'

export function SourceDrawer({ verseSeeds }: SourceDrawerProps) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<Tab>('verses')
  const [entityQuery, setEntityQuery] = useState('')
  const [entities, setEntities] = useState<EntityRow[]>([])
  const [searching, setSearching] = useState(false)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prefersReduced = useReducedMotion()

  const searchEntities = useCallback(async (q: string) => {
    setEntityQuery(q)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    if (q.length < 2) {
      setEntities([])
      return
    }
    searchTimer.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(
          `/api/entities/search?q=${encodeURIComponent(q)}&limit=20`
        )
        if (res.ok) {
          const data = (await res.json()) as { entities?: EntityRow[] }
          setEntities(data.entities ?? [])
        }
      } catch {
        // non-fatal
      } finally {
        setSearching(false)
      }
    }, 250)
  }, [])

  const drawerVariants = {
    open: { width: 320 },
    closed: { width: 48 },
  }

  return (
    <motion.aside
      className="relative flex-shrink-0 h-full bg-background border-r border-border overflow-hidden flex flex-col"
      variants={drawerVariants}
      animate={open ? 'open' : 'closed'}
      transition={prefersReduced ? { duration: 0 } : { duration: 0.2, ease: 'easeInOut' }}
      aria-label="Source drawer"
    >
      {/* Toggle */}
      <button
        className="absolute top-3 right-0 z-20 w-10 h-8 flex items-center justify-center
                   text-muted-foreground hover:text-foreground transition-colors"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Collapse source drawer' : 'Expand source drawer'}
        aria-expanded={open}
      >
        <span className="text-base leading-none">{open ? '‹' : '›'}</span>
      </button>

      {/* Collapsed label */}
      {!open && (
        <div className="flex-1 flex items-center justify-center pointer-events-none select-none">
          <span
            className="text-[10px] text-muted-foreground tracking-widest uppercase"
            style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
          >
            Sources
          </span>
        </div>
      )}

      <AnimatePresence>
        {open && (
          <motion.div
            className="absolute inset-0 flex flex-col pt-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={prefersReduced ? { duration: 0 } : { duration: 0.15 }}
          >
            {/* Header */}
            <div className="flex items-center px-3 pt-3 pb-0 flex-shrink-0">
              <span className="text-[12px] font-semibold text-foreground">Sources</span>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-border px-2 mt-2 flex-shrink-0">
              {(['verses', 'entities'] as Tab[]).map((t) => (
                <button
                  key={t}
                  className={`flex-1 py-2 text-[12px] capitalize font-medium transition-colors
                    ${tab === t
                      ? 'text-sage-700 border-b-2 border-sage-600'
                      : 'text-muted-foreground hover:text-foreground'
                    }`}
                  onClick={() => setTab(t)}
                  aria-selected={tab === t}
                  role="tab"
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
              {tab === 'verses' && (
                <>
                  {verseSeeds.length === 0 && (
                    <p className="text-[11px] text-muted-foreground text-center py-4 px-2">
                      Verse references you use on boards will appear here.
                    </p>
                  )}
                  {verseSeeds.map((row, i) => {
                    let ref: Extract<BenchClippingSourceRef, { type: 'verse' }> | null = null
                    try {
                      const parsed = JSON.parse(row.source_ref)
                      if (parsed?.type === 'verse') ref = parsed
                    } catch {
                      return null
                    }
                    if (!ref) return null
                    const label = `${ref.book} ${ref.chapter}:${ref.verse}`
                    const sublabel = ref.translation.toUpperCase()
                    return (
                      <DraggableChip
                        key={i}
                        label={label}
                        sublabel={sublabel}
                        clipping_type="verse"
                        source_ref={ref}
                      />
                    )
                  })}
                </>
              )}

              {tab === 'entities' && (
                <>
                  <input
                    type="search"
                    className="w-full px-3 py-1.5 rounded-md border border-border text-[12px]
                               bg-background outline-none focus:ring-1 focus:ring-sage-400"
                    placeholder="Search entities…"
                    value={entityQuery}
                    onChange={(e) => searchEntities(e.target.value)}
                    aria-label="Search entities"
                  />
                  {searching && (
                    <div className="flex justify-center py-2">
                      <div className="w-4 h-4 rounded-full border-2 border-sage-300 border-t-transparent animate-spin" />
                    </div>
                  )}
                  {entities.map((e) => (
                    <DraggableChip
                      key={e.id}
                      label={e.canonical_name}
                      sublabel={e.entity_type}
                      clipping_type="entity"
                      source_ref={{ type: 'entity', entity_id: e.id }}
                    />
                  ))}
                  {entityQuery.length >= 2 && !searching && entities.length === 0 && (
                    <p className="text-[11px] text-muted-foreground text-center py-4">
                      No entities found
                    </p>
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.aside>
  )
}

interface DraggableChipProps {
  label: string
  sublabel: string
  clipping_type: 'verse' | 'entity'
  source_ref: BenchClippingSourceRef
}

function DraggableChip({ label, sublabel, clipping_type, source_ref }: DraggableChipProps) {
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(
          'application/bench-clip',
          JSON.stringify({ clipping_type, source_ref })
        )
        e.dataTransfer.effectAllowed = 'copy'
      }}
      className="flex flex-col px-3 py-2 rounded-md border border-border bg-card
                 cursor-grab hover:bg-muted active:cursor-grabbing transition-colors"
      role="listitem"
      aria-label={`Drag to add ${label}`}
    >
      <span className="text-[12px] font-medium text-foreground truncate">{label}</span>
      <span className="text-[10px] text-muted-foreground capitalize">{sublabel}</span>
    </div>
  )
}
