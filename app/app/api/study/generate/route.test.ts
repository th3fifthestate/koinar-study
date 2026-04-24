// app/app/api/study/generate/route.test.ts
//
// Integration-style test: mocks fetch + all external I/O, exercises the full
// POST /api/study/generate route handler, and asserts:
//   1. The outbound Anthropic request uses the correct URL, model, and headers.
//   2. The combined stream terminates with a <!-- koinar-complete:…saveOk:true… --> frame.
//   3. generation_metadata.tools_called is non-empty (guards against silent
//      degradation if toolStreaming options ever stop delivering toolCalls to onFinish).

import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Module mocks — must be declared before the route import
// ---------------------------------------------------------------------------

vi.mock('@/lib/auth/middleware', () => ({
  requireAuth: vi.fn(),
}))

// Admin path gates on TOTP step-up before handing out the platform key.
// Tests that exercise the admin-happy-path mock this to true; tests that
// assert the gate fires mock it to false.
vi.mock('@/lib/auth/step-up', () => ({
  hasValidStepUpSession: vi.fn().mockReturnValue(true),
}))

vi.mock('@/lib/config', () => ({
  config: {
    ai: { anthropicApiKey: 'sk-ant-test-key', modelId: 'claude-opus-4-6' },
  },
}))

// Inline DB mock: prepare().get/run/all chain returns safe defaults
vi.mock('@/lib/db/connection', () => ({
  getDb: () => ({
    prepare: () => ({
      get: () => ({ api_key_encrypted: null }), // admin has no BYOK key
      run: () => ({ changes: 1 }),
      all: () => [],
    }),
  }),
}))

vi.mock('@/lib/db/queries', () => ({
  createStudy: vi.fn().mockReturnValue(42),
  getActiveGiftCodesForUser: vi.fn().mockReturnValue([]),
  consumeGiftCode: vi.fn(),
  setStudyTags: vi.fn(),
  getCategoryBySlug: vi.fn().mockReturnValue(null),
}))

vi.mock('@/lib/db/entities/queries', () => ({
  searchEntities: vi.fn().mockReturnValue([]),
  insertStudyAnnotations: vi.fn(),
}))

vi.mock('@/lib/rate-limit', () => ({
  createRateLimiter: () => () => false, // never rate-limits in tests
}))

vi.mock('@/lib/ai/system-prompt', () => ({
  getSystemPrompt: vi.fn().mockReturnValue('You are a Bible study assistant.'),
}))

// strip-annotations: pass text through unchanged, return no annotations
vi.mock('@/lib/entities/strip-annotations', () => ({
  stripEntityAnnotations: vi.fn((text: string) => ({
    cleanMarkdown: text,
    annotations: [],
  })),
}))

// Bible DB queries used by studyTools — return minimal valid data so the
// real query_verse tool executes successfully without a DB file
vi.mock('@/lib/db/bible/queries', () => ({
  getVerse: vi.fn().mockReturnValue(null),
  getVerseRange: vi.fn().mockReturnValue([]),
  getChapter: vi.fn().mockReturnValue([
    { book: 'Psalm', chapter: 1, verse: 1, text: 'Blessed is the man...' },
  ]),
  searchVerses: vi.fn().mockReturnValue([]),
  searchVersesFts: vi.fn().mockReturnValue([]),
  getHebrewWords: vi.fn().mockReturnValue([]),
  getGreekWords: vi.fn().mockReturnValue([]),
  getLxxVerse: vi.fn().mockReturnValue(null),
  lookupStrongs: vi.fn().mockReturnValue(null),
  searchStrongs: vi.fn().mockReturnValue([]),
  getCrossReferences: vi.fn().mockReturnValue([]),
}))

// ---------------------------------------------------------------------------
// Route + helpers imported AFTER mocks
// ---------------------------------------------------------------------------

import { POST } from '@/app/api/study/generate/route'
import { requireAuth } from '@/lib/auth/middleware'
import { hasValidStepUpSession } from '@/lib/auth/step-up'
import { createStudy } from '@/lib/db/queries'

// ---------------------------------------------------------------------------
// SSE helpers
// ---------------------------------------------------------------------------

function makeSSEResponse(events: string): Response {
  return new Response(new TextEncoder().encode(events), {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  })
}

