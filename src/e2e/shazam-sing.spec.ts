import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

test.describe('Shazam Sing', () => {
  test.beforeEach(async ({ page }) => {
    const pkgPath = path.resolve(process.cwd(), 'package.json')
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
    const appVersion = pkg.version

    await page.addInitScript((version) => {
      ;(window as any).E2E_TEST_MODE = true
      // Suppress welcome and overlays
      localStorage.setItem('pitchperfect_welcome_version', version)
      localStorage.setItem('pitchperfect_active_tab', 'karaoke')
      localStorage.setItem('pitchperfect_focus_mode', 'false')
    }, appVersion)
    // Navigate directly to karaoke tab to avoid dismissOverlays side effects
    await page.goto('/#/karaoke')
    // Wait for the default upload view to be visible
    await page.waitForSelector('[data-testid="uvr-upload"]', {
      timeout: 15000,
    })
  })

  test('default karaoke view is upload @smoke', async ({ page }) => {
    await expect(page.locator('[data-testid="uvr-upload"]')).toBeVisible({
      timeout: 10000,
    })
    await expect(page.locator('[data-testid="shazam-switch-to-listen"]')).toBeVisible()
  })

  test('sing-to-find link switches to shazam-listen view', async ({ page }) => {
    await page.locator('[data-testid="shazam-switch-to-listen"]').click()

    await expect(page.locator('[data-testid="shazam-listen"]')).toBeVisible({
      timeout: 10000,
    })
    await expect(page.locator('[data-testid="shazam-upload-link"]')).toBeVisible()
  })

  test('upload link in shazam-listen switches back to upload view', async ({
    page,
  }) => {
    // First go to shazam-listen
    await page
      .locator('[data-testid="shazam-switch-to-listen"]')
      .dispatchEvent('click')
    await page.waitForSelector('[data-testid="shazam-listen"]', { timeout: 10000 })

    // Click the "Upload audio instead" link
    await page
      .locator('[data-testid="shazam-upload-link"]')
      .dispatchEvent('click')
    await page.waitForSelector('.upload-section', {
      timeout: 10000,
    })
    await expect(page.locator('.upload-section')).toBeVisible()
  })

  test('mic button is enabled when idle, stop is disabled, cancel is enabled', async ({
    page,
  }) => {
    await page.locator('[data-testid="shazam-switch-to-listen"]').click()
    await expect(page.locator('[data-testid="shazam-mic-btn"]')).toBeEnabled({
      timeout: 10000,
    })
    // Stop is disabled when not listening
    await expect(page.locator('[data-testid="shazam-stop-btn"]')).toBeDisabled()
    // Cancel is only disabled during processing — enabled when idle
    await expect(page.locator('[data-testid="shazam-cancel"]')).toBeEnabled()
  })

  test('Sessions tab toggles between shazam-listen and upload', async ({
    page,
  }) => {
    // Start at upload, go to shazam-listen
    await page.locator('[data-testid="shazam-switch-to-listen"]').click()
    await page.waitForSelector('[data-testid="shazam-listen"]', { timeout: 10000 })

    // Click Sessions tab -> should go back to upload
    await page.locator('.view-tab:has-text("Sessions")').dispatchEvent('click')
    await page.waitForSelector('.upload-section', { timeout: 10000 })
    await expect(page.locator('.upload-section')).toBeVisible()
  })

  test('stem denoise toggle is visible in UVR settings', async ({ page }) => {
    // Open Settings — use evaluate to trigger SolidJS delegated onClick
    await page
      .locator('.view-tab:has-text("Settings")')
      .evaluate((el) => (el as HTMLElement).click())
    await page.waitForSelector('[data-testid="stem-denoise-toggle"]', {
      timeout: 10000,
    })

    const denoiseToggle = page.locator('[data-testid="stem-denoise-toggle"]')
    await expect(denoiseToggle).toBeVisible()
    // Default should be checked (denoise on)
    await expect(denoiseToggle).toBeChecked()
  })
})
