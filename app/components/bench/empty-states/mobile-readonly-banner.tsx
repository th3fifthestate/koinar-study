export function MobileReadOnlyBanner() {
  return (
    <div
      className="w-full bg-ivory-paper border-b border-stone-200 px-4
                 h-9 flex items-center justify-center text-[13px] text-stone-700 text-center"
    >
      <span>
        <strong className="font-semibold">Study Bench boards read best on desktop.</strong>{' '}
        Editing is disabled at this size. Your clips from reading still work.
      </span>
    </div>
  )
}
