// app/lib/config.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('config.ai.modelId', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('equals env.AI_MODEL_ID when the var is set', async () => {
    vi.stubEnv('AI_MODEL_ID', 'claude-sonnet-4-6')
    const { env } = await import('@/lib/env')
    const { config } = await import('@/lib/config')
    expect(config.ai.modelId).toBe(env.AI_MODEL_ID)
    expect(config.ai.modelId).toBe('claude-sonnet-4-6')
  })

  it('falls back to "claude-opus-4-6" when AI_MODEL_ID is absent from the environment', async () => {
    const prev = process.env.AI_MODEL_ID
    delete process.env.AI_MODEL_ID
    try {
      const { config } = await import('@/lib/config')
      expect(config.ai.modelId).toBe('claude-opus-4-6')
    } finally {
      if (prev !== undefined) process.env.AI_MODEL_ID = prev
    }
  })
})
