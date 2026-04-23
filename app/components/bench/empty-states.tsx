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
