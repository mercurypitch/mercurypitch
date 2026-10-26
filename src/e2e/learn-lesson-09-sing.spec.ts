// ============================================================
// Lesson 9 Sing it — the card in the browser, the microphone counted
// ============================================================
//
// WEB-SPEC's end-to-end check 6 (Tests), its parts that need no voice:
// "Just listen today" never calls `navigator.mediaDevices.getUserMedia` (a
// spy), even with Merc's ladder played, shows its line and the doctor
// lines, and leaves the rest card in the Wrap; and with the sound off,
// Start asks for no microphone and its hint says the sound is off, naming
// Start. The voice is stored as an earlier lesson stores it, so the card
// goes from the comfort check straight to its path.

import type { Locator, Page } from '@playwright/test'
import { expect, test } from './helpers/lesson-page'

/** Counts each ask for the microphone, from before the page's first script. */
async function watchMic(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { micAsks: number }
    w.micAsks = 0
    const media = navigator.mediaDevices as MediaDevices | undefined
    if (media === undefined) return
    const ask = media.getUserMedia.bind(media)
    media.getUserMedia = (constraints) => {
      w.micAsks += 1
      return ask(constraints)
    }
  })
}

const micAsks = (page: Page): Promise<number> =>
  page.evaluate(() => (window as unknown as { micAsks: number }).micAsks)

/** Opens Sing it with the lower voice stored, and answers the comfort check. */
async function toSing(page: Page, comfort: 'sing' | 'listen'): Promise<void> {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('l09.seeded') === '1') return
    sessionStorage.setItem('l09.seeded', '1')
    localStorage.setItem('fyp-voice', JSON.stringify('lower'))
  })
  await page.goto('/learn/09#sing')
  await page.locator(`[data-comfort="${comfort}"]`).click()
}

const status = (page: Page): Locator => page.locator('#singStatus')
const prepare = (page: Page): Locator => page.locator('[data-panel="prepare"]')
const ending = (page: Page, which: 'practise' | 'rest'): Locator =>
  page.locator(`#practiseCard [data-ending="${which}"]`)

test('"Just listen today" never asks for the microphone, even with Merc\'s ladder played, and rests the Wrap', async ({
  page,
}) => {
  await watchMic(page)

  await toSing(page, 'listen')
  const play = prepare(page).locator('[data-merc-ladder]')
  await play.click()

  await expect(status(page)).toHaveText(
    'Good call. Merc sings the ladder, and nothing listens. Rest your voice.',
  )
  await expect(page.locator('.doctor[data-listen-why="listen"]')).toBeVisible()
  await expect(prepare(page).locator('[data-sing="start"]')).toBeHidden()
  await expect(page.locator('#warmup')).toBeHidden()
  await expect(play).toHaveClass(/is-on/)
  await expect(ending(page, 'rest')).toBeVisible()
  await expect(ending(page, 'practise')).toBeHidden()
  expect(await micAsks(page)).toBe(0)
})

test('with sound off, Start asks for no microphone, and its hint says sound is off', async ({
  page,
}) => {
  await watchMic(page)
  await toSing(page, 'sing')
  // the switch turns sound on from unset, then off
  await page.locator('#soundSwitch').click()
  await page.locator('#soundSwitch').click()
  await expect(page.locator('#soundSwitch')).toHaveAttribute(
    'aria-pressed',
    'false',
  )

  await prepare(page).locator('[data-sing="start"]').click()

  await expect(page.locator('[data-start-hint]')).toHaveText(
    "Sound is off, so nothing played. Turn sound on to hear Merc's ladder, then press Start.",
  )
  await expect(page.locator('[data-start-hint]')).toBeVisible()
  await expect(status(page)).toHaveText('Your turn: do-mi-so-do, slowly.')
  expect(await micAsks(page)).toBe(0)
})
