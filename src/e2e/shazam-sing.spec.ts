import { expect, test } from '@playwright/test'

test.describe('Shazam Sing', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      ;(window as any).E2E_TEST_MODE = true
      // Suppress welcome and overlays
      localStorage.setItem('pitchperfect_welcome_version', '0.3.1')
      localStorage.setItem('pitchperfect_active_tab', 'karaoke')
      localStorage.setItem('pitchperfect_focus_mode', 'false')
    })
    // Navigate directly to karaoke tab to avoid dismissOverlays side effects
    await page.goto('/#/karaoke')
    await page.waitForSelector('[data-testid="shazam-listen"]', {
      timeout: 15000,
    })
  })

  test('default karaoke view is shazam-listen @smoke', async ({ page }) => {
    await expect(page.locator('[data-testid="shazam-listen"]')).toBeVisible({
      timeout: 10000,
    })
    await expect(page.locator('[data-testid="shazam-mic-btn"]')).toBeVisible()
    await expect(page.locator('[data-testid="shazam-canvas"]')).toBeVisible()
    await expect(
      page.locator('[data-testid="shazam-upload-link"]'),
    ).toBeVisible()
  })

  test('upload link switches to upload view', async ({ page }) => {
    await page.waitForSelector('[data-testid="shazam-upload-link"]', {
      timeout: 10000,
    })
    // dispatchEvent works around Playwright pointer event sequencing that
    // doesn't trigger SolidJS delegated handlers inside Suspense boundaries
    await page
      .locator('[data-testid="shazam-upload-link"]')
      .dispatchEvent('click')
    await page.waitForSelector('.upload-section', { timeout: 10000 })
    await expect(page.locator('.upload-section')).toBeVisible()
    await expect(
      page.locator('[data-testid="shazam-listen"]'),
    ).not.toBeVisible()
  })

  test('sing-to-find link in upload view switches back to shazam-listen', async ({
    page,
  }) => {
    // First go to upload
    await page
      .locator('[data-testid="shazam-upload-link"]')
      .dispatchEvent('click')
    await page.waitForSelector('.upload-section', { timeout: 10000 })
    await expect(page.locator('.upload-section')).toBeVisible()

    // Click the "Sing to find a melody" link
    await page
      .locator('[data-testid="shazam-switch-to-listen"]')
      .dispatchEvent('click')
    await page.waitForSelector('[data-testid="shazam-listen"]', {
      timeout: 10000,
    })
    await expect(page.locator('[data-testid="shazam-listen"]')).toBeVisible()
  })

  test('mic button is enabled when idle, stop is disabled, cancel is enabled', async ({
    page,
  }) => {
    await expect(page.locator('[data-testid="shazam-mic-btn"]')).toBeEnabled({
      timeout: 10000,
    })
    // Stop is disabled when not listening
    await expect(page.locator('[data-testid="shazam-stop-btn"]')).toBeDisabled()
    // Cancel is only disabled during processing — enabled when idle
    await expect(page.locator('[data-testid="shazam-cancel"]')).toBeEnabled()
  })

  test('Sessions tab toggles between upload and shazam-listen', async ({
    page,
  }) => {
    // Click Sessions tab -> should go to upload
    await page.locator('.view-tab:has-text("Sessions")').dispatchEvent('click')
    await page.waitForSelector('.upload-section', { timeout: 10000 })
    await expect(page.locator('.upload-section')).toBeVisible()

    // Click Sessions tab again -> should go back to shazam-listen
    await page.locator('.view-tab:has-text("Sessions")').dispatchEvent('click')
    await page.waitForSelector('[data-testid="shazam-listen"]', {
      timeout: 10000,
    })
    await expect(page.locator('[data-testid="shazam-listen"]')).toBeVisible()
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
