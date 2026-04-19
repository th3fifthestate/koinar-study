'use client'
import { useState, useEffect, useCallback } from 'react'

const STEPS = [
  {
    title: 'Your research canvas',
    body: 'Drag any verse, entity, or note from the left panel onto this canvas to begin building your study.',
  },
  {
    title: 'Connect ideas',
    body: 'Long-press the edge of any card to draw a connection arrow linking two cards.',
  },
  {
    title: 'Stay in budget',
    body: 'The license meter tracks your translation usage so you always know where you stand.',
  },
]

export function BenchIntroWalkthrough({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0)
  const [dimVisible, setDimVisible] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setDimVisible(true), 0)
    return () => clearTimeout(t)
  }, [])

  const dismiss = useCallback(() => {
    void fetch('/api/bench/user-flags', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ has_seen_bench_intro: true }),
    })
    onComplete()
  }, [onComplete])

  const advance = useCallback(() => {
    if (step >= STEPS.length - 1) dismiss()
    else setStep(s => s + 1)
  }, [step, dismiss])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') dismiss() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [dismiss])

  const current = STEPS[step]

  return (
    <>
      <div
        aria-hidden="true"
        className="fixed inset-0 z-[60] bg-[rgba(25,23,20,0.4)] transition-opacity duration-[180ms]"
        style={{ opacity: dimVisible ? 1 : 0 }}
        onClick={dismiss}
      />
      <div className="fixed inset-0 z-[70] pointer-events-none flex items-center justify-center">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="walkthrough-title"
          className="pointer-events-auto bg-card rounded-xl shadow-xl p-6 max-w-sm w-full
                     mx-4 flex flex-col gap-4"
        >
          <div>
            <p id="walkthrough-title" className="text-sm font-semibold text-foreground">
              {current.title}
            </p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{current.body}</p>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">{step + 1} of {STEPS.length}</span>
            <div className="flex gap-3">
              <button onClick={dismiss}
                className="text-xs text-muted-foreground hover:underline focus-visible:outline
                           focus-visible:outline-2 focus-visible:outline-sage-500 rounded">
                Skip
              </button>
              <button onClick={advance}
                className="text-xs font-medium text-sage-600 hover:underline focus-visible:outline
                           focus-visible:outline-2 focus-visible:outline-sage-500 rounded">
                {step === STEPS.length - 1 ? "Let's start" : 'Next'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
