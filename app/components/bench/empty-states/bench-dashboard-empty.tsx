interface BenchDashboardEmptyProps {
  onCreate: () => void
}

export function BenchDashboardEmpty({ onCreate }: BenchDashboardEmptyProps) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-6 py-24 text-center px-4">
      <svg
        width="120"
        height="120"
        viewBox="0 0 120 120"
        fill="none"
        aria-hidden="true"
      >
        {/* Table-surface line */}
        <line x1="20" y1="78" x2="100" y2="78" stroke="var(--stone-300)" strokeWidth="1" strokeLinecap="round" />
        {/* Pen nib dot */}
        <circle cx="60" cy="62" r="3" fill="var(--sage-500)" fillOpacity="0.7" />
      </svg>
      <div className="max-w-sm">
        <h2 className="text-[26px] font-serif text-stone-900/90 mb-2 leading-tight">
          Nothing on the bench yet.
        </h2>
        <p className="text-sm text-stone-700 leading-relaxed">
          A board is a question and the things around it. Start when you&rsquo;re ready.
        </p>
      </div>
      <button
        onClick={onCreate}
        className="px-5 py-2.5 rounded-lg bg-sage-600 text-white text-sm font-medium
                   hover:bg-sage-700 transition-colors focus-visible:outline
                   focus-visible:outline-2 focus-visible:outline-offset-2
                   focus-visible:outline-sage-500"
      >
        New board
      </button>
    </div>
  )
}