function sse(chunks: unknown[]): string {
  // Arrow-wrap so Array.prototype.map's index argument doesn't collide with
  // JSON.stringify's replacer overload.
  return chunks.map((c) => JSON.stringify(c)).join('\n\n') + '\n\n'
}

/** First Anthropic response: one tool_use call (query_verse). */
const SSE_STEP1_TOOL_CALL = makeSSEBody([
  { event: 'message_start', data: { type: 'message_start', message: { id: 'msg_01', type: 'message', role: 'assistant', content: [], model: 'claude-opus-4-6', stop_reason: null, stop_sequence: null, usage: { input_tokens: 100, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 } } } },
  { event: 'content_block_start', data: { type: 'content_block_start', index: 0, content_block: { type: 'tool_use', id: 'toolu_01', name: 'query_verse', input: {} } } },
  { event: 'content_block_delta', data: { type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta', partial_json: '{"book":"Psalm","chapter":1}' } } },
  { event: 'content_block_stop', data: { type: 'content_block_stop', index: 0 } },
  { event: 'message_delta', data: { type: 'message_delta', delta: { stop_reason: 'tool_use', stop_sequence: null }, usage: { output_tokens: 15 } } },
  { event: 'message_stop', data: { type: 'message_stop' } },
])

/** Second Anthropic response: final text block, end_turn. */
const SSE_STEP2_TEXT_END = makeSSEBody([
  { event: 'message_start', data: { type: 'message_start', message: { id: 'msg_02', type: 'message', role: 'assistant', content: [], model: 'claude-opus-4-6', stop_reason: null, stop_sequence: null, usage: { input_tokens: 200, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 } } } },
  { event: 'content_block_start', data: { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } } },
  { event: 'content_block_delta', data: { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: '# Psalm 1 Study\n\nHello world.' } } },
  { event: 'content_block_stop', data: { type: 'content_block_stop', index: 0 } },
  { event: 'message_delta', data: { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 20 } } },
  { event: 'message_stop', data: { type: 'message_stop' } },
])

function makeSSEBody(events: { event: string; data: unknown }[]): string {
  return events
    .map(({ event, data }) => `event: ${event}\ndata: ${JSON.stringify(data)}`)
    .join('\n\n') + '\n\n'
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/study/generate', () => {
  type CapturedRequest = {
    url: string
    headers: Record<string, string>
    body: Record<string, unknown>
  }
  let capturedRequests: CapturedRequest[]

  beforeEach(() => {
    capturedRequests = []

    vi.mocked(requireAuth).mockResolvedValue({
      user: {
        userId: 1,
        username: 'admin',
        isAdmin: true,
        isApproved: true,
        onboardingCompleted: true,
      },
      response: null,
    })

    let callIndex = 0
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      const rawHeaders = init?.headers ?? {}
      const headers: Record<string, string> =
        rawHeaders instanceof Headers
          ? Object.fromEntries(rawHeaders.entries())
          : (rawHeaders as Record<string, string>)

      capturedRequests.push({
        url,
        headers,
        body: init?.body ? (JSON.parse(init.body as string) as Record<string, unknown>) : {},
      })

      return callIndex++ === 0
        ? makeSSEResponse(SSE_STEP1_TOOL_CALL)
        : makeSSEResponse(SSE_STEP2_TEXT_END)
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('sends the correct URL, model, and anthropic-version; stream terminates with koinar-complete; tools_called is populated', async () => {
    const req = new Request('http://localhost/api/study/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        prompt: 'Psalm 1 — the two paths: a short study',
        format: 'simple',
        translation: 'bsb',
      }),
    })

    const response = await POST(req)
    expect(response.status).toBe(200)

    // Drain the stream — onFinish fires after the text stream closes
    const text = await response.text()

    // --- 1. Anthropic request URL ---
    const anthropicCall = capturedRequests.find((r) => r.url.includes('api.anthropic.com'))
    expect(anthropicCall, 'Anthropic fetch was not called').toBeDefined()
    expect(anthropicCall!.url).toBe('https://api.anthropic.com/v1/messages')

    // --- 2. Model ID in body ---
    expect(anthropicCall!.body.model).toBe('claude-opus-4-6')

    // --- 3. Required headers ---
    expect(anthropicCall!.headers['anthropic-version']).toBe('2023-06-01')
    // anthropic-beta must be a string (guard: SDK should not omit it or send an array)
    const betaHeader = anthropicCall!.headers['anthropic-beta']
    if (betaHeader !== undefined) {
      expect(typeof betaHeader).toBe('string')
    }

    // --- 4. Stream terminates with koinar-complete ---
    expect(text).toContain('<!-- koinar-complete:')
    const frameMatch = text.match(/<!-- koinar-complete:(\{.*?\}) -->/)
    expect(frameMatch, 'koinar-complete frame not found in stream').not.toBeNull()
    const frame = JSON.parse(frameMatch![1]) as { saveOk: boolean; slug: string; title: string }
    expect(frame.saveOk).toBe(true)
    expect(typeof frame.slug).toBe('string')
    expect(frame.slug.length).toBeGreaterThan(0)

    // --- 5. tools_called is populated (guards toolStreaming → onFinish.steps integrity) ---
    expect(vi.mocked(createStudy).mock.calls.length).toBeGreaterThan(0)
    const savedStudy = vi.mocked(createStudy).mock.calls[0][0]
    const genMeta = JSON.parse(savedStudy.generation_metadata!) as {
      tools_called: string[]
      model: string
    }
    expect(genMeta.tools_called.length).toBeGreaterThan(0)
    expect(genMeta.tools_called).toContain('query_verse')
    expect(genMeta.model).toBe('claude-opus-4-6')
  })
})

