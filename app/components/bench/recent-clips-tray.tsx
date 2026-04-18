'use client'

export function RecentClipsTray() {
  return (
    <aside
      className="flex-shrink-0 h-full bg-background border-l border-border overflow-hidden
                 flex flex-col items-center justify-center"
      style={{ width: 48 }}
      aria-label="Recent clips tray (coming soon)"
    >
      <span
        className="text-[10px] text-muted-foreground tracking-widest uppercase select-none"
        style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
      >
        Recent
      </span>
    </aside>
  )
}
