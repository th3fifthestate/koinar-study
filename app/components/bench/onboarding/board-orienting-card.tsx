export function BoardOrientingCard({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="absolute top-8 left-1/2 -translate-x-1/2 z-40 bg-card border border-border
                 rounded-xl shadow-lg px-6 py-4 flex flex-col gap-2 max-w-xs text-center
                 motion-safe:animate-[fadeRise_0.5s_ease-out_both]"
    >
      <p className="text-sm font-semibold text-foreground">Your board is ready</p>
      <p className="text-xs text-muted-foreground">
        Drag a verse, entity, or note from the left panel to start building.
      </p>
      <button
        onClick={onDismiss}
        className="mt-1 text-xs text-sage-600 hover:underline focus-visible:outline
                   focus-visible:outline-2 focus-visible:outline-sage-500 rounded"
      >
        Got it
      </button>
    </div>
  )
}
