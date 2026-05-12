// ============================================================
// Metronome E2E Tests
// Tests BPM control and playback speed on practice tab
// Note: MetronomeButton component exists but is not yet wired to the UI
// ============================================================

import { expect, test } from '@playwright/test'
import { dismissOverlays } from './helpers/ui'

test.describe('Metronome', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      ;(window as any).E2E_TEST_MODE = true
    })
    await page.goto('/')
    await page.waitForSelector('#app-tabs', { timeout: 10000 })
    await dismissOverlays(page)
    await page.locator('#tab-singing').click()
    await page.waitForTimeout(500)
  })

  test('BPM input is visible on practice tab', async ({ page }) => {
    await expect(page.locator('#bpm-input')).toBeVisible()
  })

  test('BPM input accepts values', async ({ page }) => {
    const bpmInput = page.locator('#bpm-input')
    await bpmInput.fill('140')
    await expect(bpmInput).toHaveValue('140')
  })

  test('BPM slider is visible on practice tab', async ({ page }) => {
    await expect(page.locator('#tempo')).toBeVisible()
  })

  test('Play button is visible on practice tab', async ({ page }) => {
    await expect(page.locator('.play-btn').first()).toBeVisible()
  })

  test('Practice mode buttons exist', async ({ page }) => {
    await expect(page.locator('#btn-once')).toBeVisible()
    await expect(page.locator('#btn-repeat')).toBeVisible()
    await expect(page.locator('#btn-session')).toBeVisible()
  })
})
