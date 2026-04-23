'use client'
import { useEffect } from 'react'

interface BenchIntroWalkthroughProps {
  onAdvance: () => void
  onSkip: () => void
}

/**
 * Step 1 of the three-step bench intro. Steps 2 and 3 are rendered by the
 * dashboard as CoachMarkPopovers anchored to the "New board" button, since
 * they need to point at live UI rather than sit in their own centered card.
 */
export function BenchIntroWalkthrough({ onAdvance, onSkip }: BenchIntroWalkthroughProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onSkip() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onSkip])

  return (
    <>
      <div
        aria-hidden="true"
        className="fixed inset-0 z-[60] bg-[rgba(25,23,20,0.4)]"
        onClick={onSkip}
      />
      <div className="fixed inset-0 z-[70] pointer-events-none flex items-center justify-center">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="walkthrough-title"
          className="pointer-events-auto bg-ivory-paper border border-stone-200
                     rounded-xl shadow-xl p-6 max-w-sm w-full mx-4 flex flex-col gap-4
                     motion-safe:animate-[fadeRise_0.24s_cubic-bezier(0.2,0.8,0.2,1)_both]"
        >
          <div>
            <p id="walkthrough-title" className="text-[18px] font-serif text-stone-900 mb-2">
              Welcome to your bench.
            </p>
            <p className="text-[13px] text-stone-700 leading-relaxed">
              This is a quiet surface for your own study. Pull in verses, entities, notes — arrange
              them however helps you think. The app never steers. You do.
            </p>
          </div>
          <div className="flex items-center justify-end gap-4">
            <button
              onClick={onSkip}
              className="text-xs text-stone-500 hover:underline focus-visible:outline
                         focus-visible:outline-2 focus-visible:outline-sage-500 rounded"
            >
              Skip intro
            </button>
            <button
              onClick={onAdvance}
              className="px-3 py-1.5 rounded-md bg-sage-600 text-white text-xs font-medium
                         hover:bg-sage-700 focus-visible:outline focus-visible:outline-2
                         focus-visible:outline-offset-2 focus-visible:outline-sage-500"
            >
              Show me around
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
