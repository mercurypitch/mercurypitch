// ============================================================
// Settings Panel E2E Tests
// Tests for sensitivity presets, pitch detection, ADSR, reverb,
// visualization toggles, danger zone reset, and about section
//
// The Settings panel is split into three sub-tabs (Account & App /
// Singing / Display & Controls). Each group below switches to its sub-tab
// via switchSettingsTab (keyed on the tab's data-testid) before asserting.
// ============================================================

import { expect, test } from '@playwright/test'
import { dismissOverlays, switchSettingsTab, switchTab } from './helpers/ui'

test.describe('Settings Panel', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      ;(window as any).E2E_TEST_MODE = true
    })
    await page.goto('/')
    await page.waitForSelector('#app-tabs', { timeout: 10000 })
    await dismissOverlays(page)
    await switchTab(page, 'settings')
  })

  // ==========================================
  // Singing tab: sensitivity, pitch, accuracy,
  // ADSR, reverb, playback speed
  // ==========================================

  test.describe('Singing tab', () => {
    test.beforeEach(async ({ page }) => {
      await switchSettingsTab(page, 'singing')
    })

    test('Sensitivity preset select is visible', async ({ page }) => {
      const presetSelect = page.locator('#preset-select')
      await expect(presetSelect).toBeVisible()
    })

    test('Sensitivity preset has multiple options', async ({ page }) => {
      const presetSelect = page.locator('#preset-select')
      const count = await presetSelect.locator('option').count()
      expect(count).toBeGreaterThan(1)
    })

    test('Selecting a preset updates detection threshold', async ({ page }) => {
      const presetSelect = page.locator('#preset-select')
      await presetSelect.selectOption({ index: 2 })
      await page.waitForTimeout(200)
      const thresholdAfter = await page.locator('#set-threshold').inputValue()
      expect(thresholdAfter).toBeTruthy()
    })

    test('Pitch algorithm select is visible', async ({ page }) => {
      const algoSelect = page.locator('#pitch-algorithm-select')
      await expect(algoSelect).toBeVisible()
    })

    test('Pitch algorithm has multiple options', async ({ page }) => {
      const algoSelect = page.locator('#pitch-algorithm-select')
      const count = await algoSelect.locator('option').count()
      expect(count).toBeGreaterThan(1)
    })

    test('Accuracy band inputs are visible', async ({ page }) => {
      await expect(page.locator('#band-perfect')).toBeVisible()
      await expect(page.locator('#band-excellent')).toBeVisible()
      await expect(page.locator('#band-good')).toBeVisible()
      await expect(page.locator('#band-okay')).toBeVisible()
    })

    test('Accuracy band values have defaults', async ({ page }) => {
      const perfect = await page.locator('#band-perfect').inputValue()
      expect(Number(perfect)).toBeGreaterThan(0)
    })

    test('ADSR controls are visible', async ({ page }) => {
      await expect(page.locator('#adsr-attack')).toBeVisible()
      await expect(page.locator('#adsr-decay')).toBeVisible()
      await expect(page.locator('#adsr-sustain')).toBeVisible()
      await expect(page.locator('#adsr-release')).toBeVisible()
    })

    test('ADSR attack slider can be adjusted', async ({ page }) => {
      const attack = page.locator('#adsr-attack')
      await attack.scrollIntoViewIfNeeded()
      await attack.fill('100')
      await expect(attack).toHaveValue('100')
    })

    test('ADSR sustain defaults to a reasonable value', async ({ page }) => {
      const sustain = page.locator('#adsr-sustain')
      await sustain.scrollIntoViewIfNeeded()
      const val = Number(await sustain.inputValue())
      expect(val).toBeGreaterThanOrEqual(0)
      expect(val).toBeLessThanOrEqual(1000)
    })

    test('Reverb type select is visible', async ({ page }) => {
      const reverbType = page.locator('#reverb-type')
      await expect(reverbType).toBeVisible()
    })

    test('Reverb type has multiple options', async ({ page }) => {
      const reverbType = page.locator('#reverb-type')
      const count = await reverbType.locator('option').count()
      expect(count).toBeGreaterThan(1)
    })

    test('Reverb type can be changed', async ({ page }) => {
      const reverbType = page.locator('#reverb-type')
      const options = await reverbType.locator('option').all()
      if (options.length >= 2) {
        const val = await options[1].getAttribute('value')
        await reverbType.selectOption(val!)
        await expect(reverbType).toHaveValue(val!)
      }
    })

    test('Reverb wetness slider is visible', async ({ page }) => {
      const wetness = page.locator('#reverb-wetness')
      await expect(wetness).toBeVisible()
    })

    test('Reverb wetness can be adjusted', async ({ page }) => {
      const wetness = page.locator('#reverb-wetness')
      await wetness.scrollIntoViewIfNeeded()
      await wetness.fill('50')
      await expect(wetness).toHaveValue('50')
    })

    test('Playback speed slider is visible', async ({ page }) => {
      const speed = page.locator('#playback-speed')
      await expect(speed).toBeVisible()
    })

    test('Playback speed has a default value', async ({ page }) => {
      const speed = page.locator('#playback-speed')
      const val = await speed.inputValue()
      expect(Number(val)).toBeGreaterThan(0)
    })
  })

  // ==========================================
  // Display & Controls tab: visualization toggles
  // ==========================================

  test.describe('Display & Controls tab', () => {
    test.beforeEach(async ({ page }) => {
      await switchSettingsTab(page, 'display')
    })

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
        const el = page.locator(`#${id}`)
        await el.scrollIntoViewIfNeeded()
        await expect(el).toBeAttached()
      })
    }

    test('Visualization toggle is checkable', async ({ page }) => {
      const toggle = page.locator('#vis-pitch-display')
      // Verify it exists as a checkbox input
      await expect(toggle).toHaveAttribute('type', 'checkbox')
    })
  })

  // ==========================================
  // Account & App tab: danger zone reset, about
  // ==========================================

  test.describe('Account & App tab', () => {
    test.beforeEach(async ({ page }) => {
      await switchSettingsTab(page, 'account')
    })

    test('Reset button is visible in Danger Zone', async ({ page }) => {
      const resetBtn = page.locator('[data-testid="danger-reset-btn"]')
      await resetBtn.scrollIntoViewIfNeeded()
      await expect(resetBtn).toBeVisible()
      await expect(resetBtn).toContainText('Reset')
    })

    test('Clicking Reset opens confirmation modal', async ({ page }) => {
      const resetBtn = page.locator('[data-testid="danger-reset-btn"]')
      await resetBtn.click()
      await page.waitForTimeout(200)
      const confirmBox = page.locator('[data-testid="danger-confirm-box"]')
      await expect(confirmBox).toBeVisible()
    })

    test('Confirmation modal has Cancel and Confirm buttons', async ({
      page,
    }) => {
      await page.locator('[data-testid="danger-reset-btn"]').click()
      await page.waitForTimeout(200)
      const cancelBtn = page.locator('[data-testid="danger-cancel-btn"]')
      const confirmBtn = page.locator('[data-testid="danger-confirm-btn"]')
      await expect(cancelBtn).toBeVisible()
      await expect(confirmBtn).toBeVisible()
      await expect(confirmBtn).toContainText('Reset All Data')
    })

    test('Cancelling reset closes modal without resetting', async ({
      page,
    }) => {
      await page.locator('[data-testid="danger-reset-btn"]').click()
      await page.waitForTimeout(200)
      await page.locator('[data-testid="danger-cancel-btn"]').click()
      await page.waitForTimeout(200)
      const confirmBox = page.locator('[data-testid="danger-confirm-box"]')
      await expect(confirmBox).not.toBeVisible()
    })

    test('About section shows app name', async ({ page }) => {
      const nameEl = page.locator('[data-testid="about-name"]')
      await expect(nameEl).toBeVisible()
      await expect(nameEl).toContainText('MercuryPitch')
    })

    test('About section shows version', async ({ page }) => {
      const versionEl = page.locator('[data-testid="about-version"]')
      await versionEl.scrollIntoViewIfNeeded()
      await expect(versionEl).toBeVisible()
      const text = await versionEl.textContent()
      expect(text).toMatch(/v\d+\.\d+\.\d+/i)
    })

    test('About section has description', async ({ page }) => {
      const descEl = page.locator('[data-testid="about-desc"]')
      await expect(descEl).toBeVisible()
      const text = await descEl.textContent()
      expect(text?.length).toBeGreaterThan(20)
    })

    test('About section lists features as pills', async ({ page }) => {
      // Feature pills are inside the about-features container
      const featuresContainer = page.locator('[data-testid="about-features"]')
      await featuresContainer.scrollIntoViewIfNeeded()
      const pills = featuresContainer.locator('span')
      const count = await pills.count()
      expect(count).toBeGreaterThanOrEqual(1)
    })
  })
})
