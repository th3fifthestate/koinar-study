// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useReaderPrefs } from './use-reader-prefs';

const PREFS_KEY = 'koinar:reader:prefs';
const LEGACY_KEY = 'koinar:reader:fontSize';

// In-memory localStorage mock
function makeLocalStorageMock() {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
    _store: () => store,
  };
}

describe('useReaderPrefs', () => {
  let localStorageMock: ReturnType<typeof makeLocalStorageMock>;

  beforeEach(() => {
    localStorageMock = makeLocalStorageMock();
    vi.stubGlobal('localStorage', localStorageMock);
    // Reset the module-level error-logged flag between tests by re-importing
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('persist-write on change: setFontSize writes new prefs to localStorage', async () => {
    const { result } = renderHook(() => useReaderPrefs());

    act(() => {
      result.current.setFontSize('large');
    });

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      PREFS_KEY,
      JSON.stringify({ fontSize: 'large' }),
    );
    expect(result.current.prefs.fontSize).toBe('large');
  });

  it('read-on-mount: returns stored fontSize after mount effect runs', async () => {
    localStorageMock.getItem.mockImplementation((key: string) => {
      if (key === PREFS_KEY) return JSON.stringify({ fontSize: 'large' });
      return null;
    });

    const { result } = renderHook(() => useReaderPrefs());

    // useEffect fires after render; act flushes effects
    await act(async () => {});

    expect(result.current.prefs.fontSize).toBe('large');
  });

  it('missing-value fallback: returns medium when no key is in localStorage', async () => {
    // localStorage returns null for all keys (default mock)
    const { result } = renderHook(() => useReaderPrefs());

    await act(async () => {});

    expect(result.current.prefs.fontSize).toBe('medium');
  });

  it('malformed-value fallback: returns medium when stored fontSize is invalid', async () => {
    localStorageMock.getItem.mockImplementation((key: string) => {
      if (key === PREFS_KEY) return JSON.stringify({ fontSize: 'jumbo' });
      return null;
    });

    const { result } = renderHook(() => useReaderPrefs());

    await act(async () => {});

    expect(result.current.prefs.fontSize).toBe('medium');
  });

  it('migration: imports old koinar:reader:fontSize key and deletes it', async () => {
    localStorageMock.getItem.mockImplementation((key: string) => {
      if (key === LEGACY_KEY) return 'large';
      return null;
    });

    const { result } = renderHook(() => useReaderPrefs());

    await act(async () => {});

    // The hook should have migrated the value
    expect(result.current.prefs.fontSize).toBe('large');

    // Old key must be deleted
    expect(localStorageMock.removeItem).toHaveBeenCalledWith(LEGACY_KEY);

    // New key must be written
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      PREFS_KEY,
      expect.stringContaining('"fontSize":"large"'),
    );
  });
});
