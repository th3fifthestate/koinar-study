'use client';

import { useState, useCallback } from 'react';
import { Settings, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import type { TranslationAvailability } from '@/lib/translations/registry';
import type { SwapFailureReason } from '@/lib/translations/swap-failure';
import { SWAP_FAILURE_HINT } from '@/lib/translations/swap-failure';

type FontSize = 'small' | 'medium' | 'large';
type PopoverView = 'main' | 'translation-list';

// Per-row in-session state (extends server-supplied TranslationAvailability.state)
type RowState = 'verifying' | 'unavailable';

interface ReaderSettingsPopoverProps {
  fontSize: FontSize;
  onFontSizeChange: (size: FontSize) => void;
  onResetPrefs: () => void;
  translations: TranslationAvailability[];
  currentTranslation: string;
  onTranslationSelect: (id: string) => Promise<void>;
  translating: boolean;
}

const FONT_SIZE_OPTIONS: { key: FontSize; label: string; display: string }[] = [
  { key: 'small', label: 'Small text', display: 'S' },
  { key: 'medium', label: 'Medium text', display: 'M' },
  { key: 'large', label: 'Large text', display: 'L' },
];

export function ReaderSettingsPopover({
  fontSize,
  onFontSizeChange,
  onResetPrefs,
  translations,
  currentTranslation,
  onTranslationSelect,
  translating,
}: ReaderSettingsPopoverProps) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<PopoverView>('main');

  // Per-row in-session state
  const [rowStates, setRowStates] = useState<Map<string, RowState>>(new Map());
  const [rowFailureReasons, setRowFailureReasons] = useState<Map<string, SwapFailureReason>>(new Map());

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      // Reset view when closing
      setView('main');
    }
  }, []);

  const handleResetPrefs = useCallback(() => {
    onResetPrefs();
    setOpen(false);
  }, [onResetPrefs]);

  const handleTranslationClick = useCallback(async (id: string) => {
    // No-op if already current
    if (id === currentTranslation) return;
    // No-op if any row is currently verifying
    if ([...rowStates.values()].includes('verifying')) return;
    // No-op if this row is unavailable
    if (rowStates.get(id) === 'unavailable') return;

    // Set verifying state
    setRowStates((prev) => {
      const next = new Map(prev);
      next.set(id, 'verifying');
      return next;
    });

    try {
      await onTranslationSelect(id);
      // On success — clear verifying state, close popover
      setRowStates((prev) => {
        const next = new Map(prev);
        next.delete(id);
        return next;
      });
      setOpen(false);
      setView('main');
    } catch (err) {
      // Determine failure reason from thrown error
      const reason: SwapFailureReason =
        typeof err === 'string' && err in SWAP_FAILURE_HINT
          ? (err as SwapFailureReason)
          : 'network';

      setRowStates((prev) => {
        const next = new Map(prev);
        next.set(id, 'unavailable');
        return next;
      });
      setRowFailureReasons((prev) => {
        const next = new Map(prev);
        next.set(id, reason);
        return next;
      });
    }
  }, [currentTranslation, rowStates, onTranslationSelect]);

  const isAnyVerifying = [...rowStates.values()].includes('verifying');

  const currentTranslationName =
    translations.find((t) => t.id === currentTranslation)?.name ?? currentTranslation;

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        aria-label="Reader settings"
        className="flex items-center gap-1.5 rounded-full border border-[var(--stone-200)] px-3 py-1 text-xs text-[var(--stone-500)] transition-colors hover:border-[var(--sage-400)] hover:text-[var(--sage-600)] dark:border-[var(--stone-700)] dark:text-[var(--stone-400)] dark:hover:border-[var(--sage-500)] dark:hover:text-[var(--sage-400)]"
      >
        <Settings className="h-3.5 w-3.5" aria-hidden="true" />
        <span>Reader Settings</span>
        <span aria-hidden="true" className="text-[10px]">▾</span>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        side="bottom"
        sideOffset={8}
        className="w-[280px] p-0"
      >
        {view === 'main' ? (
          <MainView
            fontSize={fontSize}
            onFontSizeChange={onFontSizeChange}
            onReset={handleResetPrefs}
            currentTranslationName={currentTranslationName}
            showChangeTranslation={translations.length > 1}
            onGoToTranslationList={() => setView('translation-list')}
            translating={translating}
          />
        ) : (
          <TranslationListView
            translations={translations}
            currentTranslation={currentTranslation}
            rowStates={rowStates}
            rowFailureReasons={rowFailureReasons}
            isAnyVerifying={isAnyVerifying}
            onBack={() => setView('main')}
            onSelect={handleTranslationClick}
          />
        )}
      </PopoverContent>
    </Popover>
  );
}

