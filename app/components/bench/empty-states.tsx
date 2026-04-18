export function NoBoards({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
      <div className="text-5xl select-none" aria-hidden>📋</div>
      <h2 className="text-xl font-semibold text-foreground">No study boards yet</h2>
      <p className="text-muted-foreground text-sm max-w-xs">
        Create a board to start organizing your research on the bench.
      </p>
      <button
        className="px-4 py-2 rounded-lg bg-sage-600 text-white text-sm font-medium
                   hover:bg-sage-700 transition-colors"
        onClick={onCreate}
      >
        New board
      </button>
    </div>
  )
}

export function EmptyCanvas() {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div className="text-center opacity-40 select-none">
        <p className="text-lg text-muted-foreground">Drag a verse or entity onto the canvas</p>
        <p className="text-sm text-muted-foreground mt-1">or use the source drawer on the left</p>
      </div>
    </div>
  )
}

export function MobileNotice() {
  return (
    <div
      className="sticky top-0 z-50 bg-amber-50 border-b border-amber-200 px-4 py-2 text-center
                 text-[13px] text-amber-800 md:hidden"
    >
      Study Bench is optimized for desktop. Editing is disabled on small screens.
    </div>
  )
}
