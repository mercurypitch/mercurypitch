// ============================================================
// Lesson 9's Sing it, driven as a viewer drives it
// ============================================================
//
// The steps of /learn/09's Sing it for its end-to-end specs: one with no
// fake microphone (learn-lesson-09-sing.spec.ts), and one for each sound
// the fake microphone plays, since Chromium takes the file at launch (a
// steady A3, a steady D3, and D3, F sharp 3, A3 and D4 in turn).
// `watchMic` counts each ask for the microphone and each track stopped,
// and can refuse the ask as a browser's prompt would.

import type { Locator, Page } from '@playwright/test'
import { expect } from '@playwright/test'

/** What the page asks of the microphone: each ask, and each track it stops. */
export async function watchMic(page: Page, refuse = false): Promise<void> {
  await page.addInitScript((refused) => {
    const w = window as unknown as { micAsks: number; trackStops: number }
    w.micAsks = 0
    w.trackStops = 0
    const stop = MediaStreamTrack.prototype.stop
    MediaStreamTrack.prototype.stop = function (this: MediaStreamTrack) {
      w.trackStops += 1
      stop.call(this)
    }
    const media = navigator.mediaDevices as MediaDevices | undefined
    if (media === undefined) return
    const ask = media.getUserMedia.bind(media)
    media.getUserMedia = (constraints) => {
      w.micAsks += 1
      if (refused)
        return Promise.reject(
          new DOMException('Permission denied', 'NotAllowedError'),
        )
      return ask(constraints)
    }
  }, refuse)
}

export const micAsks = (page: Page): Promise<number> =>
  page.evaluate(() => (window as unknown as { micAsks: number }).micAsks)
export const trackStops = (page: Page): Promise<number> =>
  page.evaluate(() => (window as unknown as { trackStops: number }).trackStops)

/** Opens Sing it with the lower voice stored, as an earlier lesson stores it, and answers the comfort check. */
export async function toSing(
  page: Page,
  comfort: 'sing' | 'listen' = 'sing',
): Promise<void> {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('l09.seeded') === '1') return
    sessionStorage.setItem('l09.seeded', '1')
    localStorage.setItem('fyp-voice', JSON.stringify('lower'))
  })
  await page.goto('/learn/09#sing')
  await page.locator(`[data-comfort="${comfort}"]`).click()
}

export const status = (page: Page): Locator => page.locator('#singStatus')
export const prepare = (page: Page): Locator =>
  page.locator('[data-panel="prepare"]')
export const start = (page: Page): Locator =>
  prepare(page).locator('[data-sing="start"]')
export const after = (page: Page, button: string): Locator =>
  page.locator(`[data-panel="after"] [data-sing="${button}"]`)
export const ending = (page: Page, which: 'practise' | 'rest'): Locator =>
  page.locator(`#practiseCard [data-ending="${which}"]`)
export const feel = (page: Page, f: string): Promise<void> =>
  page.locator(`[data-panel="feel"] [data-feel="${f}"]`).click()

/** The status line while the take listens. */
export const TAKE_LINE =
  "Your turn: start on do when you're ready. Move on each time the next band lights up."

/**
 * Presses `button` as a viewer taps it, already on screen. The lesson pages
 * scroll smoothly, so Playwright's own scroll to a button glides, and its
 * click can land with several hundred px of the glide still to run: as
 * Start's card shrinks for the take, that carries Sing it off screen long
 * enough for the page to count the viewer gone and end the take. A
 * viewer's tap lands on a page at rest, and a tap on Start at the edge of
 * the screen loses no take (learn-lesson-09-sing-edge.spec.ts), so the
 * button is brought to the middle of the screen at once, before the click.
 */
export async function tap(button: Locator): Promise<void> {
  await button.evaluate((el) =>
    el.scrollIntoView({ block: 'center', behavior: 'instant' }),
  )
  await button.click()
}

/** Presses `button`, waits through Merc's ladder and the take, and gives the reading's lines. */
export async function take(page: Page, button: Locator): Promise<string[]> {
  await tap(button)
  await expect(status(page)).toHaveText(TAKE_LINE, { timeout: 20_000 })
  await expect(status(page)).toHaveText('How did that feel?', {
    timeout: 30_000,
  })
  return page.locator('[data-readings] li').allTextContents()
}

/** Waits until the microphone's tracks have stopped more often than `before`. */
export async function tracksStop(page: Page, before: number): Promise<void> {
  await expect
    .poll(() => trackStops(page), { timeout: 5_000 })
    .toBeGreaterThan(before)
}

/** Presses Start and waits until the take listens: the tracks' stops so far. */
export async function listening(page: Page): Promise<number> {
  await tap(start(page))
  await expect(status(page)).toHaveText(TAKE_LINE, { timeout: 20_000 })
  return trackStops(page)
}
