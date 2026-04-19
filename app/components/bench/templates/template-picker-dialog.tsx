'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { TEMPLATES } from './index'
import type { TemplateId } from './types'

const TEMPLATE_ORDER: TemplateId[] = ['blank', 'word-study', 'character-study', 'passage-study']

interface TemplatePickerDialogProps {
  open: boolean
  onClose: () => void
}

export function TemplatePickerDialog({ open, onClose }: TemplatePickerDialogProps) {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [question, setQuestion] = useState('')
  const [selected, setSelected] = useState<TemplateId>('blank')
  const [saving, setSaving] = useState(false)

  if (!open) return null

  const create = async () => {
    const trimmed = title.trim()
    if (!trimmed || saving) return
    setSaving(true)
    try {
      const res = await fetch('/api/bench/boards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: trimmed, question: question.trim(), template_id: selected }),
      })
      if (res.ok) {
        const { board } = (await res.json()) as { board: { id: string } }
        router.push(`/bench/${board.id}`)
        onClose()
      } else {
        setSaving(false)
      }
    } catch {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Start from a template"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} aria-hidden />

      {/* Dialog */}
      <div className="relative z-10 w-full max-w-lg mx-4 bg-card border border-border rounded-xl shadow-lg p-6 flex flex-col gap-5">
        <h2 className="text-[17px] font-semibold text-foreground">Start from…</h2>

        {/* Template grid */}
        <div className="grid grid-cols-2 gap-3">
          {TEMPLATE_ORDER.map((id) => {
            const t = TEMPLATES[id]
            const isSelected = selected === id
            return (
              <button
                key={id}
                onClick={() => setSelected(id)}
                className={`text-left p-3 rounded-lg border transition-colors ${
                  isSelected
                    ? 'border-sage-500 bg-sage-50'
                    : 'border-border hover:border-sage-300 hover:bg-muted/50'
                }`}
              >
                <div className="w-full h-16 rounded bg-stone-100 border border-stone-200 mb-2" aria-hidden />
                <p className="text-[13px] font-semibold text-foreground">{t.title}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{t.subtitle}</p>
                <p className="text-[11px] italic text-stone-500 mt-1">{t.description}</p>
              </button>
            )
          })}
        </div>

        {/* Title + question fields */}
        <div className="flex flex-col gap-2">
          <input
            className="w-full px-3 py-2 rounded-lg border border-border text-sm bg-background
                       outline-none focus:ring-1 focus:ring-sage-400"
            placeholder="Board title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void create() }}
            maxLength={120}
            autoFocus
          />
          <input
            className="w-full px-3 py-2 rounded-lg border border-border text-sm bg-background
                       outline-none focus:ring-1 focus:ring-sage-400 italic"
            placeholder="What are you studying? (optional)"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void create() }}
            maxLength={140}
          />
        </div>

        <div className="flex gap-2 justify-end">
          <button
            className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted transition-colors"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="px-4 py-2 rounded-lg bg-sage-600 text-white text-sm font-medium
                       hover:bg-sage-700 disabled:opacity-50 transition-colors"
            onClick={() => void create()}
            disabled={saving || !title.trim()}
          >
            {saving ? 'Creating…' : 'Create board'}
          </button>
        </div>
      </div>
    </div>
  )
}
