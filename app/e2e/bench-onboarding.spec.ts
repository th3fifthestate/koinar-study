import { test, expect } from '@playwright/test'

test('walkthrough shows on first visit; dismiss; reload hides it', async ({ page }) => {
  await page.goto('/bench')
  await expect(page.getByText('Your research canvas')).toBeVisible()
  await page.getByRole('button', { name: "Let's start" }).click()
  await expect(page.getByText('Your research canvas')).not.toBeVisible()
  await page.reload()
  await expect(page.getByText('Your research canvas')).not.toBeVisible()
})

test('? opens cheat sheet; Escape closes it', async ({ page }) => {
  const boardId = process.env.TEST_BENCH_BOARD_ID
  if (!boardId) {
    test.skip(true, 'TEST_BENCH_BOARD_ID not set')
    return
  }
  await page.goto(`/bench/${boardId}`)
  await page.keyboard.press('?')
  await expect(page.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Keyboard shortcuts' })).not.toBeVisible()
})

test('mobile viewport shows read-only banner', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/bench')
  await expect(page.getByRole('status')).toContainText('view-only on mobile')
})
