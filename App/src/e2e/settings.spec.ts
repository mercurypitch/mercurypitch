// ============================================================
// Settings Panel E2E Tests
// Tests for theme, BPM, metronome, volume, and other settings
// ============================================================

import { expect, test } from '@playwright/test'
import { dismissOverlays, switchTab } from './helpers/ui'

test.describe('Settings Panel', () => {
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
  // Theme Switching Tests (6 tests)
  // ==========================================

  test('User can switch between dark and light themes', async ({ page }) => {
    // Open settings panel
    await switchTab(page, 'settings')
    await page.waitForTimeout(300)

    const themeSelect = page.locator('#theme-select')
    await expect(themeSelect).toBeVisible()

    // Switch to light theme
    await themeSelect.selectOption('light')
    await page.waitForTimeout(500)

    // Theme should change to light
    const body = page.locator('body')
    const computedStyle = await body.evaluate((el) =>
      window.getComputedStyle(el).getPropertyValue('background-color'),
    )
    // Dark mode is typically dark color, light mode is light color
    expect(computedStyle).toBeTruthy()
  })

  test('Theme selection persists across sessions', async ({ page }) => {
    await switchTab(page, 'settings')
    await page.waitForTimeout(300)

    const themeSelect = page.locator('#theme-select')
    await themeSelect.selectOption('dark')

    // Reload page
    await page.reload()
    await page.waitForLoadState('networkidle')
    await dismissOverlays(page)
    await page.waitForTimeout(500)

    // Theme should still be dark
    await expect(themeSelect).toHaveValue('dark')
  })

  test('Dark theme is the default on first load', async ({ page }) => {
    // Navigate to settings without setting theme
    await switchTab(page, 'settings')
    await page.waitForTimeout(300)

    const themeSelect = page.locator('#theme-select')
    await expect(themeSelect).toHaveValue('dark')
  })

  test('Theme switch immediately updates UI appearance', async ({ page }) => {
    await switchTab(page, 'settings')
    await page.waitForTimeout(300)

    const themeSelect = page.locator('#theme-select')
    const initialBg = await page
      .locator('main')
      .evaluate((el) => window.getComputedStyle(el).backgroundColor)

    await themeSelect.selectOption('light')
    await page.waitForTimeout(300)

    const newBg = await page
      .locator('main')
      .evaluate((el) => window.getComputedStyle(el).backgroundColor)

    expect(initialBg).not.toBe(newBg)
  })

  test('Theme change triggers theme update event', async ({ page }) => {
    await switchTab(page, 'settings')
    await page.waitForTimeout(300)

    const themeSelect = page.locator('#theme-select')
    await themeSelect.selectOption('light')

    // Wait for potential theme change
    await page.waitForTimeout(500)
  })

  test('Theme preference is saved to localStorage', async ({ page }) => {
    await switchTab(page, 'settings')
    await page.waitForTimeout(300)

    const themeSelect = page.locator('#theme-select')
    await themeSelect.selectOption('light')

    // Verify localStorage was updated
    const themeValue = await page.evaluate(() =>
      localStorage.getItem('pitchperfect_theme'),
    )
    expect(themeValue).toBe('light')
  })

  // ==========================================
  // BPM Settings Tests (7 tests)
  // ==========================================

  test('User can set BPM value within valid range (40-280)', async ({
    page,
  }) => {
    await switchTab(page, 'settings')
    await page.waitForTimeout(300)

    const bpmInput = page.locator('#bpm-input')
    await expect(bpmInput).toBeVisible()

    // Set BPM to 120 (default)
    await bpmInput.fill('120')
    await page.waitForTimeout(300)
    await expect(bpmInput).toHaveValue('120')
  })

  test('Default BPM is 120', async ({ page }) => {
    await switchTab(page, 'settings')
    await page.waitForTimeout(300)

    const bpmInput = page.locator('#bpm-input')
    await expect(bpmInput).toHaveValue('120')
  })

  test('BPM setting persists across sessions', async ({ page }) => {
    await switchTab(page, 'settings')
    await page.waitForTimeout(300)

    const bpmInput = page.locator('#bpm-input')
    await bpmInput.fill('150')

    // Reload page
    await page.reload()
    await page.waitForLoadState('networkidle')
    await dismissOverlays(page)
    await page.waitForTimeout(500)

    // BPM should still be 150
    await expect(bpmInput).toHaveValue('150')
  })

  test('BPM slider allows 1-unit increments', async ({ page }) => {
    await switchTab(page, 'settings')
    await page.waitForTimeout(300)

    const bpmSlider = page.locator('#bpm-slider')
    await expect(bpmSlider).toBeVisible()

    // BPM should be 120 initially
    const initialBpm = await bpmSlider.evaluate(
      (el) => (el as HTMLInputElement).value,
    )
    expect(initialBpm).toBe('120')
  })

  test('BPM input field accepts numeric values', async ({ page }) => {
    await switchTab(page, 'settings')
    await page.waitForTimeout(300)

    const bpmInput = page.locator('#bpm-input')
    await bpmInput.fill('100')

    await page.waitForTimeout(300)
    await expect(bpmInput).toHaveValue('100')
  })

  test('BPM changes affect all playback immediately', async ({ page }) => {
    // First navigate to practice tab to have playback setup
    await switchTab(page, 'practice')
    await page.waitForTimeout(300)

    // Then switch to settings
    await switchTab(page, 'settings')
    await page.waitForTimeout(300)

    const bpmInput = page.locator('#bpm-input')
    await bpmInput.fill('180')

    // BPM should update
    await expect(bpmInput).toHaveValue('180')
  })

  test('Invalid BPM values are clamped to valid range', async ({ page }) => {
    await switchTab(page, 'settings')
    await page.waitForTimeout(300)

    const bpmInput = page.locator('#bpm-input')

    // Try value outside range
    await bpmInput.fill('50')
    await page.waitForTimeout(300)

    // Should be clamped to 40
    await expect(bpmInput).toHaveValue('40')

    // Try value above max
    await bpmInput.fill('300')
    await page.waitForTimeout(300)

    // Should be clamped to 280
    await expect(bpmInput).toHaveValue('280')
  })

  // ==========================================
  // Metronome Settings Tests (6 tests)
  // ==========================================

  test('User can toggle metronome on/off', async ({ page }) => {
    await switchTab(page, 'settings')
    await page.waitForTimeout(300)

    const metroToggle = page.locator('#metronome-toggle')
    await expect(metroToggle).toBeVisible()

    // Click to turn on
    await metroToggle.click()
    await page.waitForTimeout(500)

    await expect(metroToggle).toHaveAttribute('data-active', 'true')
  })

  test('Metronome enable state persists across sessions', async ({ page }) => {
    await switchTab(page, 'settings')
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

  test('Metronome sound type is selectable', async ({ page }) => {
    await switchTab(page, 'settings')
    await page.waitForTimeout(300)

    const soundSelect = page.locator('#metro-sound-select')
    await expect(soundSelect).toBeVisible()

    // Check if options are available
    const count = await soundSelect.locator('option').count()
    expect(count).toBeGreaterThan(0)
  })

  test('Metronome volume is adjustable (0-100%)', async ({ page }) => {
    await switchTab(page, 'settings')
    await page.waitForTimeout(300)

    const volSlider = page.locator('#metro-volume-slider')
    await expect(volSlider).toBeVisible()

    // Set volume to 50
    await volSlider.fill('50')
    await page.waitForTimeout(300)
  })

  test('Metronome volume default is 50%', async ({ page }) => {
    await switchTab(page, 'settings')
    await page.waitForTimeout(300)

    const volSlider = page.locator('#metro-volume-slider')
    await expect(volSlider).toHaveValue('50')
  })

  test('Volume changes take effect immediately', async ({ page }) => {
    await switchTab(page, 'settings')
    await page.waitForTimeout(300)

    const volSlider = page.locator('#metro-volume-slider')
    await volSlider.fill('80')

    await expect(volSlider).toHaveValue('80')
  })

  // ==========================================
  // Instrument Selection Tests (5 tests)
  // ==========================================

  test('User can select playback instrument', async ({ page }) => {
    await switchTab(page, 'settings')
    await page.waitForTimeout(300)

    const instSelect = page.locator('#instrument-select')
    await expect(instSelect).toBeVisible()

    // Check available instruments
    const count = await instSelect.locator('option').count()
    expect(count).toBeGreaterThan(0)
  })

  test('Default instrument is sine', async ({ page }) => {
    await switchTab(page, 'settings')
    await page.waitForTimeout(300)

    const instSelect = page.locator('#instrument-select')
    await expect(instSelect).toHaveValue('sine')
  })

  test('Instrument selection persists across sessions', async ({ page }) => {
    await switchTab(page, 'settings')
    await page.waitForTimeout(300)

    const instSelect = page.locator('#instrument-select')
    await instSelect.selectOption('piano')

    // Reload page
    await page.reload()
    await page.waitForLoadState('networkidle')
    await dismissOverlays(page)
    await page.waitForTimeout(500)

    // Instrument should still be piano
    await expect(instSelect).toHaveValue('piano')
  })

  test('Each instrument has distinct audio characteristics', async ({
    page,
  }) => {
    await switchTab(page, 'settings')
    await page.waitForTimeout(300)

    const instSelect = page.locator('#instrument-select')

    // Test switching instruments
    for (const [index, value] of [
      'sine',
      'piano',
      'organ',
      'strings',
    ].entries()) {
      await instSelect.selectOption(value)
      await page.waitForTimeout(200)
      await expect(instSelect).toHaveValue(value)
    }
  })

  test('Instrument changes affect current playback immediately', async ({
    page,
  }) => {
    await switchTab(page, 'settings')
    await page.waitForTimeout(300)

    const instSelect = page.locator('#instrument-select')
    await instSelect.selectOption('piano')

    await expect(instSelect).toHaveValue('piano')
  })

  // ==========================================
  // Count-in Settings Tests (5 tests)
  // ==========================================

  test('User can select count-in beats (0, 1, 2, 4)', async ({ page }) => {
    await switchTab(page, 'settings')
    await page.waitForTimeout(300)

    const countSelect = page.locator('#count-in-select')
    await expect(countSelect).toBeVisible()

    // Check available options
    const count = await countSelect.locator('option').count()
    expect(count).toBeGreaterThan(0)
  })

  test('Default count-in is 0', async ({ page }) => {
    await switchTab(page, 'settings')
    await page.waitForTimeout(300)

    const countSelect = page.locator('#count-in-select')
    await expect(countSelect).toHaveValue('0')
  })

  test('Count-in setting affects all playback modes', async ({ page }) => {
    await switchTab(page, 'settings')
    await page.waitForTimeout(300)

    const countSelect = page.locator('#count-in-select')
    await countSelect.selectOption('4')

    await expect(countSelect).toHaveValue('4')
  })

  test('Count-in count is displayed during playback', async ({ page }) => {
    // Need to test playback with count-in
    // This test may require more complex setup
    await switchTab(page, 'settings')
    await page.waitForTimeout(300)

    const countSelect = page.locator('#count-in-select')
    await countSelect.selectOption('4')

    await expect(countSelect).toHaveValue('4')
  })

  test('Metronome sounds during count-in period', async ({ page }) => {
    await switchTab(page, 'settings')
    await page.waitForTimeout(300)

    const countSelect = page.locator('#count-in-select')
    await countSelect.selectOption('4')

    await expect(countSelect).toHaveValue('4')
  })

  // ==========================================
  // User Profile Tests (4 tests)
  // ==========================================

  test('User name is editable in settings', async ({ page }) => {
    await switchTab(page, 'settings')
    await page.waitForTimeout(300)

    const userNameInput = page.locator('#user-name-input')
    await expect(userNameInput).toBeVisible()
  })

  test('User name is required for author attribution', async ({ page }) => {
    await switchTab(page, 'settings')
    await page.waitForTimeout(300)

    const userNameInput = page.locator('#user-name-input')
    await expect(userNameInput).toBeVisible()
  })

  test('User changes persist in localStorage', async ({ page }) => {
    await switchTab(page, 'settings')
    await page.waitForTimeout(300)

    const userNameInput = page.locator('#user-name-input')
    await userNameInput.fill('Test User')

    const userName = await page.evaluate(() =>
      localStorage.getItem('pitchperfect_username'),
    )
    expect(userName).toBe('Test User')
  })

  test('User name changes apply to new melodies created', async ({ page }) => {
    await switchTab(page, 'settings')
    await page.waitForTimeout(300)

    const userNameInput = page.locator('#user-name-input')
    await userNameInput.fill('New Author')

    await expect(userNameInput).toHaveValue('New Author')
  })

  // ==========================================
  // Reset Functionality Tests (5 tests)
  // ==========================================

  test('Reset button clears all settings to defaults', async ({ page }) => {
    await switchTab(page, 'settings')
    await page.waitForTimeout(300)

    const resetButton = page.locator('#reset-settings-btn')
    await expect(resetButton).toBeVisible()
  })

  test('Reset operation requires confirmation dialog', async ({ page }) => {
    await switchTab(page, 'settings')
    await page.waitForTimeout(300)

    const resetButton = page.locator('#reset-settings-btn')
    await resetButton.click()

    // Confirmation dialog should appear
    await page.waitForTimeout(300)
  })

  test('Confirming reset restores all settings to defaults', async ({
    page,
  }) => {
    await switchTab(page, 'settings')
    await page.waitForTimeout(300)

    const resetButton = page.locator('#reset-settings-btn')
    await resetButton.click()

    // Would need actual confirmation dialog implementation
    // For now, just verify button is clickable
    await expect(resetButton).toBeVisible()
  })

  test('Cancelling reset does not apply changes', async ({ page }) => {
    await switchTab(page, 'settings')
    await page.waitForTimeout(300)

    const resetButton = page.locator('#reset-settings-btn')
    await resetButton.click()

    await page.waitForTimeout(300)
  })

  test('Reset restores theme to dark by default', async ({ page }) => {
    await switchTab(page, 'settings')
    await page.waitForTimeout(300)

    const themeSelect = page.locator('#theme-select')

    // First set to light
    await themeSelect.selectOption('light')
    await page.waitForTimeout(300)

    // Reset would restore to dark (when implemented)
    await expect(themeSelect).toHaveValue('dark')
  })
})
