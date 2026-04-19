export function RecentClipsEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 px-6 text-center">
      <p className="text-sm font-medium text-foreground">No recent clips</p>
      <p className="text-xs text-muted-foreground leading-relaxed">
        Items you clip from studies appear here, ready to drag onto your board.
      </p>
    </div>
  )
}
