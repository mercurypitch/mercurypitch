// ============================================================
// Vocal Analysis E2E Tests
// ============================================================

import { expect, test } from '@playwright/test'
import { dismissOverlays } from '@/e2e/helpers/ui'

test.describe('Vocal Analysis Tab', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      ;(window as any).E2E_TEST_MODE = true
    })
    await page.goto('/')
    await page.waitForSelector('#app-tabs', { timeout: 10000 })
    await dismissOverlays(page)
  })

  // ── Tab Navigation ─────────────────────────────────────────

  test('navigates to Vocal Analysis tab', async ({ page }) => {
    const analysisTab = page.locator('#tab-analysis')
    await analysisTab.click()
    await page.waitForTimeout(500)

    // Should see the header
    await expect(page.locator('.vocal-header h2')).toContainText(
      'Vocal Analysis',
    )
  })

  // ── Demo Data Hint ──────────────────────────────────────────

  test('shows demo data hint when no sessions exist', async ({ page }) => {
    await page.goto('/?tab=analysis')
    await page.waitForTimeout(500)

    // Demo hint should appear
    const demoHint = page.locator('.demo-hint')
    await expect(demoHint).toBeVisible({ timeout: 3000 })
    await expect(demoHint).toContainText('No practice sessions yet')
  })

  test('"Load Demo Data" injects sessions and hides hint', async ({ page }) => {
    await page.goto('/?tab=analysis')
    await page.waitForTimeout(500)

    // Click Load Demo Data
    const loadBtn = page.locator('.demo-load-btn')
    await expect(loadBtn).toBeVisible({ timeout: 3000 })
    await loadBtn.click()
    await page.waitForTimeout(300)

    // Demo hint should disappear
    await expect(page.locator('.demo-hint')).not.toBeVisible()

    // Session list should have items
    const sessionItems = page.locator('.session-item')
    await expect(sessionItems.first()).toBeVisible({ timeout: 3000 })
    const count = await sessionItems.count()
    expect(count).toBeGreaterThan(0)
  })

  // ── Mode Toggle ─────────────────────────────────────────────

  test('mode toggle switches between history and live mic', async ({
    page,
  }) => {
    await page.goto('/?tab=analysis')
    await page.waitForTimeout(500)

    const modeToggle = page.locator('.mode-toggle')
    await expect(modeToggle).toBeVisible()

    // History should be active by default
    const historyBtn = modeToggle.locator('button').first()
    await expect(historyBtn).toHaveClass(/active/)

    // Click Live Mic
    const liveBtn = modeToggle.locator('button').last()
    await liveBtn.click()
    await page.waitForTimeout(300)

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
    // First load demo data so results show
    await page.goto('/?tab=analysis')
    await page.waitForTimeout(500)

    // Load demo data
    const loadBtn = page.locator('.demo-load-btn')
    await loadBtn.click()
    await page.waitForTimeout(300)

    // Click "Start Vocal Analysis"
    const startBtn = page.locator('.analyze-btn')
    await startBtn.click()
    await page.waitForTimeout(500)

    // Click each technique card
    const techniqueCards = page.locator('.technique-card')
    const cardCount = await techniqueCards.count()
    expect(cardCount).toBeGreaterThanOrEqual(4)

    // Click the first card (Belting)
    await techniqueCards.first().click()
    await page.waitForTimeout(200)

    // Should show exercise feedback bar
    const exerciseResult = page.locator('.exercise-feedback')
    await expect(exerciseResult).toBeVisible()

    // Feedback bar should be visible
    await expect(page.locator('.exercise-feedback')).toBeVisible()
  })

  // ── Live Mic Mode Button (no actual mic in e2e) ────────────

  test('live mic start button is present and clickable', async ({ page }) => {
    await page.goto('/?tab=analysis')
    await page.waitForTimeout(500)

    // Switch to live mic mode
    const liveBtn = page.locator('.mode-toggle-btn').last()
    await liveBtn.click()
    await page.waitForTimeout(300)

    // Live start button should be visible
    const startLiveBtn = page.locator('.analyze-btn.live-start')
    await expect(startLiveBtn).toBeVisible()

    // Clicking it should attempt to start mic (may fail in test env)
    // But the button should handle the error gracefully
    await startLiveBtn.click()
    await page.waitForTimeout(1000)

    // Either the live error appears (no mic permission in headless) or
    // the UI remains functional — just verify the page didn't crash
    const errorShown = await page.locator('.live-error').isVisible()
    const headerVisible = await page.locator('.vocal-header').isVisible()
    expect(errorShown || headerVisible).toBe(true)
  })

  // ── Streak Card ─────────────────────────────────────────────

  test('streak card shows after loading demo data', async ({ page }) => {
    await page.goto('/?tab=analysis')
    await page.waitForTimeout(500)

    // Load demo data
    const loadBtn = page.locator('.demo-load-btn')
    await loadBtn.click()
    await page.waitForTimeout(300)

    // Streak card should show numbers
    const streakCard = page.locator('.streak-card')
    await expect(streakCard).toBeVisible()

    const streakNumbers = streakCard.locator('.streak-number')
    expect(await streakNumbers.count()).toBe(2)
  })

  // ── Weekly Chart ────────────────────────────────────────────

  test('weekly chart renders bars after demo data', async ({ page }) => {
    await page.goto('/?tab=analysis')
    await page.waitForTimeout(500)

    const loadBtn = page.locator('.demo-load-btn')
    await loadBtn.click()
    await page.waitForTimeout(300)

    const chartBars = page.locator('.chart-bar')
    expect(await chartBars.count()).toBeGreaterThan(0)
  })

  // ── Recent Sessions List ────────────────────────────────────

  test('recent sessions list shows session names after demo data', async ({
    page,
  }) => {
    await page.goto('/?tab=analysis')
    await page.waitForTimeout(500)

    const loadBtn = page.locator('.demo-load-btn')
    await loadBtn.click()
    await page.waitForTimeout(300)

    const sessionItems = page.locator('.session-item')
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
    await page.goto('/?tab=analysis')
    await page.waitForTimeout(500)

    const spectrogram = page.locator('.spectrogram-display')
    await expect(spectrogram).toBeVisible()

    const container = spectrogram.locator('.spectrogram-container')
    await expect(container).toBeVisible()
  })

  // ── Pitch History ───────────────────────────────────────────

  test('pitch history section is present', async ({ page }) => {
    await page.goto('/?tab=analysis')
    await page.waitForTimeout(500)

    const pitchHistory = page.locator('.pitch-history h3')
    await expect(pitchHistory).toContainText('Pitch History')
  })

  // ── Round-trip: Load Demo → Analyze → Check Techniques ─────

  test('full round-trip: load demo, analyze, check techniques', async ({
    page,
  }) => {
    await page.goto('/?tab=analysis')
    await page.waitForTimeout(500)

    // 1. Load demo data
    await page.locator('.demo-load-btn').click()
    await page.waitForTimeout(300)

    // 2. Start analysis
    await page.locator('.analyze-btn').click()
    await page.waitForTimeout(500)

    // 3. Click each technique to verify results render
    const cards = page.locator('.technique-card')
    const count = await cards.count()

    for (let i = 0; i < Math.min(count, 4); i++) {
      await cards.nth(i).click()
      await page.waitForTimeout(200)

      // Should show exercise feedback bar
      await expect(page.locator('.exercise-feedback')).toBeVisible()

      // Should show feedback text
      const feedback = page.locator('.exercise-feedback')
      await expect(feedback).toBeVisible()
    }
  })
})
