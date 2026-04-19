'use client'

// app/components/bench/license-cap-modal.tsx
import { useRouter } from 'next/navigation'
import type { TranslationId } from '@/lib/translations/registry'

export interface LicenseCapModalProps {
  translation: TranslationId
  count: number
  cap: number
  boardId: string
  onClose: () => void
  onChangeTranslation?: () => void
}

export function LicenseCapModal({
  translation,
  count: _count,
  cap,
  onClose,
  onChangeTranslation,
}: LicenseCapModalProps) {
  const router = useRouter()

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="cap-modal-title"
      aria-describedby="cap-modal-desc"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30 animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden
      />

      {/* Modal */}
      <div
        className="relative z-10 w-full max-w-sm mx-4 bg-card border border-border rounded-xl
                   shadow-lg p-6 flex flex-col gap-4
                   animate-in fade-in slide-in-from-bottom-2 duration-200"
      >
        <h2 id="cap-modal-title" className="text-[15px] font-semibold text-foreground">
          You&apos;ve reached the {translation} display limit on this board.
        </h2>
        <p id="cap-modal-desc" className="text-[13px] text-muted-foreground leading-relaxed">
          The {translation} is licensed to display up to {cap} verses per board. You can remove
          an existing {translation} clipping from this board, change its translation, or start a
          new board for the next set of verses.
        </p>

        <div className="flex flex-col gap-2">
          {onChangeTranslation && (
            <button
              className="w-full px-4 py-2.5 rounded-lg bg-sage-600 text-white text-sm font-medium
                         hover:bg-sage-700 transition-colors"
              onClick={() => { onChangeTranslation(); onClose() }}
            >
              Change translation
            </button>
          )}
          <button
            className="w-full px-4 py-2.5 rounded-lg border border-border text-sm
                       hover:bg-muted transition-colors"
            onClick={() => { router.push('/bench'); onClose() }}
          >
            Start a new board
          </button>
          <button
            className="w-full px-4 py-2.5 rounded-lg text-sm text-muted-foreground
                       hover:bg-muted transition-colors"
            onClick={onClose}
          >
            Cancel
          </button>
        </div>

        <p className="text-[11px] text-center text-muted-foreground">
          <a
            href={`/attributions#${translation.toLowerCase()}`}
            className="underline underline-offset-2 hover:text-foreground"
          >
            Learn why
          </a>
        </p>
      </div>
    </div>
  )
}
