'use client'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useReducedMotion } from 'framer-motion'

interface CoachMarkPopoverProps {
  open: boolean
  anchorChildren: React.ReactNode
  title: string
  body: string
  step: number
  totalSteps: number
  onNext: () => void
  onSkip: () => void
  side?: 'top' | 'bottom' | 'left' | 'right'
}

export function CoachMarkPopover({
  open, anchorChildren, title, body, step, totalSteps, onNext, onSkip, side = 'bottom'
}: CoachMarkPopoverProps) {
  const reduced = useReducedMotion()
  return (
    <Popover open={open}>
      <PopoverTrigger>
        <div className={open && !reduced
          ? 'ring-2 ring-sage-500 ring-offset-2 animate-[coachPulse_2s_ease-in-out_1]'
          : ''
        }>
          {anchorChildren}
        </div>
      </PopoverTrigger>
      <PopoverContent
        side={side}
        aria-labelledby="coach-mark-title"
        className="w-72 p-4 flex flex-col gap-3 z-[70]"
      >
        <div>
          <p id="coach-mark-title" className="text-sm font-semibold text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{body}</p>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">{step} of {totalSteps}</span>
          <div className="flex gap-3">
            <button onClick={onSkip}
              className="text-xs text-muted-foreground hover:underline focus-visible:outline
                         focus-visible:outline-2 focus-visible:outline-sage-500 rounded">
              Skip intro
            </button>
            <button onClick={onNext}
              className="text-xs font-medium text-sage-600 hover:underline focus-visible:outline
                         focus-visible:outline-2 focus-visible:outline-sage-500 rounded">
              {step === totalSteps ? "Let's start" : 'Got it'}
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
