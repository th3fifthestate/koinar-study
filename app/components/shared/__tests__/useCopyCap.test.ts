// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';

// Mock external dependencies before importing the hook
vi.mock('sonner', () => ({
  toast: { warning: vi.fn() },
}));

vi.mock('@/lib/translations/registry', () => ({
  TRANSLATIONS: {
    BSB: { isLicensed: false },
    NIV: { isLicensed: true, publisherUrl: 'https://example.com' },
  } as Record<string, { isLicensed: boolean; publisherUrl?: string }>,
}));

vi.mock('@/lib/translations/citations', () => ({
  CITATIONS: {
    NIV: { short: 'NIV®' },
  } as Record<string, { short: string }>,
}));

vi.mock('@/lib/config', () => ({
  config: {
    bible: {
      copy: {
        maxVersesPerCopy: 100,
      },
    },
  },
}));

import { useCopyCap } from '../useCopyCap';

describe('useCopyCap', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns a containerRef object', () => {
    const { result } = renderHook(() =>
      useCopyCap({
        surface: { kind: 'reader', studyId: 'test-study' },
        currentTranslation: 'BSB',
      }),
    );

    expect(result.current.containerRef).toBeDefined();
    expect(typeof result.current.containerRef).toBe('object');
    expect('current' in result.current.containerRef).toBe(true);
  });

  it('does not throw for an unlicensed translation (BSB)', () => {
    expect(() => {
      renderHook(() =>
        useCopyCap({
          surface: { kind: 'reader', studyId: 'test-study' },
          currentTranslation: 'BSB',
        }),
      );
    }).not.toThrow();
  });

  it('does not throw for a licensed translation (NIV)', () => {
    expect(() => {
      renderHook(() =>
        useCopyCap({
          surface: { kind: 'reader', studyId: 'test-study' },
          currentTranslation: 'NIV',
        }),
      );
    }).not.toThrow();
  });

  it('accepts a bench surface without throwing', () => {
    expect(() => {
      renderHook(() =>
        useCopyCap({
          surface: { kind: 'bench', boardId: 'board-42' },
          currentTranslation: 'BSB',
        }),
      );
    }).not.toThrow();
  });
});
