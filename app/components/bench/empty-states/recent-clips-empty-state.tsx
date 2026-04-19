export function RecentClipsEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 px-6 text-center">
      <p className="text-sm font-medium text-foreground">Nothing here yet.</p>
      <p className="text-xs text-muted-foreground leading-relaxed">
        When you clip from a study you&rsquo;re reading, it lands here.
      </p>
      <p className="text-[12px] italic text-stone-700/75 mt-1 leading-relaxed">
        You can also drag straight from the left rail — clips are optional.
      </p>
    </div>
  )
}
