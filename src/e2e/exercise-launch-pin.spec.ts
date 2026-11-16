// ============================================================
// The pinned launch button on a phone: what scrolls under it fades
// ============================================================
//
// On a phone the stage pins Start / Try Again to the sheet's edge, so the
// microphone is always on screen (ExerciseStage.module.css). Pinned, it
// lies over what scrolls under it: under Try Again the last line of Sing
// It in Time's result ran into the button, and so did the Clef chips in
// Sight-Singing's. The sheet now draws a scrim behind the button while it
// is pinned and none at rest (src/features/exercises/stage/launch-pin.ts).
// This walks both edges on a phone's screen: a setup taller than the sheet,
// and a result taller than the sheet from a real run on a fake microphone.

import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { fakeMicArgs, writeToneWav } from './helpers/tone-wav'
import { dismissOverlays, openNavTab, waitForNav } from './helpers/ui'

// Written at module load: Chromium needs the file before it launches, and
// without a microphone the drill never leaves its setup.
const TONE_WAV = writeToneWav()

test.use({
  launchOptions: { args: fakeMicArgs(TONE_WAV) },
  permissions: ['microphone'],
})

const PHONE = { width: 390, height: 844 }

interface Pin {
  /** The scrim's mark: the edge the button is pinned to, or null. */
  pinned: string | null
  /** Whether the scrim's layer is drawn at all. */
  drawn: boolean
  /** The band at the marked edge, in viewport px; null when none is drawn. */
  band: { top: number; bottom: number; left: number; right: number } | null
  button: { top: number; bottom: number }
  sheet: { top: number; bottom: number; left: number; right: number }
  /** How far the sheet can still scroll. */
  remaining: number
}

/** What a look at the sheet's foot or top would find. */
async function readPin(page: Page): Promise<Pin> {
  return page.locator('.exercise-canvas-area').evaluate((sheet) => {
    const box = (el: Element) => {
      const r = el.getBoundingClientRect()
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right }
    }
    const scrim = sheet.querySelector<HTMLElement>('.exercise-launch-scrim')
    const button = sheet.querySelector<HTMLElement>('.exercise-idle-start')
    if (scrim === null || button === null) throw new Error('no launch')
    const pinned = scrim.getAttribute('data-pinned')
    const drawn = getComputedStyle(scrim).display !== 'none'
    let band: Pin['band'] = null
    if (drawn && pinned !== null) {
      // A pseudo-element has no box to ask for: its band is the layer's
      // width, at the sheet's edge, as tall as the style sheet makes it.
      const style = getComputedStyle(
        scrim,
        pinned === 'top' ? '::before' : '::after',
      )
      const height = Number.parseFloat(style.height)
      const layer = scrim.getBoundingClientRect()
      const edge = sheet.getBoundingClientRect()
      band =
        Number(style.opacity) < 1
          ? null
          : pinned === 'top'
            ? {
                top: edge.top,
                bottom: edge.top + height,
                left: layer.left,
                right: layer.right,
              }
            : {
                top: edge.bottom - height,
                bottom: edge.bottom,
                left: layer.left,
                right: layer.right,
              }
    }
    return {
      pinned,
      drawn,
      band,
      button: box(button),
      sheet: box(sheet),
      remaining: sheet.scrollHeight - sheet.clientHeight - sheet.scrollTop,
    }
  })
}

async function openDrill(page: Page, title: string): Promise<void> {
  await page.addInitScript(() => {
    ;(window as unknown as { E2E_TEST_MODE?: boolean }).E2E_TEST_MODE = true
    localStorage.setItem('pitchperfect_advanced_features', 'true')
  })
  await page.setViewportSize(PHONE)
  await page.goto('/')
  await waitForNav(page)
  await dismissOverlays(page)
  await openNavTab(page, 'tab-exercises')
  await page.locator('.exercise-card', { hasText: title }).first().click()
  await expect(page.locator('.exercise-idle-start')).toBeVisible({
    timeout: 10000,
  })
}

const scrollSheet = (page: Page, to: 'top' | 'end'): Promise<void> =>
  page.locator('.exercise-canvas-area').evaluate((sheet, where) => {
    sheet.scrollTop =
      where === 'end' ? sheet.scrollHeight - sheet.clientHeight : 0
  }, to)

test('a setup taller than the sheet fades under Start once it scrolls, and not before', async ({
  page,
}) => {
  // Slide's two dials are taller than a phone's sheet.
  await openDrill(page, 'Slide In/Out')

  const atRest = await readPin(page)
  expect(atRest.remaining).toBeGreaterThan(40)
  expect(atRest.pinned).toBeNull()
  expect(atRest.drawn).toBe(false)

  await scrollSheet(page, 'end')
  await expect
    .poll(async () => (await readPin(page)).pinned, { timeout: 5000 })
    .toBe('top')
  const pinned = await readPin(page)
  // The band spans the sheet and reaches below the button it lies behind.
  expect(pinned.band).not.toBeNull()
  expect(pinned.band!.left).toBeLessThanOrEqual(pinned.sheet.left + 2)
  expect(pinned.band!.right).toBeGreaterThanOrEqual(pinned.sheet.right - 2)
  expect(pinned.band!.top).toBeLessThanOrEqual(pinned.button.top)
  expect(pinned.band!.bottom).toBeGreaterThan(pinned.button.bottom + 12)

  await scrollSheet(page, 'top')
  await expect
    .poll(async () => (await readPin(page)).pinned, { timeout: 5000 })
    .toBeNull()
  expect((await readPin(page)).drawn).toBe(false)
})

test('a result taller than the sheet fades under Try Again, until the sheet scrolls it into place', async ({
  page,
}) => {
  test.slow()
  // Sing It in Time's result lists every note of three tunes.
  await openDrill(page, 'Sing It in Time')

  await page.locator('.exercise-idle-start').click()
  const stop = page.locator('.exercise-btn-stop')
  await expect(stop).toBeVisible({ timeout: 20000 })
  const startedAt = Date.now()
  await expect.poll(() => Date.now() - startedAt).toBeGreaterThan(1500)
  await stop.click()
  await expect(page.locator('.exercise-result-card')).toBeVisible({
    timeout: 15000,
  })

  await expect
    .poll(async () => (await readPin(page)).pinned, { timeout: 5000 })
    .toBe('bottom')
  const pinned = await readPin(page)
  expect(pinned.remaining).toBeGreaterThan(40)
  // The band spans the sheet, starts above the button and ends at the
  // sheet's foot, under it.
  expect(pinned.band).not.toBeNull()
  expect(pinned.band!.left).toBeLessThanOrEqual(pinned.sheet.left + 2)
  expect(pinned.band!.right).toBeGreaterThanOrEqual(pinned.sheet.right - 2)
  expect(pinned.band!.top).toBeLessThan(pinned.button.top - 12)
  expect(pinned.band!.bottom).toBeGreaterThanOrEqual(pinned.button.bottom)

  // Scrolled to its end the sheet has the button in its own place.
  await scrollSheet(page, 'end')
  await expect
    .poll(async () => (await readPin(page)).pinned, { timeout: 5000 })
    .toBeNull()
  expect((await readPin(page)).drawn).toBe(false)
})
