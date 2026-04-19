'use client'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

const isMac = typeof navigator !== 'undefined' &&
  /mac/i.test(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((navigator as any).userAgentData?.platform ?? navigator.platform) as string
  )
const mod = isMac ? '⌘' : 'Ctrl'

const ALL_SHORTCUTS = [
  { keys: 'Space + drag', action: 'Pan canvas' },
  { keys: `${mod}+scroll`, action: 'Zoom in/out' },
  { keys: 'F', action: 'Reset view' },
  { keys: `${mod}+D`, action: 'Duplicate selected' },
  { keys: 'Delete', action: 'Delete selected' },
  { keys: `${mod}+Z`, action: 'Undo' },
  { keys: `${mod}+Shift+Z`, action: 'Redo' },
  { keys: '↑ ↓ ← →', action: 'Nudge 8px' },
  { keys: 'Shift + arrows', action: 'Nudge 32px' },
  { keys: 'Enter', action: 'Open expanded view' },
  { keys: 'Escape', action: 'Clear selection' },
  { keys: '/', action: 'Focus drawer search' },
  { keys: `${mod}+K`, action: 'Focus tab search' },
  { keys: '[', action: 'Toggle source drawer' },
  { keys: ']', action: 'Toggle recent clips' },
  { keys: '?', action: 'This cheat sheet' },
]

const mid = Math.ceil(ALL_SHORTCUTS.length / 2)
const left = ALL_SHORTCUTS.slice(0, mid)
const right = ALL_SHORTCUTS.slice(mid)

interface KeyboardCheatSheetProps {
  open: boolean
  onClose: () => void
}

export function KeyboardCheatSheet({ open, onClose }: KeyboardCheatSheetProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 mt-2">
          {[left, right].map((col, ci) => (
            <div key={ci} className="flex flex-col gap-1.5">
              {col.map(({ keys, action }) => (
                <div key={keys} className="flex items-center justify-between gap-4">
                  <span className="text-xs text-muted-foreground">{action}</span>
                  <kbd className="text-[11px] font-mono bg-muted rounded px-1.5 py-0.5 shrink-0 whitespace-nowrap">
                    {keys}
                  </kbd>
                </div>
              ))}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
