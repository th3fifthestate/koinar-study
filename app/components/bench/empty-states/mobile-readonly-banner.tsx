export function MobileReadOnlyBanner() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="w-full bg-amber-50 border-b border-amber-200 px-4 py-2
                 text-[13px] text-amber-800 text-center"
    >
      Study Bench is view-only on mobile. Open on a desktop or tablet to edit.
    </div>
  )
}
