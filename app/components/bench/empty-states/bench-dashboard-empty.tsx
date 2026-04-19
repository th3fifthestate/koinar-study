interface BenchDashboardEmptyProps {
  onCreate: () => void
}

export function BenchDashboardEmpty({ onCreate }: BenchDashboardEmptyProps) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-6 py-24 text-center px-4">
      <div className="w-16 h-16 rounded-2xl bg-sage-100 flex items-center justify-center">
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
          <rect x="4" y="4" width="10" height="10" rx="2" stroke="currentColor"
            strokeWidth="1.5" className="text-sage-600"/>
          <rect x="18" y="4" width="10" height="10" rx="2" stroke="currentColor"
            strokeWidth="1.5" className="text-sage-600"/>
          <rect x="4" y="18" width="10" height="10" rx="2" stroke="currentColor"
            strokeWidth="1.5" className="text-sage-600"/>
          <path d="M18 23h10M23 18v10" stroke="currentColor" strokeWidth="1.5"
            strokeLinecap="round" className="text-sage-600"/>
        </svg>
      </div>
      <div className="max-w-sm">
        <h2 className="text-xl font-semibold text-foreground mb-2">Your bench is empty</h2>
        <p className="text-sm text-muted-foreground">
          Create your first board to start organizing verses, entities, and notes
          on a visual canvas.
        </p>
      </div>
      <button
        onClick={onCreate}
        className="px-5 py-2.5 rounded-lg bg-sage-600 text-white text-sm font-medium
                   hover:bg-sage-700 transition-colors focus-visible:outline
                   focus-visible:outline-2 focus-visible:outline-offset-2
                   focus-visible:outline-sage-500"
      >
        Create your first board
      </button>
    </div>
  )
}
