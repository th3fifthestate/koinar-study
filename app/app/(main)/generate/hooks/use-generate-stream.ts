'use client';
import { useReducer, useRef, useCallback } from 'react';
import type { GenerateState, Format, Entitlement, ToolCallEntry } from '../types';
import { GENERIC_PHRASES } from '../lib/tool-call-phrases';

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

type Action =
  | { type: 'submit'; prompt: string; format: Format }
  | { type: 'validate-fail'; prompt: string; format: Format; entitlement: Entitlement; errors: { prompt?: string } }
  | { type: 'stream-start' }
  | { type: 'stream-chunk'; text: string; toolCall?: ToolCallEntry }
  | { type: 'stream-complete'; title: string; slug: string }
  | { type: 'save-failed'; markdown: string }
  | { type: 'complete' }
  | { type: 'error-rate-limited'; retryAt: number }
  | { type: 'error-invalid-key' }
  | { type: 'error-stream-aborted' }
  | { type: 'reset-to-idle'; entitlement: Entitlement; prompt: string; format: Format };

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

function reducer(state: GenerateState, action: Action): GenerateState {
  switch (action.type) {
    case 'submit':
      if (
        state.kind === 'idle' ||
        state.kind === 'validating'
      ) {
        return { kind: 'submitting', prompt: action.prompt, format: action.format };
      }
      return state;

    case 'validate-fail':
      return {
        kind: 'validating',
        prompt: action.prompt,
        format: action.format,
        entitlement: action.entitlement,
        errors: action.errors,
      };

    case 'stream-start':
      if (state.kind === 'submitting') {
        return {
          kind: 'streaming',
          prompt: state.prompt,
          format: state.format,
          toolCalls: [],
          textBuffered: '',
        };
      }
      return state;

    case 'stream-chunk':
      if (state.kind === 'streaming') {
        const toolCalls = action.toolCall
          ? [...state.toolCalls, action.toolCall].slice(-12)
          : state.toolCalls;
        return { ...state, textBuffered: action.text, toolCalls };
      }
      return state;

    case 'stream-complete':
      if (state.kind === 'streaming') {
        return {
          kind: 'completing',
          prompt: state.prompt,
          format: state.format,
          title: action.title,
          slug: action.slug,
        };
      }
      return state;

    case 'save-failed':
      if (state.kind === 'completing' || state.kind === 'streaming') {
        return {
          kind: 'error-save-failed',
          prompt: state.prompt,
          format: state.format,
          markdown: action.markdown,
        };
      }
      return state;

    case 'complete':
      if (state.kind === 'completing') {
        return {
          kind: 'complete',
          title: state.title,
          slug: state.slug,
          countdownMs: 3000,
        };
      }
      return state;

    case 'error-rate-limited':
      if (state.kind === 'submitting' || state.kind === 'streaming') {
        return {
          kind: 'error-rate-limited',
          prompt: state.prompt,
          format: state.format,
          retryAt: action.retryAt,
        };
      }
      return state;

    case 'error-invalid-key':
      if (state.kind === 'submitting' || state.kind === 'streaming') {
        return { kind: 'error-invalid-key', prompt: state.prompt, format: state.format };
      }
      return state;

    case 'error-stream-aborted':
      if (state.kind === 'submitting' || state.kind === 'streaming') {
        return { kind: 'error-stream-aborted', prompt: state.prompt, format: state.format };
      }
      return state;

    case 'reset-to-idle':
      return {
        kind: 'idle',
        prompt: action.prompt,
        format: action.format,
        entitlement: action.entitlement,
      };

    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractTitle(text: string): string {
  const match = text.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : '';
}

function stripTerminalMarker(text: string): string {
  const idx = text.lastIndexOf('<!-- koinar-complete:');
  if (idx === -1) return text.trim();
  return text.slice(0, idx).trimEnd();
}

interface TerminalFrame {
  slug: string;
  saveOk: boolean;
  title: string;
}

function parseTerminalMarker(text: string): TerminalFrame | null {
  const prefix = '<!-- koinar-complete:';
  const start = text.indexOf(prefix);
  if (start === -1) return null;
  const jsonStart = start + prefix.length;
  const end = text.indexOf(' -->', jsonStart);
  if (end === -1) return null;
  try {
    return JSON.parse(text.slice(jsonStart, end).trim()) as TerminalFrame;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface UseGenerateStreamReturn {
  state: GenerateState;
  submit: (prompt: string, format: Format) => void;
  retry: (prompt: string, format: Format) => void;
  cancelRedirect: () => void;
}

export function useGenerateStream(entitlement: Entitlement): UseGenerateStreamReturn {
  const initialState: GenerateState =
    entitlement.kind === 'none'
      ? { kind: 'empty-no-entitlement' }
      : { kind: 'idle', prompt: '', format: 'standard', entitlement };

  const [state, dispatch] = useReducer(reducer, initialState);
  const abortRef = useRef<AbortController | null>(null);
  const entitlementRef = useRef(entitlement);
  entitlementRef.current = entitlement;
  const cancelledRef = useRef(false);
  const phraseIndexRef = useRef(0);

  const submit = useCallback(async (prompt: string, format: Format) => {
    // Client-side validation
    if (prompt.trim().length < 10) {
      dispatch({
        type: 'validate-fail',
        prompt,
        format,
        entitlement: entitlementRef.current,
        errors: { prompt: 'A little more to work with — at least ten characters.' },
      });
      return;
    }
    if (prompt.length > 2000) {
      dispatch({
        type: 'validate-fail',
        prompt,
        format,
        entitlement: entitlementRef.current,
        errors: { prompt: 'Koinar does best with a focused passage. Trim to 2,000 characters.' },
      });
      return;
    }

    dispatch({ type: 'submit', prompt, format });

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    phraseIndexRef.current = 0;

    // Heartbeat: if no chunk arrives within 20s, treat as stream-aborted
    let lastChunkAt = Date.now();
    const heartbeat = setInterval(() => {
      if (Date.now() - lastChunkAt > 20_000) {
        clearInterval(heartbeat);
        controller.abort();
        dispatch({ type: 'error-stream-aborted' });
      }
    }, 2_000);

    try {
      const res = await fetch('/api/study/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, format, translation: 'bsb' }),
        signal: controller.signal,
      });

      if (res.status === 429) {
        clearInterval(heartbeat);
        const retryAfter = parseInt(res.headers.get('Retry-After') ?? '300', 10);
        dispatch({ type: 'error-rate-limited', retryAt: Date.now() + retryAfter * 1_000 });
        return;
      }

      if (res.status === 403) {
        clearInterval(heartbeat);
        dispatch({ type: 'error-invalid-key' });
        return;
      }

      if (res.status >= 400) {
        clearInterval(heartbeat);
        const body = await res.text().catch(() => '');
        if (body.includes('Failed to retrieve API key')) {
          dispatch({ type: 'error-invalid-key' });
        } else {
          dispatch({ type: 'error-stream-aborted' });
        }
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        clearInterval(heartbeat);
        dispatch({ type: 'error-stream-aborted' });
        return;
      }

      dispatch({ type: 'stream-start' });

      const decoder = new TextDecoder();
      let accumulated = '';

      // Emit tool-call phrases on a timed schedule to give the UI something to show
      const phraseInterval =
        format === 'simple' ? 4_500 : format === 'standard' ? 5_000 : 5_500;

      const toolCallTimer = setInterval(() => {
        const phrase = GENERIC_PHRASES[phraseIndexRef.current % GENERIC_PHRASES.length];
        phraseIndexRef.current++;
        dispatch({
          type: 'stream-chunk',
          text: accumulated,
          toolCall: { id: String(Date.now()), phrase, timestampMs: Date.now() },
        });
      }, phraseInterval);

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          accumulated += decoder.decode(value, { stream: true });
          lastChunkAt = Date.now();
          dispatch({ type: 'stream-chunk', text: accumulated });
        }
      } finally {
        reader.releaseLock();
        clearInterval(toolCallTimer);
        clearInterval(heartbeat);
      }

      // Parse terminal marker
      const terminal = parseTerminalMarker(accumulated);
      const cleanText = stripTerminalMarker(accumulated);

      // Missing marker = truncated/corrupted stream → stream-aborted (study may be incomplete)
      if (!terminal) {
        dispatch({ type: 'error-stream-aborted' });
        return;
      }

      // saveOk: false = stream complete but DB write failed → save-failed (content is usable)
      if (!terminal.saveOk) {
        dispatch({ type: 'save-failed', markdown: cleanText });
        return;
      }

      const title = terminal.title || extractTitle(cleanText) || prompt.slice(0, 100);
      dispatch({ type: 'stream-complete', title, slug: terminal.slug });
      dispatch({ type: 'complete' });
    } catch (err) {
      clearInterval(heartbeat);
      if (err instanceof Error && err.name === 'AbortError') return;
      dispatch({ type: 'error-stream-aborted' });
    }
  }, []);

  const retry = useCallback((prompt: string, format: Format) => {
    dispatch({
      type: 'reset-to-idle',
      entitlement: entitlementRef.current,
      prompt,
      format,
    });
  }, []);

  const cancelRedirect = useCallback(() => {
    cancelledRef.current = true;
  }, []);

  return { state, submit, retry, cancelRedirect };
}
