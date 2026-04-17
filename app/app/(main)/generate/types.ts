export type Format = 'simple' | 'standard' | 'comprehensive';
export type Translation = 'bsb'; // only BSB on /generate

export type GiftCredits = Partial<Record<Format, number>>;

export type Entitlement =
  | { kind: 'byok' }
  | { kind: 'admin' }
  | { kind: 'gift'; credits: GiftCredits }
  | { kind: 'none' };

export interface ToolCallEntry {
  id: string;
  phrase: string;
  timestampMs: number;
}

export type GenerateState =
  | { kind: 'empty-no-entitlement' }
  | { kind: 'idle'; prompt: string; format: Format; entitlement: Entitlement }
  | { kind: 'validating'; prompt: string; format: Format; entitlement: Entitlement; errors: { prompt?: string } }
  | { kind: 'submitting'; prompt: string; format: Format }
  | { kind: 'streaming'; prompt: string; format: Format; toolCalls: ToolCallEntry[]; textBuffered: string }
  | { kind: 'completing'; prompt: string; format: Format; title: string; slug: string }
  | { kind: 'complete'; title: string; slug: string; countdownMs: number }
  | { kind: 'error-rate-limited'; prompt: string; format: Format; retryAt: number }
  | { kind: 'error-invalid-key'; prompt: string; format: Format }
  | { kind: 'error-stream-aborted'; prompt: string; format: Format }
  | { kind: 'error-save-failed'; prompt: string; format: Format; markdown: string };

export interface GenerateAction {
  type:
    | 'submit'
    | 'validate-fail'
    | 'stream-start'
    | 'stream-chunk'
    | 'stream-tool-call'
    | 'stream-complete'
    | 'save-ok'
    | 'save-failed'
    | 'error-rate-limited'
    | 'error-invalid-key'
    | 'error-stream-aborted'
    | 'retry'
    | 'open-study'
    | 'cancel-redirect';
  payload?: Record<string, unknown>;
}
