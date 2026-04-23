'use client';

import * as React from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { cn } from '@/lib/utils';

// ─── Types ──────────────────────────────────────────────────────────────────

interface ReaderOverlayProps {
  open: boolean;
  onClose: () => void;
  onBackdropClick?: () => void;
  variant?: 'sheet' | 'modal';
  stackLevel?: number;
  className?: string;
  ariaLabel: string;
  children: React.ReactNode;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function ReaderOverlay({
  open,
  onClose,
  onBackdropClick,
  variant = 'sheet',
  stackLevel = 50,
  className,
  ariaLabel,
  children,
}: ReaderOverlayProps) {
  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) onClose();
    },
    [onClose]
  );

  const handleBackdropClick = React.useCallback(
    (e: React.MouseEvent) => {
      if (onBackdropClick) {
        e.stopPropagation();
        onBackdropClick();
      }
    },
    [onBackdropClick]
  );

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop
          className={cn(
            'fixed inset-0 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0',
            variant === 'sheet'
              ? 'bg-black/5 dark:bg-white/5'
              : 'bg-black/20 dark:bg-black/40'
          )}
          style={{ zIndex: stackLevel - 1 }}
          onClick={handleBackdropClick}
        />
        <Dialog.Popup
          className={cn(
            'fixed text-sm text-popover-foreground shadow-lg transition duration-200 ease-in-out data-ending-style:opacity-0 data-starting-style:opacity-0',
            variant === 'sheet' &&
              'inset-y-0 right-0 flex h-full w-full flex-col border-l bg-popover sm:max-w-md data-ending-style:translate-x-[2.5rem] data-starting-style:translate-x-[2.5rem]',
            variant === 'modal' &&
              'inset-0 m-auto flex max-h-[85vh] w-[calc(100%-2rem)] max-w-5xl flex-col overflow-hidden rounded-xl border bg-popover sm:w-full data-ending-style:scale-95 data-starting-style:scale-95',
            className
          )}
          style={{ zIndex: stackLevel }}
        >
          <Dialog.Title className="sr-only">{ariaLabel}</Dialog.Title>
          {children}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
