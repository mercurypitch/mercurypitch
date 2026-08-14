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
    // Hide all overlays including focus mode in DOM immediately.
    //
    // `[data-onboarding-flow]` is the First Light flow. It used to be
    // reachable through the welcome screen's own class, but the welcome
    // screen is gone and the flow now opens straight away for a first-time
    // visitor — which every spec is. Its class is a CSS-module hash, so it
    // has to announce itself with an attribute or nothing here can match
    // it, and an aria-modal dialog over the app swallows every click.
    const overlays = document.querySelectorAll(
      '[class*="welcomeOverlay"], [class*="walkthroughOverlay"], [class*="welcome-overlay"], [class*="walkthrough-overlay"], .overlay, .focus-mode-backdrop, [class*="welcome-screen"], [data-onboarding-flow]',
    )
    for (let i = 0; i < overlays.length; i++) {
      const el = overlays[i] as HTMLElement
      el.style.visibility = 'hidden'
      el.style.pointerEvents = 'none'
    }

    // Set localStorage to prevent overlays from reappearing on next load
    localStorage.setItem('pitchperfect_welcome_version', version)
    localStorage.setItem('pitchperfect_onboarding_done', '1')
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

/**
 * Wait until the app's navigation exists, on either viewport.
 *
 * `#tab-singing` rather than `#app-tabs`: the desktop bar unmounts below
 * the mobile breakpoint, and Singing is the one tab that sits in the row
 * of BOTH bars. Specs used to wait on `#tab-exercises`, which now lives
 * behind the Practice group's overflow button and so never appears on its
 * own — a wait that would simply time out.
 */
export async function waitForNav(page: Page, timeout = 15000) {
  await page.waitForSelector('#tab-singing', { timeout, state: 'visible' })
}

/** The tab bar's own overflow panel — see AppNavOverflowMenu's aria-label. */
const NAV_OVERFLOW_MENU = '[role="menu"][aria-label^="More "]'

/**
 * Click a nav tab wherever it currently lives.
 *
 * The desktop bar shows AT MOST three tabs per group and folds the rest behind
 * that group's "..." button — fewer than three once the window is narrow
 * enough that it measures itself down (AppNavTabs' fitToWidth). The phone bar
 * shows four and folds the rest into its More sheet. So which tabs are on
 * screen depends on the viewport, and no spec can assume a given tab is:
 * that is the whole reason this helper exists.
 *
 * Overflowed tabs keep their `#tab-*` id either way. Takes the DOM id, not the
 * tab id, because they are not always the same (the Piano tab's button is
 * historically `#tab-falling-notes`), and finds the owning menu by opening
 * triggers until the button turns up — so it never has to be kept in step with
 * the group taxonomy.
 */
/** Where revealNavTab found the tab — callers close only what the scan opened. */
type NavTabSurface = 'inline' | 'overflow-menu' | 'more-sheet' | 'missing'

/**
 * Make `#buttonId` visible wherever the bar currently keeps it: already
 * inline, behind a desktop group's "..." menu, or (phone) inside the bottom
 * bar's More sheet. The one scan both openNavTab and expectNavTabOffered
 * ride, so the two can never disagree about where a tab lives. Returns the
 * surface that revealed it, so a caller can close exactly what the scan
 * opened and nothing else.
 */
async function revealNavTab(
  page: Page,
  buttonId: string,
): Promise<NavTabSurface> {
  const button = page.locator(`#${buttonId}`)
  const visible = async () => await button.isVisible().catch(() => false)

  if (await visible()) return 'inline'

  // Desktop: try each group's overflow menu in turn.
  const triggers = page.locator('[data-testid^="tab-overflow-"]')
  const count = await triggers.count()
  for (let i = 0; i < count; i++) {
    await triggers.nth(i).click()
    if (await visible()) return 'overflow-menu'
    await page.keyboard.press('Escape')
  }

  // Phone: everything off the bar lives in the More sheet.
  const more = page.locator('[data-tour="mobile-tabbar-more"]')
  if ((await more.count()) > 0) {
    await more.click()
    if (await visible()) return 'more-sheet'
  }

  return 'missing'
}

