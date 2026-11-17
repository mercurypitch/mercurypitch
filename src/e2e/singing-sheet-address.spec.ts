// ============================================================
// The sheet address: #/singing/sheet opens the Singing tab's sheet, in a key
// ============================================================
//
// A lesson's card links the Singing tab on its sheet view, read in a key the
// lesson names: `/?lesson=21#/singing/sheet?key=Bb`. The route is in
// src/lib/hash-router.ts, what its words name in src/lib/sheet-address.ts,
// and what it sets in src/stores/singing-sheet-store.ts; unit tests reach
// each. Only a browser reaches the cold load, where the address is read
// before the app has its first melody, and that melody brings a key of its
// own.
//
// Every test here is a fresh browser profile, as it is for a lesson's
// first-time visitor. On a phone held upright the tab has no sheet view
// (the phone stage stands in for the desktop panel, src/App.tsx), so there
// the address opens the roll in the key and nothing on screen promises a
// sheet.

import type { Locator, Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { openPlaybackSetup, skipTheIntro } from './helpers/ui'

/** First Light, by the name its dialog announces. */
const intro = (page: Page): Locator =>
  page.getByRole('dialog', { name: 'Welcome to MercuryPitch' })

/** The sheet view's heading: its key in words, over the melody's name. */
const sheetHeading = (page: Page): Locator =>
  page.locator('#practice-panel').getByText(/^Live score · /)

const notationButton = (page: Page): Locator =>
  page.getByTestId('practice-view-toolbar').getByRole('button', {
    name: 'Notation',
  })

test.describe('at a desk', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('/?lesson=21#/singing/sheet?key=Bb opens the sheet in B flat major, over no intro', async ({
    page,
  }) => {
    await page.goto('/?lesson=21#/singing/sheet?key=Bb')

    await expect(sheetHeading(page)).toHaveText('Live score · B♭ major')
    await expect(notationButton(page)).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByTestId('sheet-melody-name')).toBeVisible()
    // The address was a one-shot: the marker stays, and the tab's own hash.
    await expect(page).toHaveURL(/\/\?lesson=21#\/singing$/)

    // The key picker says the same key, by a real flat sign.
    await openPlaybackSetup(page)
    await expect(page.locator('#key-select')).toHaveValue('Bb')
    await expect(page.locator('#key-select option:checked')).toHaveText('B♭')
    await expect(page.locator('#scale-select')).toHaveValue('major')

    await page.waitForLoadState('networkidle')
    await expect(intro(page)).toHaveCount(0)
  })

  test('a minor key is read by its own do, and the picker lists the minor keys', async ({
    page,
  }) => {
    await page.goto('/?lesson=25#/singing/sheet?key=A&scale=harmonic-minor')

    await expect(sheetHeading(page)).toHaveText('Live score · A harmonic minor')
    await openPlaybackSetup(page)
    await expect(page.locator('#key-select')).toHaveValue('A')
    await expect(page.locator('#scale-select')).toHaveValue('harmonic-minor')
    await expect(page.locator('#key-select option')).toHaveText([
      'A',
      'E',
      'B',
      'F♯',
      'C♯',
      'G♯',
      'D♯',
      'D',
      'G',
      'C',
      'F',
      'B♭',
    ])
  })

  test("the sheet is the toolbar's own switch: the roll comes back, and a reload opens the roll", async ({
    page,
  }) => {
    await page.goto('/?lesson=18#/singing/sheet')
    await expect(page.getByTestId('sheet-melody-name')).toBeVisible()
    // No key named: the melody the app opens on keeps its own.
    await expect(sheetHeading(page)).toHaveText('Live score · C major')

    await page
      .getByTestId('practice-view-toolbar')
      .getByRole('button', { name: 'Melody' })
      .click()
    await expect(page.getByTestId('sheet-melody-name')).toHaveCount(0)
    await expect(page.locator('#canvas-container canvas').first()).toBeVisible()

    // Nothing stored the view: the address left behind is the tab's.
    await page.goto('/?lesson=18#/singing/sheet')
    await expect(page.getByTestId('sheet-melody-name')).toBeVisible()
    await page.reload()
    await expect(page.locator('#canvas-container canvas').first()).toBeVisible()
    await expect(page.getByTestId('sheet-melody-name')).toHaveCount(0)
  })

  test("on a later visit the melody that comes back first does not take the address's key", async ({
    page,
  }) => {
    // The first visit leaves its melody, a C major scale, for the next load
    // to restore before the route is read.
    await page.goto('/?lesson=21#/singing')
    await expect(page.locator('#canvas-container canvas').first()).toBeVisible()
    await page.goto('about:blank')

    await page.goto('/?lesson=21#/singing/sheet?key=D')

    await expect(sheetHeading(page)).toHaveText('Live score · D major')
  })

  test('a first visit with no marker meets the intro, and the sheet in its key is under it', async ({
    page,
  }) => {
    await page.goto('/#/singing/sheet?key=G')

    await expect(intro(page)).toBeVisible()
    await skipTheIntro(page)

    await expect(intro(page)).toHaveCount(0)
    await expect(sheetHeading(page)).toHaveText('Live score · G major')
    await expect(notationButton(page)).toHaveAttribute('aria-pressed', 'true')
  })

  test('the address opens the sheet from inside the app, over the roll already open', async ({
    page,
  }) => {
    await page.goto('/?lesson=21#/singing')
    await expect(page.locator('#canvas-container canvas').first()).toBeVisible()

    await page.evaluate(() => {
      window.location.hash = '#/singing/sheet?key=F%23'
    })

    await expect(sheetHeading(page)).toHaveText('Live score · F♯ major')
    await expect(page).toHaveURL(/#\/singing$/)
  })
})

test.describe('on a phone held upright', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  })

  test('the address opens the roll in the key, and nothing promises a sheet', async ({
    page,
  }) => {
    await page.goto('/?lesson=21#/singing/sheet?key=Bb')

    const stage = page.getByTestId('singing-mobile-stage')
    await expect(stage).toBeVisible()
    await expect(
      stage.getByRole('button', { name: 'Key, scale and playback options' }),
    ).toContainText('B♭ Major')
    await expect(
      stage.locator('[data-stage-canvas] canvas').first(),
    ).toBeVisible()
    await expect(page.getByTestId('practice-view-toolbar')).toHaveCount(0)
    await expect(page.getByTestId('sheet-melody-name')).toHaveCount(0)
    await expect(stage).not.toContainText(/sheet|notation/i)

    await page.waitForLoadState('networkidle')
    await expect(intro(page)).toHaveCount(0)
  })

  test('its options offer the twelve keys, by their flats', async ({
    page,
  }) => {
    await page.goto('/?lesson=21#/singing/sheet?key=Bb')
    const stage = page.getByTestId('singing-mobile-stage')
    await stage
      .getByRole('button', { name: 'Key, scale and playback options' })
      .click()

    const key = page
      .getByRole('dialog', { name: 'Practice options' })
      .locator('select')
      .first()
    await expect(key).toHaveValue('Bb')
    await expect(key.locator('option')).toHaveText([
      'C',
      'G',
      'D',
      'A',
      'E',
      'B',
      'F♯',
      'F',
      'B♭',
      'E♭',
      'A♭',
      'D♭',
    ])
  })

  test('on a wider screen the sheet is there, in the key', async ({ page }) => {
    await page.goto('/?lesson=21#/singing/sheet?key=Bb')
    await expect(page.getByTestId('singing-mobile-stage')).toBeVisible()

    // A tablet turned on its side: the desktop panel, and its switch was set.
    await page.setViewportSize({ width: 1024, height: 768 })

    await expect(page.getByTestId('singing-mobile-stage')).toHaveCount(0)
    await expect(sheetHeading(page)).toHaveText('Live score · B♭ major')
  })
})
