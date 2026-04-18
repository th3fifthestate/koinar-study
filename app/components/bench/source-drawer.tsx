'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import type { BenchClippingSourceRef, LexiconEntry } from '@/lib/db/types'

interface VerseRow {
  source_ref: string
  created_at: string
}

interface EntityRow {
  id: string
  canonical_name: string
  entity_type: string
}

interface NoteRow {
  id: string
  note_text: string | null
  selected_text: string | null
}

interface StudyRow {
  id: number
  title: string
  summary: string | null
}

interface CrossRef {
  to_book: string
  to_chapter: number
  to_verse_start: number
  to_verse_end: number | null
  votes: number | null
}

interface SourceDrawerProps {
  verseSeeds: VerseRow[]
  boardId: string
}

type Tab = 'verses' | 'entities' | 'lexicon' | 'cross-refs' | 'notes' | 'studies'
const TABS: Tab[] = ['verses', 'entities', 'lexicon', 'cross-refs', 'notes', 'studies']

export function SourceDrawer({ verseSeeds }: SourceDrawerProps) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<Tab>('verses')
  const prefersReduced = useReducedMotion()

  // Entities tab
  const [entityQuery, setEntityQuery] = useState('')
  const [entities, setEntities] = useState<EntityRow[]>([])
  const [searchingEntities, setSearchingEntities] = useState(false)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const searchEntities = useCallback(async (q: string) => {
    setEntityQuery(q)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    if (q.length < 2) {
      setEntities([])
      return
    }
    searchTimer.current = setTimeout(async () => {
      setSearchingEntities(true)
      try {
        const res = await fetch(`/api/entities/search?q=${encodeURIComponent(q)}&limit=20`)
        if (res.ok) {
          const data = (await res.json()) as { entities?: EntityRow[] }
          setEntities(data.entities ?? [])
        }
      } catch {
        // non-fatal
      } finally {
        setSearchingEntities(false)
      }
    }, 250)
  }, [])

  // Lexicon tab
  const [lexiconQ, setLexiconQ] = useState('')
  const [lexiconResults, setLexiconResults] = useState<LexiconEntry[]>([])

  useEffect(() => {
    if (!lexiconQ.trim()) { setLexiconResults([]); return }
    const t = setTimeout(() => {
      fetch(`/api/bench/source/lexicon?q=${encodeURIComponent(lexiconQ)}`)
        .then((r) => r.json())
        .then((d: { entries?: LexiconEntry[] }) => setLexiconResults(d.entries ?? []))
        .catch(() => {})
    }, 200)
    return () => clearTimeout(t)
  }, [lexiconQ])

  // Cross-refs tab
  const [xrefInput, setXrefInput] = useState('')
  const [xrefResults, setXrefResults] = useState<CrossRef[]>([])

  useEffect(() => {
    const match = xrefInput.trim().match(/^(.+?)\s+(\d+):(\d+)$/)
    if (!match) { setXrefResults([]); return }
    const [, book, chap, ver] = match
    const t = setTimeout(() => {
      fetch(
        `/api/bench/source/cross-refs?book=${encodeURIComponent(book)}&chapter=${chap}&verse=${ver}`
      )
        .then((r) => r.json())
        .then((d: { refs?: CrossRef[] }) => setXrefResults(d.refs ?? []))
        .catch(() => {})
    }, 200)
    return () => clearTimeout(t)
  }, [xrefInput])

  // Notes tab
  const [notesQ, setNotesQ] = useState('')
  const [notesResults, setNotesResults] = useState<NoteRow[]>([])

  useEffect(() => {
    if (notesQ.trim().length < 2) { setNotesResults([]); return }
    const t = setTimeout(() => {
      fetch(`/api/bench/source/notes?q=${encodeURIComponent(notesQ)}`)
        .then((r) => r.json())
        .then((d: { notes?: NoteRow[] }) => setNotesResults(d.notes ?? []))
        .catch(() => {})
    }, 200)
    return () => clearTimeout(t)
  }, [notesQ])

  // Studies tab
  const [studiesQ, setStudiesQ] = useState('')
  const [studiesResults, setStudiesResults] = useState<StudyRow[]>([])

  useEffect(() => {
    if (studiesQ.trim().length < 2) { setStudiesResults([]); return }
    const t = setTimeout(() => {
      fetch(`/api/bench/source/studies?q=${encodeURIComponent(studiesQ)}`)
        .then((r) => r.json())
        .then((d: { studies?: StudyRow[] }) => setStudiesResults(d.studies ?? []))
        .catch(() => {})
    }, 200)
    return () => clearTimeout(t)
  }, [studiesQ])

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

            {/* Tabs — scrollable for 6 tabs */}
            <div className="flex border-b border-border mt-2 flex-shrink-0 overflow-x-auto scrollbar-none">
              {TABS.map((t) => (
                <button
                  key={t}
                  className={`px-3 py-2 text-[11px] font-medium shrink-0 capitalize border-b-2 transition-colors ${
                    tab === t
                      ? 'border-sage-500 text-sage-700'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
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
            <div className="flex-1 overflow-y-auto">

              {/* Verses */}
              {tab === 'verses' && (
                <div className="p-2 space-y-1.5">
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
                </div>
              )}

              {/* Entities */}
              {tab === 'entities' && (
                <div className="p-2 space-y-1.5">
                  <input
                    type="search"
                    className="w-full px-3 py-1.5 rounded-md border border-border text-[12px]
                               bg-background outline-none focus:ring-1 focus:ring-sage-400"
                    placeholder="Search entities…"
                    value={entityQuery}
                    onChange={(e) => searchEntities(e.target.value)}
                    aria-label="Search entities"
                  />
                  {searchingEntities && (
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
                  {entityQuery.length >= 2 && !searchingEntities && entities.length === 0 && (
                    <p className="text-[11px] text-muted-foreground text-center py-4">
                      No entities found
                    </p>
                  )}
                </div>
              )}

              {/* Lexicon */}
              {tab === 'lexicon' && (
                <div className="flex flex-col h-full">
                  <div className="px-2 py-2">
                    <input
                      value={lexiconQ}
                      onChange={(e) => setLexiconQ(e.target.value)}
                      placeholder="Search lemma, gloss…"
                      className="w-full text-[12px] border border-border rounded px-2 py-1.5 bg-background focus:outline-none focus:ring-1 focus:ring-sage-400"
                    />
                  </div>
                  <div className="divide-y divide-border">
                    {lexiconResults.map((entry) => (
                      <div
                        key={entry.strongs_id}
                        draggable
                        onDragStart={(e) =>
                          e.dataTransfer.setData(
                            'application/bench-clip',
                            JSON.stringify({
                              clipping_type: 'lexicon',
                              source_ref: { type: 'lexicon', strongs_id: entry.strongs_id },
                            })
                          )
                        }
                        className="px-3 py-2 hover:bg-muted cursor-grab active:cursor-grabbing"
                      >
                        <div className="flex items-baseline gap-2">
                          <span className="font-serif text-[14px] text-foreground">{entry.lemma}</span>
                          <span className="text-[11px] text-muted-foreground italic">{entry.transliteration}</span>
                          <span className="text-[10px] font-mono text-muted-foreground/60 ml-auto">{entry.strongs_id}</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{entry.gloss}</p>
                      </div>
                    ))}
                    {lexiconQ.trim() && lexiconResults.length === 0 && (
                      <p className="px-3 py-4 text-[11px] text-muted-foreground italic">No results.</p>
                    )}
                  </div>
                </div>
              )}

              {/* Cross-refs */}
              {tab === 'cross-refs' && (
                <div className="flex flex-col h-full">
                  <div className="px-2 py-2">
                    <input
                      value={xrefInput}
                      onChange={(e) => setXrefInput(e.target.value)}
                      placeholder="John 3:16"
                      className="w-full text-[12px] border border-border rounded px-2 py-1.5 bg-background focus:outline-none focus:ring-1 focus:ring-sage-400"
                    />
                  </div>
                  {xrefResults.length > 0 && (() => {
                    const match = xrefInput.trim().match(/^(.+?)\s+(\d+):(\d+)$/)
                    if (!match) return null
                    const [, book, chap, ver] = match
                    const dragPayload = JSON.stringify({
                      clipping_type: 'cross-ref-chain',
                      source_ref: {
                        type: 'cross-ref-chain',
                        from_book: book,
                        from_chapter: parseInt(chap),
                        from_verse: parseInt(ver),
                      },
                    })
                    return (
                      <div
                        draggable
                        onDragStart={(e) =>
                          e.dataTransfer.setData('application/bench-clip', dragPayload)
                        }
                        className="mx-2 mb-2 px-3 py-2 border border-border rounded-md bg-card hover:bg-muted cursor-grab active:cursor-grabbing"
                      >
                        <p className="text-[12px] font-medium text-foreground">{xrefInput.trim()} chain</p>
                        <p className="text-[11px] text-muted-foreground">{xrefResults.length} cross-references</p>
                      </div>
                    )
                  })()}
                  {xrefInput.trim() && !xrefInput.trim().match(/^(.+?)\s+(\d+):(\d+)$/) && (
                    <p className="px-3 py-2 text-[11px] text-muted-foreground italic">Enter a reference like "John 3:16"</p>
                  )}
                </div>
              )}

              {/* Notes */}
              {tab === 'notes' && (
                <div className="flex flex-col h-full">
                  <div className="px-2 py-2">
                    <input
                      value={notesQ}
                      onChange={(e) => setNotesQ(e.target.value)}
                      placeholder="Search your notes…"
                      className="w-full text-[12px] border border-border rounded px-2 py-1.5 bg-background focus:outline-none focus:ring-1 focus:ring-sage-400"
                    />
                  </div>
                  <div className="divide-y divide-border">
                    {notesResults.map((note) => (
                      <div
                        key={note.id}
                        draggable
                        onDragStart={(e) =>
                          e.dataTransfer.setData(
                            'application/bench-clip',
                            JSON.stringify({
                              clipping_type: 'note',
                              source_ref: { type: 'note', annotation_id: note.id },
                            })
                          )
                        }
                        className="px-3 py-2 hover:bg-muted cursor-grab active:cursor-grabbing"
                      >
                        <p className="text-[12px] text-foreground line-clamp-2">
                          {note.note_text ?? note.selected_text ?? ''}
                        </p>
                      </div>
                    ))}
                    {notesQ.trim().length >= 2 && notesResults.length === 0 && (
                      <p className="px-3 py-4 text-[11px] text-muted-foreground italic">No notes found.</p>
                    )}
                  </div>
                </div>
              )}

              {/* Studies */}
              {tab === 'studies' && (
                <div className="flex flex-col h-full">
                  <div className="px-2 py-2">
                    <input
                      value={studiesQ}
                      onChange={(e) => setStudiesQ(e.target.value)}
                      placeholder="Search studies…"
                      className="w-full text-[12px] border border-border rounded px-2 py-1.5 bg-background focus:outline-none focus:ring-1 focus:ring-sage-400"
                    />
                  </div>
                  <div className="divide-y divide-border">
                    {studiesResults.map((study) => (
                      <div
                        key={study.id}
                        draggable
                        onDragStart={(e) =>
                          e.dataTransfer.setData(
                            'application/bench-clip',
                            JSON.stringify({
                              clipping_type: 'study-section',
                              source_ref: {
                                type: 'study-section',
                                study_id: study.id,
                                section_heading: 'introduction',
                              },
                            })
                          )
                        }
                        className="px-3 py-2 hover:bg-muted cursor-grab active:cursor-grabbing"
                      >
                        <p className="text-[12px] font-medium text-foreground truncate">{study.title}</p>
                        {study.summary && (
                          <p className="text-[11px] text-muted-foreground line-clamp-2">{study.summary}</p>
                        )}
                      </div>
                    ))}
                    {studiesQ.trim().length >= 2 && studiesResults.length === 0 && (
                      <p className="px-3 py-4 text-[11px] text-muted-foreground italic">No studies found.</p>
                    )}
                  </div>
                </div>
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