// ────────────────────────────────────────────────────────────
// Main view
// ────────────────────────────────────────────────────────────

function MainView({
  fontSize,
  onFontSizeChange,
  onReset,
  currentTranslationName,
  showChangeTranslation,
  onGoToTranslationList,
  translating,
}: {
  fontSize: FontSize;
  onFontSizeChange: (size: FontSize) => void;
  onReset: () => void;
  currentTranslationName: string;
  showChangeTranslation: boolean;
  onGoToTranslationList: () => void;
  translating: boolean;
}) {
  return (
    <div className="flex flex-col">
      {/* Text size row */}
      <div className="px-4 pt-4 pb-3">
        <p className="mb-2 text-xs font-medium text-[var(--stone-500)] dark:text-[var(--stone-400)]">
          Text size
        </p>
        <div className="flex items-center gap-1">
          {FONT_SIZE_OPTIONS.map(({ key, label, display }) => (
            <button
              key={key}
              onClick={() => onFontSizeChange(key)}
              aria-label={label}
              aria-pressed={fontSize === key}
              className={`flex-1 rounded py-1.5 text-sm font-medium transition-colors ${
                fontSize === key
                  ? 'bg-[var(--sage-500)] text-[var(--stone-50)]'
                  : 'bg-[var(--stone-100)] text-[var(--stone-500)] hover:bg-[var(--stone-200)] hover:text-[var(--stone-700)] dark:bg-[var(--stone-800)] dark:text-[var(--stone-400)] dark:hover:bg-[var(--stone-700)] dark:hover:text-[var(--stone-200)]'
              }`}
            >
              {display}
            </button>
          ))}
        </div>
      </div>

      {/* Divider */}
      <hr className="border-[var(--stone-100)] dark:border-[var(--stone-800)]" />

      {/* Reading mode row (disabled placeholder for 28c) */}
      <div className="px-4 py-3">
        <p className="mb-2 flex items-center justify-between text-xs font-medium text-[var(--stone-500)] dark:text-[var(--stone-400)]">
          <span>Reading mode</span>
          <span className="text-[10px] text-[var(--stone-400)] dark:text-[var(--stone-600)]">Coming soon</span>
        </p>
        <div className="flex items-center gap-1">
          {['Dark', 'Light', 'Sepia'].map((mode) => (
            <button
              key={mode}
              aria-disabled="true"
              title="Coming in a future update"
              tabIndex={-1}
              className="flex-1 cursor-not-allowed rounded py-1.5 text-sm font-medium opacity-35 bg-[var(--stone-100)] text-[var(--stone-500)] dark:bg-[var(--stone-800)] dark:text-[var(--stone-400)]"
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* Divider */}
      <hr className="border-[var(--stone-100)] dark:border-[var(--stone-800)]" />

      {/* Translation row */}
      <div className="px-4 py-3">
        <p className="mb-2 text-xs font-medium text-[var(--stone-500)] dark:text-[var(--stone-400)]">
          Translation
        </p>
        <div className="flex items-center justify-between">
          <span className="text-sm text-[var(--stone-700)] dark:text-[var(--stone-300)]">
            {currentTranslationName}
            {translating && (
              <span className="ml-1.5 text-[11px] text-[var(--stone-400)] dark:text-[var(--stone-500)]">
                Switching…
              </span>
            )}
          </span>
          {showChangeTranslation && (
            <button
              onClick={onGoToTranslationList}
              className="flex items-center gap-0.5 text-xs text-[var(--sage-600)] hover:text-[var(--sage-700)] dark:text-[var(--sage-400)] dark:hover:text-[var(--sage-300)]"
            >
              Change
              <ChevronRight className="h-3 w-3" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* Divider */}
      <hr className="border-[var(--stone-100)] dark:border-[var(--stone-800)]" />

      {/* Reset */}
      <div className="px-4 py-3">
        <button
          onClick={onReset}
          className="text-xs text-[var(--stone-400)] hover:text-[var(--stone-600)] dark:text-[var(--stone-500)] dark:hover:text-[var(--stone-300)] transition-colors"
        >
          Reset to defaults
        </button>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Translation list view
// ────────────────────────────────────────────────────────────

function TranslationListView({
  translations,
  currentTranslation,
  rowStates,
  rowFailureReasons,
  isAnyVerifying,
  onBack,
  onSelect,
}: {
  translations: TranslationAvailability[];
  currentTranslation: string;
  rowStates: Map<string, RowState>;
  rowFailureReasons: Map<string, SwapFailureReason>;
  isAnyVerifying: boolean;
  onBack: () => void;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-[var(--stone-100)] px-3 py-2.5 dark:border-[var(--stone-800)]">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-xs text-[var(--stone-500)] hover:text-[var(--stone-700)] dark:text-[var(--stone-400)] dark:hover:text-[var(--stone-200)] transition-colors"
          aria-label="Back to reader settings"
        >
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Back
        </button>
        <span className="text-xs font-medium text-[var(--stone-600)] dark:text-[var(--stone-300)]">
          Choose translation
        </span>
      </div>

      {/* Scrollable translation list */}
      <div className="max-h-[280px] overflow-y-auto py-1" role="listbox" aria-label="Available translations">
        {translations.map((t) => {
          const rowState = rowStates.get(t.id);
          const failureReason = rowFailureReasons.get(t.id);
          const isCurrent = t.id === currentTranslation;
          const isVerifying = rowState === 'verifying';
          const isUnavailable = rowState === 'unavailable';
          const isDisabled = isUnavailable || isAnyVerifying;

          return (
            <div key={t.id}>
              <button
                role="option"
                aria-selected={isCurrent}
                aria-current={isCurrent ? 'true' : undefined}
                aria-disabled={isDisabled ? 'true' : undefined}
                disabled={isDisabled}
                onClick={() => !isDisabled && onSelect(t.id)}
                className={`w-full px-4 py-2.5 text-left flex items-center justify-between transition-colors ${
                  isCurrent
                    ? 'bg-[var(--sage-50)] text-[var(--sage-700)] dark:bg-[var(--sage-950)] dark:text-[var(--sage-300)]'
                    : isUnavailable
                      ? 'opacity-50 cursor-not-allowed text-[var(--stone-500)] dark:text-[var(--stone-400)]'
                      : isVerifying
                        ? 'bg-[var(--stone-50)] text-[var(--stone-600)] dark:bg-[var(--stone-900)] dark:text-[var(--stone-300)]'
                        : 'text-[var(--stone-700)] hover:bg-[var(--stone-50)] dark:text-[var(--stone-300)] dark:hover:bg-[var(--stone-800)]'
                } ${isDisabled && !isUnavailable ? 'pointer-events-none' : ''}`}
              >
                <span className="text-sm font-medium">{t.name}</span>
                <span className="text-[11px] text-[var(--stone-400)] dark:text-[var(--stone-500)]">
                  {isVerifying && 'Verifying\u2026'}
                  {isCurrent && !isVerifying && (
                    <span className="text-[var(--sage-600)] dark:text-[var(--sage-400)]">Active</span>
                  )}
                </span>
              </button>
              {isUnavailable && failureReason && (
                <p className="px-4 pb-2 text-[11px] text-[var(--stone-400)] dark:text-[var(--stone-500)]">
                  {SWAP_FAILURE_HINT[failureReason]}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