export async function openNavTab(
  page: Page,
  buttonId: string,
  options: { force?: boolean } = {},
) {
  await revealNavTab(page, buttonId)

  // `force` is for the specs that deliberately skip dismissOverlays: the
  // onboarding flow covers the page, so the button is visible but the pointer
  // is intercepted. It was `click({ force: true })` before this helper existed.
  await page.locator(`#${buttonId}`).click({ force: options.force })
  // The menu that held it unmounts as the tab activates (the active tab is
  // promoted into the bar). Wait for that so a following locator cannot
  // catch a frame with both the row and the bar button on screen. Scoped by
  // aria-label, not a bare `[role="menu"]` — the UVR session actions and the
  // stem-mixer transport have menus of their own that this must not wait on.
  await expect(page.locator(NAV_OVERFLOW_MENU)).toHaveCount(0, {
    timeout: 5000,
  })
}

/**
 * Assert a nav tab is offered: as an inline bar button, or as a row inside
 * some group's "..." overflow menu (or the phone bar's More sheet). Which
 * side of the split a tab lands on depends on the viewport and on how many
 * tabs are visible — a spec that asserts raw visibility on the button id
 * fails the moment its tab folds. Closes only what the scan itself opened,
 * so a surface the caller had open stays open.
 */
export async function expectNavTabOffered(page: Page, buttonId: string) {
  const surface = await revealNavTab(page, buttonId)
  await expect(page.locator(`#${buttonId}`)).toBeVisible()

  if (surface === 'overflow-menu' || surface === 'more-sheet') {
    await page.keyboard.press('Escape')
    if (surface === 'overflow-menu') {
      await expect(page.locator(NAV_OVERFLOW_MENU)).toHaveCount(0, {
        timeout: 5000,
      })
    }
    // Closing the menu refocuses its trigger, where a later Space/Enter
    // would reopen it — blur so the helper leaves no armed control behind.
    await page.evaluate(() =>
      (document.activeElement as HTMLElement | null)?.blur(),
    )
  }
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
    | 'analysis'
    | 'exercises',
) {
  // Routed through openNavTab so a tab that has overflowed into its group's
  // menu is still one call away — no bridge dependency either way.
  await openNavTab(page, `tab-${tabName}`)
  await expect(page.locator(`#tab-${tabName}`)).toHaveClass(/active/, {
    timeout: 5000,
  })
}

/**
 * Switch between the sub-tabs inside the Settings panel (Account & App /
 * Singing / Display & Controls). The panel renders each sub-tab's content with
 * a Solid `<Show>`, so elements only exist in the DOM while their sub-tab is
 * active. Targets the stable `data-testid` + `aria-selected` on the tab button
 * rather than its visible label.
 */
export async function switchSettingsTab(
  page: Page,
  tab: 'account' | 'singing' | 'display',
) {
  const tabButton = page.locator(`[data-testid="settings-tab-${tab}"]`)
  await tabButton.click()
  await expect(tabButton).toHaveAttribute('aria-selected', 'true', {
    timeout: 5000,
  })
}

/**
 * Pin open the Singing control bar's "more" group (tempo / volume / speed),
 * which is collapsed by default. Idempotent. Call before interacting with
 * #tempo, #bpm-input, or #speed-select.
 */
export async function openSingingControls(page: Page) {
  const toggle = page.locator('[data-testid="singing-more-toggle"]')
  if ((await toggle.count()) === 0) return
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') {
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-expanded', 'true', {
      timeout: 5000,
    })
  }
}

/**
 * Expand the sidebar's "Playback Setup" section (the key / scale / octave
 * controls), which is collapsed by default. Idempotent. The section body is
 * rendered behind a Solid `<Show>`, so those controls do not exist in the DOM
 * until it's open — call this before asserting on `#key-select`,
 * `#scale-select` or the octave controls. Targets the header's stable
 * `data-collapsible` hook (also used by the guide tour to reveal sections).
 */
export async function openPlaybackSetup(page: Page) {
  const header = page.locator('[data-collapsible="sidebar-playback-open"]')
  if ((await header.count()) === 0) return
  if ((await header.getAttribute('aria-expanded')) !== 'true') {
    await header.click()
    await expect(header).toHaveAttribute('aria-expanded', 'true', {
      timeout: 5000,
    })
  }
}

export async function goToAndWait(page: Page, url: string) {
  await page.goto(url)
  await page.waitForLoadState('networkidle')
}

export async function expectVisible(page: Page, selector: string) {
  await expect(page.locator(selector)).toBeVisible()
}