// ---------------------------------------------------------------------------
// Step-up gate (admin-only branch)
// ---------------------------------------------------------------------------

describe('POST /api/study/generate — admin step-up gate', () => {
  beforeEach(() => {
    vi.mocked(requireAuth).mockResolvedValue({
      user: {
        userId: 1,
        username: 'admin',
        isAdmin: true,
        isApproved: true,
        onboardingCompleted: true,
      },
      response: null,
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
    // Leave the default step-up mock in a truthy state for any tests that
    // follow so they aren't coupled to this suite's order-of-execution.
    vi.mocked(hasValidStepUpSession).mockReturnValue(true)
  })

  it('returns 403 with STEP_UP_REQUIRED when admin has no step-up session', async () => {
    vi.mocked(hasValidStepUpSession).mockReturnValue(false)

    const req = new Request('http://localhost/api/study/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        prompt: 'Psalm 1 — the two paths: a short study',
        format: 'simple',
        translation: 'bsb',
      }),
    })

    const response = await POST(req)
    expect(response.status).toBe(403)
    const json = (await response.json()) as { error: string; code: string }
    expect(json.code).toBe('STEP_UP_REQUIRED')
  })

  it('does not hand out the platform key when the gate fires', async () => {
    vi.mocked(hasValidStepUpSession).mockReturnValue(false)

    let fetchCalled = false
    vi.stubGlobal('fetch', async () => {
      fetchCalled = true
      return new Response('', { status: 200 })
    })

    const req = new Request('http://localhost/api/study/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        prompt: 'Psalm 1 — the two paths: a short study',
        format: 'simple',
        translation: 'bsb',
      }),
    })

    await POST(req)
    expect(fetchCalled).toBe(false)
  })

  it('checks step-up ONLY for admins — non-admin path is unaffected', async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      user: {
        userId: 2,
        username: 'user',
        isAdmin: false,
        isApproved: true,
        onboardingCompleted: true,
      },
      response: null,
    })
    vi.mocked(hasValidStepUpSession).mockReturnValue(false)

    const req = new Request('http://localhost/api/study/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        prompt: 'Psalm 1 — the two paths: a short study',
        format: 'simple',
        translation: 'bsb',
      }),
    })

    const response = await POST(req)
    // Non-admin without a gift code hits the 403 "Generation not available"
    // branch — NOT the step-up branch. Assert the error body distinguishes
    // the two: no STEP_UP_REQUIRED code for regular users.
    expect(response.status).toBe(403)
    const json = (await response.json()) as { error?: string; code?: string }
    expect(json.code).toBeUndefined()
    expect(json.error).toContain('Generation not available')
  })
})
