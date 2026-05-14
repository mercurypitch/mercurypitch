// ============================================================
// Vocal Analysis E2E Tests
// ============================================================

import { expect, test } from '@playwright/test'
import { dismissOverlays, switchTab } from '@/e2e/helpers/ui'

test.describe('Vocal Analysis Tab', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      ;(window as any).E2E_TEST_MODE = true
    })
    await page.goto('/')
    await page.waitForSelector('#app-tabs', { timeout: 10000 })
    await dismissOverlays(page)

    // Enable advanced features so the Analysis tab is visible
    await page.evaluate(() => {
      const pp = (window as any).__pp
      if (pp?.appStore?.setAdvancedFeaturesEnabled) {
        pp.appStore.setAdvancedFeaturesEnabled(true)
      }
    })
  })

  // ── Tab Navigation ─────────────────────────────────────────

  test('navigates to Vocal Analysis tab', async ({ page }) => {
    await switchTab(page, 'analysis')

    // Should see the header
    await expect(page.locator('.vocal-header h2')).toContainText(
      'Vocal Analysis',
    )
  })

  // ── Demo Data Hint ──────────────────────────────────────────

  test('shows demo data hint when no sessions exist', async ({ page }) => {
    await switchTab(page, 'analysis')

    // Demo hint should appear
    const demoHint = page.locator('.demo-hint')
    await expect(demoHint).toBeVisible({ timeout: 5000 })
    await expect(demoHint).toContainText('No practice sessions yet')
  })

  test('"Load Demo Data" injects sessions and hides hint', async ({ page }) => {
    await switchTab(page, 'analysis')

    // Click Load Demo Data
    const loadBtn = page.locator('.demo-load-btn')
    await expect(loadBtn).toBeVisible({ timeout: 5000 })
    await loadBtn.click()
    await page.waitForTimeout(500)

    // Demo hint should disappear
    await expect(page.locator('.demo-hint')).not.toBeVisible()

    // Session list should have items
    const sessionItems = page.locator('.session-item')
    await expect(sessionItems.first()).toBeVisible({ timeout: 5000 })
    const count = await sessionItems.count()
    expect(count).toBeGreaterThan(0)
  })

  // ── Mode Toggle ─────────────────────────────────────────────

  test('mode toggle switches between history and live mic', async ({
    page,
  }) => {
    await switchTab(page, 'analysis')

    const modeToggle = page.locator('.mode-toggle')
    await expect(modeToggle).toBeVisible({ timeout: 5000 })

    // History should be active by default
    const historyBtn = modeToggle.locator('button').first()
    await expect(historyBtn).toHaveClass(/active/)

    // Click Live Mic
    const liveBtn = modeToggle.locator('button').last()
    await liveBtn.click()
    await page.waitForTimeout(500)

    // Live Mic button should now be active
    await expect(liveBtn).toHaveClass(/active/)

    // Should show "Start Live Analysis" button
    await expect(page.locator('.analyze-btn.live-start')).toBeVisible()

    // Switch back to History
    await historyBtn.click()
    await page.waitForTimeout(300)

    // Should show "Start Vocal Analysis" button
    await expect(page.locator('.analyze-btn')).toBeVisible()
  })

  // ── Vocal Techniques Grid ──────────────────────────────────

  test('tapping exercise cards activates them', async ({ page }) => {
    await switchTab(page, 'analysis')

    // Load demo data
    const loadBtn = page.locator('.demo-load-btn')
    await loadBtn.click()
    await page.waitForTimeout(500)

    // Click "Start Vocal Analysis"
    const startBtn = page.locator('.analyze-btn')
    await startBtn.click()
    await page.waitForTimeout(1000)

    // Click each technique card
    const techniqueCards = page.locator('.technique-card')
    const cardCount = await techniqueCards.count()
    expect(cardCount).toBeGreaterThanOrEqual(4)

    // Click the first card (Belting)
    await techniqueCards.first().click()
    await page.waitForTimeout(300)

    // Should show exercise feedback bar
    const exerciseResult = page.locator('.exercise-feedback')
    await expect(exerciseResult).toBeVisible({ timeout: 5000 })
  })

  // ── Live Mic Mode Button (no actual mic in e2e) ────────────

  test('live mic start button is present and clickable', async ({ page }) => {
    await switchTab(page, 'analysis')

    // Switch to live mic mode
    const liveBtn = page.locator('.mode-toggle-btn').last()
    await liveBtn.click()
    await page.waitForTimeout(300)

    // Live start button should be visible
    const startLiveBtn = page.locator('.analyze-btn.live-start')
    await expect(startLiveBtn).toBeVisible()

    // Clicking it should attempt to start mic (may fail in test env)
    await startLiveBtn.click()
    await page.waitForTimeout(1000)

    // Either the live error appears (no mic permission in headless) or
    // the UI remains functional
    const errorShown = await page.locator('.live-error').isVisible()
    const headerVisible = await page.locator('.vocal-header').isVisible()
    expect(errorShown || headerVisible).toBe(true)
  })

  // ── Streak Card ─────────────────────────────────────────────

  test('streak card shows after loading demo data', async ({ page }) => {
    await switchTab(page, 'analysis')

    // Load demo data
    const loadBtn = page.locator('.demo-load-btn')
    await loadBtn.click()
    await page.waitForTimeout(500)

    // Streak card should show numbers
    const streakCard = page.locator('.streak-card')
    await expect(streakCard).toBeVisible({ timeout: 5000 })

    const streakNumbers = streakCard.locator('.streak-number')
    expect(await streakNumbers.count()).toBe(2)
  })

  // ── Weekly Chart ────────────────────────────────────────────

  test('weekly chart renders bars after demo data', async ({ page }) => {
    await switchTab(page, 'analysis')

    const loadBtn = page.locator('.demo-load-btn')
    await loadBtn.click()
    await page.waitForTimeout(500)

    const chartBars = page.locator('.chart-bar')
    await expect(chartBars.first()).toBeVisible({ timeout: 5000 })
    expect(await chartBars.count()).toBeGreaterThan(0)
  })

  // ── Recent Sessions List ────────────────────────────────────

  test('recent sessions list shows session names after demo data', async ({
    page,
  }) => {
    await switchTab(page, 'analysis')

    const loadBtn = page.locator('.demo-load-btn')
    await loadBtn.click()
    await page.waitForTimeout(500)

    const sessionItems = page.locator('.session-item')
    await expect(sessionItems.first()).toBeVisible({ timeout: 5000 })
    // Should have 5 mock sessions
    expect(await sessionItems.count()).toBe(5)

    // Each should have a session name
    const firstName = await sessionItems
      .first()
      .locator('.session-name')
      .textContent()
    expect(firstName).toBeTruthy()
  })

  // ── Spectrogram ─────────────────────────────────────────────

  test('spectrogram display is visible', async ({ page }) => {
    await switchTab(page, 'analysis')

    const spectrogram = page.locator('.spectrogram-display')
    await expect(spectrogram).toBeVisible({ timeout: 5000 })

    const container = spectrogram.locator('.spectrogram-container')
    await expect(container).toBeVisible()
  })

  // ── Pitch History ───────────────────────────────────────────

  test('pitch history section is present', async ({ page }) => {
    await switchTab(page, 'analysis')

    const pitchHistory = page.locator('.pitch-history h3')
    await expect(pitchHistory).toContainText('Pitch History', { timeout: 5000 })
  })

  // ── Round-trip: Load Demo → Analyze → Check Techniques ─────

  test('full round-trip: load demo, analyze, check techniques', async ({
    page,
  }) => {
    await switchTab(page, 'analysis')

    // 1. Load demo data
    await page.locator('.demo-load-btn').click()
    await page.waitForTimeout(500)

    // 2. Start analysis
    await page.locator('.analyze-btn').click()
    await page.waitForTimeout(1000)

    // 3. Click each technique to verify results render
    const cards = page.locator('.technique-card')
    const count = await cards.count()

    for (let i = 0; i < Math.min(count, 4); i++) {
      await cards.nth(i).click()
      await page.waitForTimeout(300)

      // Should show exercise feedback bar
      await expect(page.locator('.exercise-feedback')).toBeVisible({
        timeout: 5000,
      })
    }
  })
})
