import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

// Requires authenticated session.
// Set TEST_SESSION_COOKIE env var or configure storageState before running.

test('bench dashboard has 0 axe violations', async ({ page }) => {
  await page.goto('/bench')
  const results = await new AxeBuilder({ page }).analyze()
  expect(results.violations).toHaveLength(0)
})

test('bench board has 0 axe violations', async ({ page }) => {
  const boardId = process.env.TEST_BENCH_BOARD_ID
  if (!boardId) {
    test.skip(true, 'TEST_BENCH_BOARD_ID not set')
    return
  }
  await page.goto(`/bench/${boardId}`)
  const results = await new AxeBuilder({ page }).analyze()
  expect(results.violations).toHaveLength(0)
})
