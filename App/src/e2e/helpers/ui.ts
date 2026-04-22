import { Page, expect } from '@playwright/test'

export async function dismissOverlays(page: Page) {
  // Force hide any overlays via JavaScript
  await page.evaluate(() => {
    const overlays = document.querySelectorAll<HTMLElement>(
      '.welcome-overlay, .walkthrough-overlay',
    )
    overlays.forEach((el) => {
      el.style.display = 'none'
      el.style.pointerEvents = 'none'
    })
    // Set localStorage to dismiss welcome screen
    localStorage.setItem('pitchperfect_welcome_version', '0.1')
  })
  await page.waitForTimeout(500)
}

export async function goToAndWait(page: Page, url: string) {
  await page.goto(url)
  await page.waitForLoadState('networkidle')
}

export async function expectVisible(page: Page, selector: string) {
  await expect(page.locator(selector)).toBeVisible()
}
