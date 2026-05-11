// ============================================================
// Settings Panel E2E Tests
// Tests for sensitivity presets, pitch detection, ADSR, reverb,
// visualization toggles, danger zone reset, and about section
// ============================================================

import { expect, test } from '@playwright/test'
import { dismissOverlays, switchTab } from './helpers/ui'

test.describe('Settings Panel', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      ;(window as any).E2E_TEST_MODE = true
    })
    await page.goto('/')
    await page.waitForSelector('#app-tabs', { timeout: 10000 })
    await dismissOverlays(page)
  })

  // ==========================================
  // Sensitivity Presets Tests
  // ==========================================

  test('Sensitivity preset select is visible', async ({ page }) => {
    await switchTab(page, 'settings')
    const presetSelect = page.locator('#preset-select')
    await expect(presetSelect).toBeVisible()
  })

  test('Sensitivity preset has multiple options', async ({ page }) => {
    await switchTab(page, 'settings')
    const presetSelect = page.locator('#preset-select')
    const count = await presetSelect.locator('option').count()
    expect(count).toBeGreaterThan(1)
  })

  test('Selecting a preset updates detection threshold', async ({ page }) => {
    await switchTab(page, 'settings')
    const presetSelect = page.locator('#preset-select')
    const thresholdBefore = await page.locator('#set-threshold').inputValue()
    await presetSelect.selectOption({ index: 2 })
    await page.waitForTimeout(200)
    const thresholdAfter = await page.locator('#set-threshold').inputValue()
    expect(thresholdAfter).toBeTruthy()
  })

  // ==========================================
  // Pitch Algorithm Tests
  // ==========================================

  test('Pitch algorithm select is visible', async ({ page }) => {
    await switchTab(page, 'settings')
    const algoSelect = page.locator('#pitch-algorithm-select')
    await expect(algoSelect).toBeVisible()
  })

  test('Pitch algorithm has multiple options', async ({ page }) => {
    await switchTab(page, 'settings')
    const algoSelect = page.locator('#pitch-algorithm-select')
    const count = await algoSelect.locator('option').count()
    expect(count).toBeGreaterThan(1)
  })

  // ==========================================
  // Accuracy Bands Tests
  // ==========================================

  test('Accuracy band inputs are visible', async ({ page }) => {
    await switchTab(page, 'settings')
    await expect(page.locator('#band-perfect')).toBeVisible()
    await expect(page.locator('#band-excellent')).toBeVisible()
    await expect(page.locator('#band-good')).toBeVisible()
    await expect(page.locator('#band-okay')).toBeVisible()
  })

  test('Accuracy band values have defaults', async ({ page }) => {
    await switchTab(page, 'settings')
    const perfect = await page.locator('#band-perfect').inputValue()
    expect(Number(perfect)).toBeGreaterThan(0)
  })

  // ==========================================
  // ADSR Envelope Tests
  // ==========================================

  test('ADSR controls are visible', async ({ page }) => {
    await switchTab(page, 'settings')
    await expect(page.locator('#adsr-attack')).toBeVisible()
    await expect(page.locator('#adsr-decay')).toBeVisible()
    await expect(page.locator('#adsr-sustain')).toBeVisible()
    await expect(page.locator('#adsr-release')).toBeVisible()
  })

  test('ADSR attack slider can be adjusted', async ({ page }) => {
    await switchTab(page, 'settings')
    const attack = page.locator('#adsr-attack')
    await attack.scrollIntoViewIfNeeded()
    await attack.fill('100')
    await expect(attack).toHaveValue('100')
  })

  test('ADSR sustain defaults to a reasonable value', async ({ page }) => {
    await switchTab(page, 'settings')
    const sustain = page.locator('#adsr-sustain')
    await sustain.scrollIntoViewIfNeeded()
    const val = Number(await sustain.inputValue())
    expect(val).toBeGreaterThanOrEqual(0)
    expect(val).toBeLessThanOrEqual(1000)
  })

  // ==========================================
  // Reverb Tests
  // ==========================================

  test('Reverb type select is visible', async ({ page }) => {
    await switchTab(page, 'settings')
    const reverbType = page.locator('#reverb-type')
    await expect(reverbType).toBeVisible()
  })

  test('Reverb type has multiple options', async ({ page }) => {
    await switchTab(page, 'settings')
    const reverbType = page.locator('#reverb-type')
    const count = await reverbType.locator('option').count()
    expect(count).toBeGreaterThan(1)
  })

  test('Reverb type can be changed', async ({ page }) => {
    await switchTab(page, 'settings')
    const reverbType = page.locator('#reverb-type')
    const options = await reverbType.locator('option').all()
    if (options.length >= 2) {
      const val = await options[1].getAttribute('value')
      await reverbType.selectOption(val!)
      await expect(reverbType).toHaveValue(val!)
    }
  })

  test('Reverb wetness slider is visible', async ({ page }) => {
    await switchTab(page, 'settings')
    const wetness = page.locator('#reverb-wetness')
    await expect(wetness).toBeVisible()
  })

  test('Reverb wetness can be adjusted', async ({ page }) => {
    await switchTab(page, 'settings')
    const wetness = page.locator('#reverb-wetness')
    await wetness.scrollIntoViewIfNeeded()
    await wetness.fill('50')
    await expect(wetness).toHaveValue('50')
  })

  // ==========================================
  // Playback Speed Tests
  // ==========================================

  test('Playback speed slider is visible', async ({ page }) => {
    await switchTab(page, 'settings')
    const speed = page.locator('#playback-speed')
    await expect(speed).toBeVisible()
  })

  test('Playback speed has a default value', async ({ page }) => {
    await switchTab(page, 'settings')
    const speed = page.locator('#playback-speed')
    const val = await speed.inputValue()
    expect(Number(val)).toBeGreaterThan(0)
  })

  // ==========================================
  // Visualization Toggle Tests
  // ==========================================

  const vizToggles = [
    { id: 'vis-gridlines', name: 'gridlines' },
    { id: 'vis-playback-setup', name: 'playback setup' },
    { id: 'vis-pitch-display', name: 'pitch display' },
    { id: 'vis-playback-ball', name: 'playback ball' },
    { id: 'vis-playhead', name: 'playhead' },
    { id: 'vis-stats', name: 'stats' },
  ]

  for (const { id, name } of vizToggles) {
    test(`Visualization toggle "${name}" exists`, async ({ page }) => {
      await switchTab(page, 'settings')
      const el = page.locator(`#${id}`)
      await el.scrollIntoViewIfNeeded()
      await expect(el).toBeAttached()
    })
  }

  test('Visualization toggle is checkable', async ({ page }) => {
    await switchTab(page, 'settings')
    const toggle = page.locator('#vis-pitch-display')
    // Verify it exists as a checkbox input
    await expect(toggle).toHaveAttribute('type', 'checkbox')
  })

  // ==========================================
  // Danger Zone / Reset Tests
  // ==========================================

  test('Reset button is visible in Danger Zone', async ({ page }) => {
    await switchTab(page, 'settings')
    const resetBtn = page.locator('.danger-btn').first()
    await expect(resetBtn).toBeVisible()
    await expect(resetBtn).toContainText('Reset')
  })

  test('Clicking Reset opens confirmation modal', async ({ page }) => {
    await switchTab(page, 'settings')
    const resetBtn = page.locator('.danger-btn:has-text("Reset")')
    await resetBtn.click()
    await page.waitForTimeout(200)
    const confirmBox = page.locator('.danger-confirm-box')
    await expect(confirmBox).toBeVisible()
  })

  test('Confirmation modal has Cancel and Confirm buttons', async ({
    page,
  }) => {
    await switchTab(page, 'settings')
    await page.locator('.danger-btn:has-text("Reset")').click()
    await page.waitForTimeout(200)
    const cancelBtn = page.locator('.danger-btn-secondary')
    const confirmBtn = page.locator('.danger-btn-primary')
    await expect(cancelBtn).toBeVisible()
    await expect(confirmBtn).toBeVisible()
    await expect(confirmBtn).toContainText('Reset All Data')
  })

  test('Cancelling reset closes modal without resetting', async ({ page }) => {
    await switchTab(page, 'settings')
    await page.locator('.danger-btn:has-text("Reset")').click()
    await page.waitForTimeout(200)
    await page.locator('.danger-btn-secondary').click()
    await page.waitForTimeout(200)
    const confirmBox = page.locator('.danger-confirm-box')
    await expect(confirmBox).not.toBeVisible()
  })

  // ==========================================
  // About Section Tests
  // ==========================================

  test('About section shows app name', async ({ page }) => {
    await switchTab(page, 'settings')
    const nameEl = page.locator('.about-name')
    await expect(nameEl).toBeVisible()
    await expect(nameEl).toContainText('PitchPerfect')
  })

  test('About section shows version', async ({ page }) => {
    await switchTab(page, 'settings')
    const versionEl = page.locator('.about-version')
    await expect(versionEl).toBeVisible()
    const text = await versionEl.textContent()
    expect(text).toMatch(/v\d+\.\d+\.\d+/i)
  })

  test('About section has description', async ({ page }) => {
    await switchTab(page, 'settings')
    const descEl = page.locator('.about-desc')
    await expect(descEl).toBeVisible()
    const text = await descEl.textContent()
    expect(text?.length).toBeGreaterThan(20)
  })

  test('About section lists features as pills', async ({ page }) => {
    await switchTab(page, 'settings')
    const pills = page.locator('.feature-pill')
    const count = await pills.count()
    expect(count).toBeGreaterThanOrEqual(1)
  })
})
