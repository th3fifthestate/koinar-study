'use client';

import { useState } from 'react';
import { Popover } from '@base-ui/react/popover';
import { HIGHLIGHT_COLORS, type HighlightColor } from './highlight-layer';
import type { TextSelectionResult } from '@/lib/hooks/use-text-selection';

interface AnnotationPopoverProps {
  selection: TextSelectionResult;
  onHighlight: (color: HighlightColor, isPublic: boolean) => void;
  onNote: (color: HighlightColor, noteText: string, isPublic: boolean) => void;
  onClose: () => void;
}

const COLOR_SWATCHES: { name: HighlightColor; css: string }[] = [
  { name: 'yellow', css: 'bg-amber-300' },
  { name: 'green', css: 'bg-emerald-300' },
  { name: 'blue', css: 'bg-sky-300' },
  { name: 'pink', css: 'bg-rose-300' },
  { name: 'purple', css: 'bg-violet-300' },
];

export function AnnotationPopover({ selection, onHighlight, onNote, onClose }: AnnotationPopoverProps) {
  const [mode, setMode] = useState<'color' | 'note'>('color');
  const [selectedColor, setSelectedColor] = useState<HighlightColor>('yellow');
  const [noteText, setNoteText] = useState('');
  const [isPublic, setIsPublic] = useState(false);

  // Virtual anchor: Base UI Positioner accepts an element or a getBoundingClientRect function
  const virtualAnchor = {
    getBoundingClientRect: () => selection.rect,
  };

  return (
    <Popover.Root open onOpenChange={(open) => { if (!open) onClose(); }}>
      <Popover.Portal>
        <Popover.Positioner
          anchor={virtualAnchor}
          side="top"
          sideOffset={8}
          align="center"
          className="z-50"
        >
          <Popover.Popup
            className="origin-(--transform-origin) rounded-lg bg-popover p-3 shadow-lg ring-1 ring-foreground/10 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 duration-150"
          >
            {mode === 'color' ? (
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center gap-1.5">
                  {COLOR_SWATCHES.map((c) => (
                    <button
                      key={c.name}
                      onClick={() => {
                        onHighlight(c.name, isPublic);
                        onClose();
                      }}
                      className={`h-7 w-7 rounded-full ${c.css} border-2 ${
                        selectedColor === c.name
                          ? 'border-foreground/70 scale-110'
                          : 'border-transparent'
                      } transition-all hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2`}
                      title={`Highlight ${HIGHLIGHT_COLORS[c.name].label}`}
                      onMouseEnter={() => setSelectedColor(c.name)}
                    />
                  ))}

                  <div className="mx-1.5 h-5 w-px bg-border" />

                  <button
                    onClick={() => setMode('note')}
                    className="rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    + Note
                  </button>
                </div>

                <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground select-none">
                  <input
                    type="checkbox"
                    checked={isPublic}
                    onChange={(e) => setIsPublic(e.target.checked)}
                    className="rounded border-muted-foreground/40"
                  />
                  Share with community
                </label>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5 w-64">
                <textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Add a note..."
                  className="w-full resize-none rounded-md border bg-background p-2.5 text-sm leading-relaxed placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  rows={3}
                  autoFocus
                  maxLength={5000}
                />

                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground select-none">
                    <input
                      type="checkbox"
                      checked={isPublic}
                      onChange={(e) => setIsPublic(e.target.checked)}
                      className="rounded border-muted-foreground/40"
                    />
                    Share
                  </label>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setMode('color');
                        setNoteText('');
                      }}
                      className="rounded-md px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        if (noteText.trim()) {
                          onNote(selectedColor, noteText.trim(), isPublic);
                          onClose();
                        }
                      }}
                      disabled={!noteText.trim()}
                      className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground transition-opacity disabled:opacity-40"
                    >
                      Save
                    </button>
                  </div>
                </div>
              </div>
            )}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
