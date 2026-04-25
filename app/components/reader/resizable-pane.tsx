'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

// ─── Constants ──────────────────────────────────────────────────────────────

const DEFAULT_WIDTH = 448;
const MIN_WIDTH = 320;
const MAX_WIDTH_RATIO = 0.6; // of viewport
const MOBILE_BREAKPOINT = 768;
const STORAGE_KEY = 'reader-pane-width';
const CSS_VAR = '--reader-pane-width';

// ─── Hook: persisted width ──────────────────────────────────────────────────

export function useResizablePaneWidth(): [number, (w: number) => void] {
  const [width, setWidth] = React.useState<number>(DEFAULT_WIDTH);

  // Hydrate from localStorage on mount.
  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const n = parseInt(raw, 10);
      if (Number.isFinite(n) && n >= MIN_WIDTH) setWidth(n);
    } catch {
      /* quota / private mode — fall back to default */
    }
  }, []);

  const persistWidth = React.useCallback((w: number) => {
    setWidth(w);
    try {
      window.localStorage.setItem(STORAGE_KEY, String(Math.round(w)));
    } catch {
      /* ignore */
    }
  }, []);

  return [width, persistWidth];
}

// ─── Viewport query ─────────────────────────────────────────────────────────

function useIsMobile(): boolean {
  const [mobile, setMobile] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const sync = () => setMobile(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);
  return mobile;
}

// ─── Body flow offset ───────────────────────────────────────────────────────

/**
 * Writes the drawer's effective width to `--reader-pane-width` on the root.
 * Content that wants to reflow applies `margin-right: var(--reader-pane-width, 0px)`.
 * On mobile, effective width is 0 (overlay, no reflow).
 */
function useBodyOffset(open: boolean, width: number, mobile: boolean, dragging: boolean) {
  React.useEffect(() => {
    const root = document.documentElement;
    const effective = open && !mobile ? width : 0;
    root.style.setProperty(CSS_VAR, `${effective}px`);
    // Toggle transition: animate on open/close, instant during drag.
    root.dataset.paneAnimating = dragging ? 'false' : 'true';
    return () => {
      root.style.removeProperty(CSS_VAR);
      delete root.dataset.paneAnimating;
    };
  }, [open, width, mobile, dragging]);
}

// ─── Component ──────────────────────────────────────────────────────────────

interface ResizablePaneProps {
  open: boolean;
  onClose: () => void;
  width: number;
  onWidthChange: (w: number) => void;
  ariaLabel: string;
  children: React.ReactNode;
  stackLevel?: number;
  className?: string;
}

