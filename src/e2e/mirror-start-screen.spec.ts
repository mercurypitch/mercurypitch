// ============================================================
// Voice Mirror start screen: the picture each window asks for
// ============================================================
//
// The start screen stands on Merc's sky, cut twice like the onboarding's
// plates: a 941 px wide tall cut for a phone held upright, a 1672 px wide one
// for everything wider than it is tall. A phone must never download the wide
// cut (mirror.css picks by aspect ratio), and the one primary action must sit
// above a phone's fold. A phone's loading screen asks for no picture at all:
// one downloading beside the app's JavaScript cost the start screen 0.6 s of
// Largest Contentful Paint on Lighthouse's mobile run.

import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

/** The onboarding plates this page has asked for, by file name. */
function watchPlates(page: Page): string[] {
  const plates: string[] = []
  page.on('request', (request) => {
    const match = /\/onboarding\/([\w-]+\.webp)$/.exec(
      new URL(request.url()).pathname,
    )
    if (match) plates.push(match[1])
  })
  return plates
}

test.describe('the loading screen on a phone held upright', () => {
  // With JavaScript off the loading screen is all there is, and it stays.
  test.use({
    viewport: { width: 375, height: 667 },
    isMobile: true,
    javaScriptEnabled: false,
  })

  test('asks for no picture', async ({ page }) => {
    const pictures: string[] = []
    page.on('request', (request) => {
      const { pathname } = new URL(request.url())
      if (pathname.endsWith('.webp')) pictures.push(pathname)
    })
    // Pictures a stylesheet names hold the load event until they arrive.
    await page.goto('/vocal-range-test', { waitUntil: 'load' })

    await expect(page.locator('.entry-prelude h1')).toHaveText(/vocal range/i)
    expect(pictures).toEqual([])
  })
})

test.describe('on a phone held upright', () => {
  test.use({
    viewport: { width: 375, height: 667 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  })

  test('asks for the tall cut only and keeps the pill above the fold', async ({
    page,
  }) => {
    const plates = watchPlates(page)
    await page.goto('/vocal-range-test')

    const pill = page.locator('.mirror-pill')
    await expect(pill).toHaveText('Test my vocal range')
    await expect.poll(() => plates).toContain('merc-sky-tall.webp')
    expect(plates).not.toContain('merc-sky-wide.webp')

    const box = await pill.boundingBox()
    expect(box).not.toBeNull()
    expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(667)

    const sideways = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    )
    expect(sideways).toBe(false)
  })
})

test.describe('on a wide window', () => {
  test.use({ viewport: { width: 1366, height: 768 } })

  test('asks for the wide cut only', async ({ page }) => {
    const plates = watchPlates(page)
    await page.goto('/mirror')

    await expect(page.locator('.mirror-pill')).toHaveText('Find my voice twin')
    await expect.poll(() => plates).toContain('merc-sky-wide.webp')
    expect(plates).not.toContain('merc-sky-tall.webp')
  })
})
