import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

export async function dismissOverlays(page: Page) {
  // Force hide any overlays and reset focus mode
  await page.evaluate(() => {
    // Hide all overlays including focus mode
    const overlays = document.querySelectorAll('.welcome-overlay, .walkthrough-overlay, .overlay, .focus-mode-backdrop')
    for (let i = 0; i < overlays.length; i++) {
      const el = overlays[i] as HTMLElement
      el.style.visibility = 'hidden'
      el.style.pointerEvents = 'none'
    }

    // Try to use appStore if available (triggers SolidJS reactivity)
    if ((window as any).__appStore) {
      (window as any).__appStore.dismissWelcome()
      (window as any).__appStore.setActiveTab('practice')
      (window as any).__appStore.exitFocusMode()
    }

    // Set localStorage as fallback
    localStorage.setItem('pitchperfect_welcome_version', '0.1')
    localStorage.setItem('pitchperfect_active_tab', 'practice')
    localStorage.setItem('pitchperfect_focus_mode', 'false')
  })
  await page.waitForTimeout(500)
}

export async function waitForTabs(page: Page) {
  await page.waitForSelector('#tab-editor', { timeout: 5000, state: 'attached' })
  await page.waitForSelector('#tab-practice', { timeout: 5000, state: 'attached' })
  await page.waitForSelector('#tab-settings', { timeout: 5000, state: 'attached' })
}

export async function switchTab(page: Page, tabName: 'editor' | 'practice' | 'settings') {
  await page.evaluate((name) => {
    // Try to use appStore first (triggers SolidJS reactivity)
    if ((window as any).__appStore) {
      (window as any).__appStore.setActiveTab(name)
    } else {
      // Fallback to localStorage
      localStorage.setItem('pitchperfect_active_tab', name)
    }
  }, tabName)
  await page.waitForTimeout(300)
}

export async function goToAndWait(page: Page, url: string) {
  await page.goto(url)
  await page.waitForLoadState('networkidle')
}

export async function expectVisible(page: Page, selector: string) {
  await expect(page.locator(selector)).toBeVisible()
}
