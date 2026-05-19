import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

export async function dismissOverlays(page: Page) {
  const pkgPath = path.resolve(process.cwd(), 'package.json')
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
  const appVersion = pkg.version

  // Force hide any overlays and reset focus mode via hash and localStorage
  await page.evaluate((version) => {
    // Hide all overlays including focus mode in DOM immediately
    const overlays = document.querySelectorAll(
      '[class*="welcomeOverlay"], [class*="walkthroughOverlay"], [class*="welcome-overlay"], [class*="walkthrough-overlay"], .overlay, .focus-mode-backdrop, [class*="welcome-screen"]',
    )
    for (let i = 0; i < overlays.length; i++) {
      const el = overlays[i] as HTMLElement
      el.style.visibility = 'hidden'
      el.style.pointerEvents = 'none'
    }

    // Set localStorage to prevent overlays from reappearing on next load
    localStorage.setItem('pitchperfect_welcome_version', version)
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
  }, appVersion)

  // Wait for overlay hiding to take effect
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
  // Click the tab button directly — no bridge dependency
  const tabButton = page.locator(`#tab-${tabName}`)
  await tabButton.click()
  await expect(tabButton).toHaveClass(/active/, { timeout: 5000 })
}

export async function goToAndWait(page: Page, url: string) {
  await page.goto(url)
  await page.waitForLoadState('networkidle')
}

export async function expectVisible(page: Page, selector: string) {
  await expect(page.locator(selector)).toBeVisible()
}
