// ============================================================
// Lesson 7's Sing it, driven as a viewer drives it
// ============================================================
//
// The steps of /learn/07's Sing it for its two end-to-end specs, one for
// each sound the fake microphone plays (learn-lesson-07-sing.spec.ts, a
// siren gliding from E3 up to E4 and back; learn-lesson-07-sing-a3.spec.ts,
// a steady A3): Chromium takes the file at launch, so each spec has its
// own. `watchMic` counts each ask for the microphone and each track
// stopped, and can refuse the ask as a browser's prompt would.

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

/**
 * Opens Sing it with a voice stored as an earlier lesson stores it, and
 * answers the comfort check: "Sing along" by default, or "Just listen
 * today".
 */
export async function toSing(
  page: Page,
  comfort: 'sing' | 'listen' = 'sing',
): Promise<void> {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('l07.seeded') === '1') return
    sessionStorage.setItem('l07.seeded', '1')
    localStorage.setItem('fyp-voice', JSON.stringify('lower'))
  })
  await page.goto('/learn/07#sing')
  await page.locator(`[data-comfort="${comfort}"]`).click()
  if (comfort === 'sing')
    await expect(page.locator('[data-panel="prepare"]')).toBeVisible()
}

export const status = (page: Page): Locator => page.locator('#singStatus')
export const start = (page: Page): Locator =>
  page.locator('[data-panel="prepare"] [data-sing="start"]')
export const again = (page: Page): Locator =>
  page.locator('[data-panel="after"] [data-sing="again"]')

/** Plays Merc's siren to its end: 6 s. */
export async function playMerc(page: Page): Promise<void> {
  await page.locator('[data-panel="prepare"] [data-merc-siren]').click()
  await expect(status(page)).toHaveText(
    'Merc sings the siren on “ng”: listen to the way it slides.',
  )
  await expect(status(page)).not.toHaveText(/^Merc sings/, { timeout: 20_000 })
}

/** Presses Start or Again, and waits for that take's reading. */
export async function take(page: Page, button: Locator): Promise<string> {
  await button.click()
  await expect(status(page)).toHaveText(
    'Breathe, then hum one siren on “ng”, up and back. We stop listening when you stop.',
    { timeout: 10_000 },
  )
  const reading = page.locator('[data-reading]')
  await expect(reading).toBeVisible({ timeout: 30_000 })
  return (await page.locator('[data-reading-line]').textContent()) ?? ''
}

export const feel = (page: Page, f: string): Promise<void> =>
  page.locator(`[data-panel="feel"] [data-feel="${f}"]`).click()

export const ending = (page: Page, which: 'practise' | 'rest'): Locator =>
  page.locator(`#practiseCard [data-ending="${which}"]`)
