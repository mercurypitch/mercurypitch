// ============================================================
// theme — switch the app's theme mid-test the way a device does
// ============================================================
//
// Setting `data-theme` on <html> by hand gives a half-light page: the app's
// theme signal, `color-scheme` (native selects, checkboxes, scrollbars) and
// `prefers-color-scheme` all stay dark. app-check's `openContext` seeds
// `pitchperfect_theme` and the colour scheme before the page loads, which
// cannot change the theme once a test is under way. So a spec that shoots
// both themes in one run seeds the app's own Follow system setting instead,
// and `switchTheme` changes the emulated colour scheme: the theme store then
// applies the preset itself (`syncAutoTheme`), writes `pitchperfect_theme`,
// and sets `data-theme` and `color-scheme` together, as on a phone that
// turns dark at night.

import { expect, type Page } from '@playwright/test'

export type ShotTheme = 'dark' | 'light'

/** Before the first `goto`: the app follows the device, light by day and
 *  dark by night, and the device starts dark, the app's own default. */
export async function followDeviceTheme(page: Page): Promise<void> {
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.addInitScript(() => {
    localStorage.setItem('pitchperfect_theme', 'dark')
    localStorage.setItem('pitchperfect_theme_source', 'system')
    localStorage.setItem('pitchperfect_theme_auto_day', 'light')
    localStorage.setItem('pitchperfect_theme_auto_night', 'dark')
  })
}

/**
 * Turn the device to `theme`, wait for the app to follow it everywhere it
 * keeps a theme, then wait out every colour transition so a screenshot
 * shows the landed colours (MISTAKES.md, "Let a theme switch settle").
 */
export async function switchTheme(page: Page, theme: ShotTheme): Promise<void> {
  await page.emulateMedia({ colorScheme: theme })
  await expect
    .poll(() =>
      page.evaluate(() => ({
        attribute: document.documentElement.getAttribute('data-theme'),
        colorScheme: getComputedStyle(document.documentElement).colorScheme,
        stored: localStorage.getItem('pitchperfect_theme'),
      })),
    )
    .toEqual({ attribute: theme, colorScheme: theme, stored: theme })
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((animation) => animation instanceof CSSTransition)
        .map((animation) => animation.finished.catch(() => undefined)),
    ),
  )
}
