'use client'

import { useState } from 'react'
import type { BenchBoard } from '@/lib/db/types'
import { BenchDashboardEmpty } from './empty-states/bench-dashboard-empty'
import { TemplatePickerDialog } from './templates/template-picker-dialog'

interface BoardDashboardProps {
  boards: BenchBoard[]
}

export function BoardDashboard({ boards }: BoardDashboardProps) {
  const [pickerOpen, setPickerOpen] = useState(false)

  if (boards.length === 0) {
    return (
      <>
        <BenchDashboardEmpty onCreate={() => setPickerOpen(true)} />
        <TemplatePickerDialog open={pickerOpen} onClose={() => setPickerOpen(false)} />
      </>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-8 max-w-4xl mx-auto w-full">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Study Bench</h1>
        <button
          className="px-4 py-2 rounded-lg bg-sage-600 text-white text-sm font-medium
                     hover:bg-sage-700 transition-colors"
          onClick={() => setPickerOpen(true)}
        >
          + New board
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {boards.map((board) => (
          <a
            key={board.id}
            href={`/bench/${board.id}`}
            className="flex flex-col gap-2 p-4 rounded-xl border border-border bg-card
                       hover:bg-muted transition-colors"
          >
            <h2 className="text-[15px] font-semibold text-foreground">{board.title}</h2>
            {board.question && (
              <p className="text-[12px] text-muted-foreground italic line-clamp-2">
                {board.question}
              </p>
            )}
            <p className="text-[11px] text-muted-foreground mt-auto">
              Updated{' '}
              {new Date(board.updated_at).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </p>
          </a>
        ))}
      </div>

      <TemplatePickerDialog open={pickerOpen} onClose={() => setPickerOpen(false)} />
    </div>
  )
}
