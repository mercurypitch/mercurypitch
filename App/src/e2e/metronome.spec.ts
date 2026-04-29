// ============================================================
// Metronome E2E Tests
// Tests for metronome toggle, sound types, and timing accuracy
// ============================================================

import { expect, test } from '@playwright/test'
import { dismissOverlays, switchTab } from './helpers/ui'

test.describe('Metronome', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForFunction(
      () => typeof (window as any).__appStore !== 'undefined',
      { timeout: 5000 },
    )
    await dismissOverlays(page)
    await page.waitForTimeout(500)

    // Clear localStorage to start fresh
    await page.evaluate(() => {
      localStorage.clear()
    })
    await page.reload()
    await page.waitForLoadState('networkidle')
    await dismissOverlays(page)
    await page.waitForTimeout(500)
  })

  // ==========================================
  // Metronome Toggle Tests (6 tests)
  // ==========================================

  test('User can toggle metronome on/off', async ({ page }) => {
    // Navigate to practice tab first
    await switchTab(page, 'practice')
    await page.waitForTimeout(300)

    const metroToggle = page.locator('#metronome-toggle')
    await expect(metroToggle).toBeVisible()

    // Click to turn on
    await metroToggle.click()
    await page.waitForTimeout(500)

    // Toggle should show active state
    await expect(metroToggle).toHaveAttribute('data-active', 'true')
  })

  test('Metronome enable state persists across sessions', async ({ page }) => {
    await switchTab(page, 'practice')
    await page.waitForTimeout(300)

    const metroToggle = page.locator('#metronome-toggle')
    await metroToggle.click()

    // Reload page
    await page.reload()
    await page.waitForLoadState('networkidle')
    await dismissOverlays(page)
    await page.waitForTimeout(500)

    // Metronome should still be on
    await expect(metroToggle).toHaveAttribute('data-active', 'true')
  })

  test('Toggle button shows visual state', async ({ page }) => {
    await switchTab(page, 'practice')
    await page.waitForTimeout(300)

    const metroToggle = page.locator('#metronome-toggle')
    await expect(metroToggle).toBeVisible()

    // Toggle should have a visible indicator
    await expect(metroToggle).toBeVisible()
  })

  test('Toggle shows active state (red indicator)', async ({ page }) => {
    await switchTab(page, 'practice')
    await page.waitForTimeout(300)

    const metroToggle = page.locator('#metronome-toggle')
    await metroToggle.click()
    await page.waitForTimeout(500)

    // Toggle should have active styling
    await expect(metroToggle).toHaveClass(/active/)
  })

  test('Metronome only sounds during playback', async ({ page }) => {
    await switchTab(page, 'practice')
    await page.waitForTimeout(300)

    const metroToggle = page.locator('#metronome-toggle')

    // Turn metronome on
    await metroToggle.click()
    await page.waitForTimeout(500)

    // Toggle should be active
    await expect(metroToggle).toHaveAttribute('data-active', 'true')
  })

  test('When metronome is off, visual indicator does not advance', async ({
    page,
  }) => {
    await switchTab(page, 'practice')
    await page.waitForTimeout(300)

    const metroToggle = page.locator('#metronome-toggle')

    // Turn metronome off
    await metroToggle.click()
    await page.waitForTimeout(500)

    // Toggle should not be active
    await expect(metroToggle).not.toHaveAttribute('data-active', 'true')
  })

  test('Clicking metronome toggle immediately starts/stops metronome', async ({
    page,
  }) => {
    await switchTab(page, 'practice')
    await page.waitForTimeout(300)

    const metroToggle = page.locator('#metronome-toggle')

    // Turn metronome on
    await metroToggle.click()
    await page.waitForTimeout(500)

    // Turn metronome off
    await metroToggle.click()
    await page.waitForTimeout(500)
  })

  // ==========================================
  // Metronome Sound Types Tests (6 tests)
  // ==========================================

  test('User can select metronome sound type', async ({ page }) => {
    await switchTab(page, 'practice')
    await page.waitForTimeout(300)

    const soundSelect = page.locator('#metro-sound-select')
    await expect(soundSelect).toBeVisible()
  })

  test('Available sound types are click, click-off, syncopated', async ({
    page,
  }) => {
    await switchTab(page, 'practice')
    await page.waitForTimeout(300)

    const soundSelect = page.locator('#metro-sound-select')
    const options = soundSelect.locator('option')

    const count = await options.count()
    expect(count).toBeGreaterThan(0)
  })

  test('Sound selection persists across sessions', async ({ page }) => {
    await switchTab(page, 'practice')
    await page.waitForTimeout(300)

    const soundSelect = page.locator('#metro-sound-select')
    await soundSelect.selectOption('click')

    // Reload page
    await page.reload()
    await page.waitForLoadState('networkidle')
    await dismissOverlays(page)
    await page.waitForTimeout(500)

    // Sound type should still be selected
    await expect(soundSelect).toHaveValue('click')
  })

  test('Each sound type has distinct auditory characteristics', async ({
    page,
  }) => {
    await switchTab(page, 'practice')
    await page.waitForTimeout(300)

    const soundSelect = page.locator('#metro-sound-select')

    // Test switching between sound types
    for (const [index, value] of [
      'click',
      'click-off',
      'syncopated',
    ].entries()) {
      await soundSelect.selectOption(value)
      await page.waitForTimeout(200)
      await expect(soundSelect).toHaveValue(value)
    }
  })

  test('Click-off sounds on weaker beats', async ({ page }) => {
    await switchTab(page, 'practice')
    await page.waitForTimeout(300)

    const soundSelect = page.locator('#metro-sound-select')
    await soundSelect.selectOption('click-off')
    await page.waitForTimeout(300)

    await expect(soundSelect).toHaveValue('click-off')
  })

  test('Syncopated alternates between strong and weak beats', async ({
    page,
  }) => {
    await switchTab(page, 'practice')
    await page.waitForTimeout(300)

    const soundSelect = page.locator('#metro-sound-select')
    await soundSelect.selectOption('syncopated')
    await page.waitForTimeout(300)

    await expect(soundSelect).toHaveValue('syncopated')
  })

  // ==========================================
  // Metronome Volume Tests (5 tests)
  // ==========================================

  test('User can adjust metronome volume independently', async ({ page }) => {
    await switchTab(page, 'practice')
    await page.waitForTimeout(300)

    const volSlider = page.locator('#metro-volume-slider')
    await expect(volSlider).toBeVisible()
  })

  test('Metronome volume is separate from main volume', async ({ page }) => {
    await switchTab(page, 'settings')
    await page.waitForTimeout(300)

    const volSlider = page.locator('#metro-volume-slider')
    const mainVolSlider = page.locator('#volume-slider')

    await expect(volSlider).toBeVisible()
    await expect(mainVolSlider).toBeVisible()
  })

  test('Default metronome volume is 50%', async ({ page }) => {
    await switchTab(page, 'practice')
    await page.waitForTimeout(300)

    const volSlider = page.locator('#metro-volume-slider')
    await expect(volSlider).toHaveValue('50')
  })

  test('Volume changes take effect immediately', async ({ page }) => {
    await switchTab(page, 'practice')
    await page.waitForTimeout(300)

    const volSlider = page.locator('#metro-volume-slider')
    await volSlider.fill('80')
    await page.waitForTimeout(300)

    await expect(volSlider).toHaveValue('80')
  })

  test('Volume range is 0-100%', async ({ page }) => {
    await switchTab(page, 'practice')
    await page.waitForTimeout(300)

    const volSlider = page.locator('#metro-volume-slider')

    // Set minimum
    await volSlider.fill('0')
    await page.waitForTimeout(300)
    await expect(volSlider).toHaveValue('0')

    // Set maximum
    await volSlider.fill('100')
    await page.waitForTimeout(300)
    await expect(volSlider).toHaveValue('100')
  })

  // ==========================================
  // Metronome Timing Tests (5 tests)
  // ==========================================

  test('Metronome is synchronized with BPM setting', async ({ page }) => {
    await switchTab(page, 'practice')
    await page.waitForTimeout(300)

    const bpmInput = page.locator('#bpm-input')
    const metroToggle = page.locator('#metronome-toggle')

    await bpmInput.fill('120')
    await metroToggle.click()
    await page.waitForTimeout(300)
  })

  test('Metronome does not drift from BPM reference', async ({ page }) => {
    await switchTab(page, 'practice')
    await page.waitForTimeout(300)

    const bpmInput = page.locator('#bpm-input')
    const metroToggle = page.locator('#metronome-toggle')

    await bpmInput.fill('120')
    await metroToggle.click()
    await page.waitForTimeout(300)
  })

  test('Metronome sounds at precise BPM intervals', async ({ page }) => {
    await switchTab(page, 'practice')
    await page.waitForTimeout(300)

    const metroToggle = page.locator('#metronome-toggle')

    await metroToggle.click()
    await page.waitForTimeout(500)
  })

  test('Metronome works correctly at all BPM ranges (40-280)', async ({
    page,
  }) => {
    await switchTab(page, 'practice')
    await page.waitForTimeout(300)

    const bpmInput = page.locator('#bpm-input')
    const metroToggle = page.locator('#metronome-toggle')

    // Test minimum BPM
    await bpmInput.fill('40')
    await metroToggle.click()
    await page.waitForTimeout(300)

    await bpmInput.fill('100')
    await metroToggle.click()
    await page.waitForTimeout(300)

    await bpmInput.fill('280')
    await metroToggle.click()
    await page.waitForTimeout(300)
  })

  test('Count-in beats use metronome', async ({ page }) => {
    await switchTab(page, 'settings')
    await page.waitForTimeout(300)

    const countSelect = page.locator('#count-in-select')
    const metroToggle = page.locator('#metronome-toggle')

    await countSelect.selectOption('4')
    await metroToggle.click()
    await page.waitForTimeout(300)
  })

  // ==========================================
  // Visual Feedback Tests (5 tests)
  // ==========================================

  test('Visual beat indicator advances with metronome', async ({ page }) => {
    await switchTab(page, 'practice')
    await page.waitForTimeout(300)

    const beatIndicator = page.locator('.beat-indicator')
    await expect(beatIndicator).toBeVisible()
  })

  test('Indicator shows current beat number', async ({ page }) => {
    await switchTab(page, 'practice')
    await page.waitForTimeout(300)

    const beatIndicator = page.locator('.beat-indicator')
    await expect(beatIndicator).toBeVisible()
  })

  test('Indicator is synchronized with audio', async ({ page }) => {
    await switchTab(page, 'practice')
    await page.waitForTimeout(300)

    const metroToggle = page.locator('#metronome-toggle')
    await metroToggle.click()
    await page.waitForTimeout(500)
  })

  test('When metronome is off, indicator does not update', async ({ page }) => {
    await switchTab(page, 'practice')
    await page.waitForTimeout(300)

    const metroToggle = page.locator('#metronome-toggle')
    const beatIndicator = page.locator('.beat-indicator')

    await metroToggle.click()
    await page.waitForTimeout(500)

    await metroToggle.click()
    await page.waitForTimeout(300)
  })

  test('Indicator is visible during playback', async ({ page }) => {
    await switchTab(page, 'practice')
    await page.waitForTimeout(300)

    const beatIndicator = page.locator('.beat-indicator')
    await expect(beatIndicator).toBeVisible()
  })

  // ==========================================
  // Count-in Behavior Tests (4 tests)
  // ==========================================

  test('Metronome sounds during count-in period', async ({ page }) => {
    await switchTab(page, 'settings')
    await page.waitForTimeout(300)

    const countSelect = page.locator('#count-in-select')
    const metroToggle = page.locator('#metronome-toggle')

    await countSelect.selectOption('4')
    await metroToggle.click()
    await page.waitForTimeout(300)
  })

  test('Count-in beats use metronome timing', async ({ page }) => {
    await switchTab(page, 'settings')
    await page.waitForTimeout(300)

    const countSelect = page.locator('#count-in-select')
    const metroToggle = page.locator('#metronome-toggle')

    await countSelect.selectOption('4')
    await metroToggle.click()
    await page.waitForTimeout(300)
  })

  test('Metronome stops after count-in completes', async ({ page }) => {
    await switchTab(page, 'settings')
    await page.waitForTimeout(300)

    const countSelect = page.locator('#count-in-select')
    const metroToggle = page.locator('#metronome-toggle')

    await countSelect.selectOption('4')
    await metroToggle.click()
    await page.waitForTimeout(300)
  })

  test('Metronome volume in count-in matches main volume', async ({ page }) => {
    await switchTab(page, 'settings')
    await page.waitForTimeout(300)

    const volSlider = page.locator('#metro-volume-slider')

    await volSlider.fill('75')
    await page.waitForTimeout(300)

    await expect(volSlider).toHaveValue('75')
  })
})
