import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

export async function dismissOverlays(page: Page) {
  // Force hide any overlays and reset focus mode via hash and localStorage
  await page.evaluate(() => {
    // Hide all overlays including focus mode in DOM immediately
    const overlays = document.querySelectorAll(
      '.welcome-overlay, .walkthrough-overlay, .overlay, .focus-mode-backdrop, .welcome-screen',
    )
    for (let i = 0; i < overlays.length; i++) {
      const el = overlays[i] as HTMLElement
      el.style.visibility = 'hidden'
      el.style.pointerEvents = 'none'
    }

    // Set localStorage to prevent overlays from reappearing on next load
    localStorage.setItem('pitchperfect_welcome_version', '0.3.1')
    localStorage.setItem('pitchperfect_active_tab', 'singing')
    localStorage.setItem('pitchperfect_focus_mode', 'false')

    // Also update app state via bridge if available to ensure signals are synced
    const pp = (window as any).__pp
    if (pp?.appStore) {
      if (typeof pp.appStore.setShowWelcome === 'function') {
        pp.appStore.setShowWelcome(false)
      }
      if (typeof pp.appStore.exitFocusMode === 'function') {
        pp.appStore.exitFocusMode()
      }
    }
  })

  // Navigate to singing tab via hash to ensure app state is synced
  await page.goto('/#/singing')
  await page.waitForTimeout(500)
}

export async function waitForTabs(page: Page) {
  await page.waitForSelector('#app-tabs', {
    timeout: 5000,
    state: 'visible',
  })
}

export async function switchTab(
  page: Page,
  tabName:
    | 'compose'
    | 'singing'
    | 'settings'
    | 'challenges'
    | 'leaderboard'
    | 'community'
    | 'analysis',
) {
  // Use hash navigation as it's the most reliable way to trigger the app's router
  // and works even if the internal store bridge is not available.
  await page.evaluate((name) => {
    window.location.hash = `#/${name}`

    // Force sync activeTab if bridge is available, as hashchange might not
    // trigger if we're already on that hash but out of sync.
    const pp = (window as any).__pp
    if (pp?.appStore?.setActiveTab) {
      pp.appStore.setActiveTab(name)
    }
  }, tabName)

  // Wait for the tab to be marked as active in the DOM
  const tabButton = page.locator(`#tab-${tabName}`)
  await expect(tabButton).toHaveClass(/active/, { timeout: 5000 })
}

export async function goToAndWait(page: Page, url: string) {
  await page.goto(url)
  await page.waitForLoadState('networkidle')
}

export async function expectVisible(page: Page, selector: string) {
  await expect(page.locator(selector)).toBeVisible()
}
