'use client'

import { useState, useCallback } from 'react'
import type { BenchBoard } from '@/lib/db/types'
import { BenchDashboardEmpty } from './empty-states/bench-dashboard-empty'
import { TemplatePickerDialog } from './templates/template-picker-dialog'
import { BenchIntroWalkthrough } from './onboarding/bench-intro-walkthrough'
import { CoachMarkPopover } from './onboarding/coach-mark-popover'

interface BoardDashboardProps {
  boards: BenchBoard[]
  showWalkthrough?: boolean
}

type IntroStep = 0 | 1 | 2 | 3

export function BoardDashboard({ boards, showWalkthrough }: BoardDashboardProps) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [introStep, setIntroStep] = useState<IntroStep>(showWalkthrough ? 1 : 0)

  const setIntroSeen = useCallback(() => {
    void fetch('/api/bench/user-flags', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ has_seen_bench_intro: true }),
    }).catch(err => console.error('[walkthrough] flag patch failed', err))
  }, [])

  const skipIntro = useCallback(() => {
    setIntroStep(0)
    setIntroSeen()
  }, [setIntroSeen])

  const finishIntro = useCallback(() => {
    setIntroStep(0)
    setIntroSeen()
    setPickerOpen(true)
  }, [setIntroSeen])

  const newBoardClick = () => {
    if (introStep === 2) { setIntroStep(3); return }
    if (introStep === 3) { finishIntro(); return }
    setPickerOpen(true)
  }

  const newBoardButton = (
    <button
      className="px-4 py-2 rounded-lg bg-sage-600 text-white text-sm font-medium
                 hover:bg-sage-700 transition-colors focus-visible:outline
                 focus-visible:outline-2 focus-visible:outline-offset-2
                 focus-visible:outline-sage-500"
      onClick={newBoardClick}
    >
      + New board
    </button>
  )

  const newBoardWithCoach = (
    <CoachMarkPopover
      open={introStep === 2 || introStep === 3}
      anchorChildren={newBoardButton}
      title={introStep === 3 ? 'Start blank, or from a shape.' : 'Start a board for whatever you\u2019re studying.'}
      body={
        introStep === 3
          ? 'The three shapes are just scaffolding — placeholder cards you replace as you go. Blank gives you nothing and gets out of the way.'
          : 'You can have as many as you like. Each holds one question and the things that help you answer it.'
      }
      step={introStep === 3 ? 3 : 2}
      totalSteps={3}
      onNext={introStep === 3 ? finishIntro : () => setIntroStep(3)}
      onSkip={skipIntro}
      side="bottom"
    />
  )

  if (boards.length === 0) {
    return (
      <>
        {introStep === 1 && (
          <BenchIntroWalkthrough onAdvance={() => setIntroStep(2)} onSkip={skipIntro} />
        )}
        <BenchDashboardEmpty onCreate={() => setPickerOpen(true)} />
        {(introStep === 2 || introStep === 3) && (
          <div className="fixed top-6 right-6 z-[65]">{newBoardWithCoach}</div>
        )}
        <TemplatePickerDialog open={pickerOpen} onClose={() => setPickerOpen(false)} />
      </>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-8 max-w-4xl mx-auto w-full">
      {introStep === 1 && (
        <BenchIntroWalkthrough onAdvance={() => setIntroStep(2)} onSkip={skipIntro} />
      )}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Study Bench</h1>
        {introStep === 2 || introStep === 3 ? newBoardWithCoach : newBoardButton}
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
