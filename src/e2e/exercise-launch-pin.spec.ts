// ============================================================
// The launch button in its sheet: always on screen, and what scrolls
// under it fades
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
//
// Off a phone nothing held the button in sight: after a run of Sing It in
// Time, Try Again was under the fold at 1440 x 900 and further under it on
// a laptop (seen on the dev site, 17 November 2026). A sheet whose own
// layout would hide its launch is now laid out as a phone's, and one that
// shows it is left as it was. This runs the drill at both sizes and looks
// for the button where a singer would.

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
const DESK = { width: 1440, height: 900 }
/** A 1366 x 768 laptop, less the browser's own bars. */
const LAPTOP = { width: 1366, height: 650 }

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

async function openDrill(
  page: Page,
  title: string,
  size: { width: number; height: number } = PHONE,
): Promise<void> {
  await page.addInitScript(() => {
    ;(window as unknown as { E2E_TEST_MODE?: boolean }).E2E_TEST_MODE = true
    localStorage.setItem('pitchperfect_advanced_features', 'true')
  })
  await page.setViewportSize(size)
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

// ── Off a phone ───────────────────────────────────────────────────────

interface Edges {
  top: number
  bottom: number
  left: number
  right: number
}

interface WideSheet {
  /** The sheet is laid out as a phone's: its own layout hid the launch. */
  stacked: boolean
  sheet: Edges
  button: Edges
  result: Edges | null
  setup: Edges | null
}

/** Where a look at a wide sheet finds the button, the result and the setup. */
async function readWide(page: Page): Promise<WideSheet> {
  return page.locator('.exercise-canvas-area').evaluate((sheet) => {
    const box = (el: Element | null) => {
      if (el === null) return null
      const r = el.getBoundingClientRect()
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right }
    }
    const button = box(sheet.querySelector('.exercise-idle-start'))
    const own = box(sheet)
    if (button === null || own === null) throw new Error('no launch')
    return {
      stacked: sheet.hasAttribute('data-stacked'),
      sheet: own,
      button,
      result: box(sheet.querySelector('.exercise-result-card')),
      setup: box(sheet.querySelector('.exercise-idle-setup')),
    }
  })
}

/** A short run on the fake microphone, stopped, with its result up. */
async function runAndStop(page: Page): Promise<void> {
  await page.locator('.exercise-idle-start').click()
  const stop = page.locator('.exercise-btn-stop')
  await expect(stop).toBeVisible({ timeout: 20000 })
  const startedAt = Date.now()
  await expect.poll(() => Date.now() - startedAt).toBeGreaterThan(1500)
  await stop.click()
  await expect(page.locator('.exercise-result-card')).toBeVisible({
    timeout: 15000,
  })
}

/** The button is whole inside the sheet's visible box. */
function expectOnScreen(look: WideSheet): void {
  expect(look.button.top).toBeGreaterThanOrEqual(look.sheet.top)
  expect(look.button.bottom).toBeLessThanOrEqual(look.sheet.bottom)
}

test('on a wide screen a result that leaves the sheet no room for Try Again stacks it, button on screen', async ({
  page,
}) => {
  test.slow()
  await openDrill(page, 'Sing It in Time', DESK)

  // At rest the sheet is its own: the tune over Start, all of it in sight.
  const atRest = await readWide(page)
  expect(atRest.stacked).toBe(false)
  expectOnScreen(atRest)
  expect(atRest.setup!.bottom).toBeLessThanOrEqual(atRest.button.top)

  await runAndStop(page)
  await expect
    .poll(async () => (await readWide(page)).stacked, { timeout: 5000 })
    .toBe(true)
  const after = await readWide(page)
  // Try Again is on screen, under the result and before the next tune.
  expectOnScreen(after)
  expect(after.result!.top).toBeLessThan(after.button.top)
  expect(after.button.top).toBeLessThan(after.setup!.top)
  // It is a button's width, not the sheet's.
  expect(after.button.right - after.button.left).toBeLessThanOrEqual(332)
})

test('in a laptop window Try Again is held to the foot of the sheet, over a faded result', async ({
  page,
}) => {
  test.slow()
  await openDrill(page, 'Sing It in Time', LAPTOP)
  const atRest = await readWide(page)
  expect(atRest.stacked).toBe(false)
  expectOnScreen(atRest)

  await runAndStop(page)
  await expect
    .poll(async () => (await readPin(page)).pinned, { timeout: 5000 })
    .toBe('bottom')
  const after = await readWide(page)
  expect(after.stacked).toBe(true)
  expectOnScreen(after)
  // The result runs under the button, into the band behind it.
  const pin = await readPin(page)
  expect(after.result!.bottom).toBeGreaterThan(after.button.top)
  expect(pin.band).not.toBeNull()
  expect(pin.band!.left).toBeLessThanOrEqual(pin.sheet.left + 2)
  expect(pin.band!.right).toBeGreaterThanOrEqual(pin.sheet.right - 2)
  expect(pin.band!.top).toBeLessThan(pin.button.top - 12)
  expect(pin.band!.bottom).toBeGreaterThanOrEqual(pin.button.bottom)

  // Scrolled to its end, the sheet still has the button on screen.
  await scrollSheet(page, 'end')
  await expect
    .poll(async () => (await readPin(page)).pinned, { timeout: 5000 })
    .not.toBe('bottom')
  expectOnScreen(await readWide(page))

  // A phone's width takes the sheet over: the mark goes, the button stays.
  await page.setViewportSize(PHONE)
  await expect
    .poll(async () => (await readWide(page)).stacked, { timeout: 5000 })
    .toBe(false)
  expectOnScreen(await readWide(page))
})

test('a result that fits leaves a wide sheet as it was: Try Again beside the dial, nothing marked', async ({
  page,
}) => {
  test.slow()
  await openDrill(page, 'Pitch Hold', DESK)
  await runAndStop(page)
  // Give the sheet the frame it would take to stack, were it going to.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  )
  const after = await readWide(page)
  expect(after.stacked).toBe(false)
  expectOnScreen(after)
  // The shell's row: the dial on one side, the launch on the other.
  expect(after.setup!.right).toBeLessThanOrEqual(after.button.left)
  const pin = await readPin(page)
  expect(pin.pinned).toBeNull()
  expect(pin.drawn).toBe(false)
})
