'use client'
import { useReducedMotion } from 'framer-motion'

export function BoardOrientingCard({ onDismiss }: { onDismiss: () => void }) {
  const reduced = useReducedMotion()
  return (
    <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center">
      <div
        className={`pointer-events-auto relative bg-ivory-paper border border-stone-200
                    rounded-xl shadow-md px-6 py-5 max-w-sm text-center
                    ${reduced ? '' : 'motion-safe:animate-[fadeRise_0.4s_ease-out_both]'}`}
      >
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center
                     text-stone-500 hover:text-stone-900 focus-visible:outline
                     focus-visible:outline-2 focus-visible:outline-sage-500 rounded"
        >
          ×
        </button>
        <p className="text-[17px] font-serif text-stone-900/90 mb-1.5">An empty board.</p>
        <p className="text-[13px] text-stone-700 leading-relaxed">
          Drag something from the left rail to begin. Or clip from a study you&rsquo;re reading and it lands on the right.
        </p>
      </div>
    </div>
  )
}
