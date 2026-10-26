// ============================================================
// Short labels are not cut where there is room for them
// ============================================================
// An ellipsis on a long song title in a fixed row is by design. These three
// were short, and were cut beside room they could not use:
//
//  - Drum Night's count-in, on a desktop: "4 beats" read "4 be..." because
//    the words left the module's third column, kept for the Kit's chevron,
//    empty;
//  - Guitar's song name, on a phone: "C Major Scale (C4)" was capped at
//    150 px with 70 px of the row free;
//  - Piano Night's line under the title, on a phone: "bars 1–4 · Afterglow
//    Studio" was capped at a quarter of the screen in a column with room.
//
// Each is measured as text that needs no more width than it is given.

import type { Locator, Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { dismissOverlays } from './helpers/ui'

/** Width the text needs, and width it is given. */
const widths = (text: Locator): Promise<[number, number]> =>
  text.evaluate((element) => [element.scrollWidth, element.clientWidth])

async function open(page: Page, path: string): Promise<void> {
  await page.route(
    (url) => url.hostname !== '127.0.0.1' && url.hostname !== 'localhost',
    (route) => route.abort(),
  )
  await page.addInitScript(() => {
    ;(window as unknown as Record<string, unknown>).E2E_TEST_MODE = true
  })
  await page.goto(path)
}

test.describe('on a desktop', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test("shows Drum Night's count-in whole", async ({ page }) => {
    // Arrange
    await open(page, '/drum-night')
    const countIn = page.getByRole('button', {
      name: 'Count-in: 4 audible beats',
    })
    await expect(countIn).toBeVisible()
    const value = countIn.locator('strong')
    await expect(value).toHaveText('4 beats')

    // Act
    const [needs, given] = await widths(value)

    // Assert
    expect(needs).toBeLessThanOrEqual(given)
  })
})

test.describe('on a phone', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  })

  test("shows Guitar's song name whole", async ({ page }) => {
    // Arrange
    await open(page, '/#/guitar')
    await dismissOverlays(page)
    const song = page
      .getByTestId('gp-song-status-bar')
      .getByRole('button', { name: 'C Major Scale (C4)' })
    await expect(song).toBeVisible()

    // Act
    const [needs, given] = await widths(song.locator('span').first())

    // Assert
    expect(needs).toBeLessThanOrEqual(given)
  })

  test("shows Piano Night's line under the title whole", async ({ page }) => {
    // Arrange
    await open(page, '/piano-night')
    const line = page.getByText(/^bars 1–4 · /)
    await expect(line).toBeVisible()

    // Act
    const [needs, given] = await widths(line)

    // Assert
    expect(needs).toBeLessThanOrEqual(given)
  })
})