export function ResizablePane({
  open,
  onClose,
  width,
  onWidthChange,
  ariaLabel,
  children,
  stackLevel = 50,
  className,
}: ResizablePaneProps) {
  const mobile = useIsMobile();
  const [dragging, setDragging] = React.useState(false);
  // SSR-safe constant initial value. The useEffect below syncs to the actual
  // viewport on first client render. Initializing from window.innerWidth here
  // would cause a hydration mismatch between the SSR HTML (960) and the first
  // client render (computed from window.innerWidth), since the markup is
  // emitted server-side before the client knows the viewport size.
  const [maxWidth, setMaxWidth] = React.useState(960);
  const paneRef = React.useRef<HTMLDivElement>(null);
  const handleRef = React.useRef<HTMLDivElement>(null);

  // Track viewport changes so aria-valuemax stays accurate for screen readers.
  React.useEffect(() => {
    const sync = () => setMaxWidth(Math.round(window.innerWidth * MAX_WIDTH_RATIO));
    sync();
    window.addEventListener('resize', sync);
    return () => window.removeEventListener('resize', sync);
  }, []);

  useBodyOffset(open, width, mobile, dragging);

  // Esc to close.
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Focus the pane on open for screen-reader announcement.
  React.useEffect(() => {
    if (open && paneRef.current) paneRef.current.focus({ preventScroll: true });
  }, [open]);

  // Drag logic — pointer-based, clamped to [MIN, viewport * MAX_RATIO].
  React.useEffect(() => {
    if (mobile) return;
    const handle = handleRef.current;
    if (!handle) return;

    const clamp = (w: number) =>
      Math.max(MIN_WIDTH, Math.min(w, window.innerWidth * MAX_WIDTH_RATIO));

    const onDown = (e: PointerEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startW = width;
      handle.setPointerCapture(e.pointerId);
      setDragging(true);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      const onMove = (ev: PointerEvent) => {
        // Drag left = grow; drag right = shrink.
        const next = clamp(startW + (startX - ev.clientX));
        onWidthChange(next);
      };
      const onUp = (ev: PointerEvent) => {
        try {
          handle.releasePointerCapture(ev.pointerId);
        } catch {
          /* already released */
        }
        handle.removeEventListener('pointermove', onMove);
        handle.removeEventListener('pointerup', onUp);
        handle.removeEventListener('pointercancel', onUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        setDragging(false);
      };
      handle.addEventListener('pointermove', onMove);
      handle.addEventListener('pointerup', onUp);
      handle.addEventListener('pointercancel', onUp);
    };

    handle.addEventListener('pointerdown', onDown);
    return () => handle.removeEventListener('pointerdown', onDown);
    // width intentionally captured per-pointerdown via startW; no need to re-bind.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mobile, onWidthChange]);

  // Double-click handle: snap to default width.
  const onHandleDoubleClick = React.useCallback(() => {
    onWidthChange(DEFAULT_WIDTH);
  }, [onWidthChange]);

  // Keyboard resize: arrows on the handle move width in 16px steps.
  const onHandleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (mobile) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        onWidthChange(Math.min(window.innerWidth * MAX_WIDTH_RATIO, width + 16));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        onWidthChange(Math.max(MIN_WIDTH, width - 16));
      } else if (e.key === 'Home') {
        e.preventDefault();
        onWidthChange(DEFAULT_WIDTH);
      }
    },
    [mobile, width, onWidthChange]
  );

  // Width is forced to viewport on mobile (overlay style).
  const appliedWidth = mobile ? '100%' : `${width}px`;

  return (
    <div
      ref={paneRef}
      role="complementary"
      aria-label={ariaLabel}
      tabIndex={-1}
      data-open={open ? 'true' : 'false'}
      data-dragging={dragging ? 'true' : 'false'}
      className={cn(
        'fixed inset-y-0 right-0 flex flex-col bg-popover text-popover-foreground shadow-lg outline-none',
        'border-l border-[var(--stone-200)] dark:border-[var(--stone-700)]',
        // Animate transform + width when not dragging (and not mobile).
        !dragging && 'md:transition-[transform,width] md:duration-200 md:ease-out',
        'transition-transform duration-200 ease-out',
        open ? 'translate-x-0' : 'translate-x-full',
        className
      )}
      style={{ width: appliedWidth, zIndex: stackLevel }}
    >
      {/* Drag handle — visible strip on the left edge. Hidden on mobile. */}
      <div
        ref={handleRef}
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize panel"
        aria-valuenow={Math.round(width)}
        aria-valuemin={MIN_WIDTH}
        aria-valuemax={maxWidth}
        tabIndex={open && !mobile ? 0 : -1}
        onDoubleClick={onHandleDoubleClick}
        onKeyDown={onHandleKeyDown}
        className={cn(
          'group/handle absolute inset-y-0 -left-1 w-2 cursor-col-resize select-none',
          'md:block hidden',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-sage-500'
        )}
      >
        <div
          aria-hidden="true"
          className={cn(
            'absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-transparent',
            'group-hover/handle:bg-[var(--sage-400)] group-focus-visible/handle:bg-[var(--sage-500)]',
            dragging && 'bg-[var(--sage-500)]'
          )}
        />
      </div>
      {children}
    </div>
  );
}
