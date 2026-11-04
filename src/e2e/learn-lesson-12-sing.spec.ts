// ============================================================
// Lesson 12 Sing it, end to end — every state, and nothing listening
// ============================================================
//
// WEB-SPEC, End to end 7 and 8, at a phone's size and a desktop's, on the
// e2e bundle, which shows drafts: the comfort check shows first, every
// visit; with no stored voice the voice choice follows either answer under
// its first line, and nothing plays until a voice is chosen; a stored
// `fyp-voice` shows pressed under its second line, and a tap on the other
// changes it; "Just listen today" shows no guide and no Move do, shows the
// doctor lines and rests the Wrap; Start the guide stays aria-disabled
// until Merc's notes have played; Move do higher is aria-disabled after
// three taps and lower after four; the feeling question appears when each
// sweep ends; "Easy" shows "Do, so, la, fa, do: you just sang the loop's
// roots."; "Effortful" and "Uncomfortable" put the guide and Move do away,
// the second with the doctor lines, and rest the Wrap with Cadence still
// offered, and no later answer brings the practice card back. Nothing
// listens: no call to getUserMedia, and no request that sends anything.

import type { Locator, Page } from '@playwright/test'
import { expect, test } from './helpers/lesson-page'

/** Counts every ask for the microphone and every request that sends something. */
async function watchQuiet(page: Page): Promise<() => Promise<string[]>> {
  const sent: string[] = []
  page.on('request', (r) => {
    // a host behind Cloudflare's proxy posts its own scripts' beacons under /cdn-cgi/
    if (new URL(r.url()).pathname.startsWith('/cdn-cgi/')) return
    if (r.method() !== 'GET') sent.push(`${r.method()} ${r.url()}`)
  })
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
  return async () => [
    ...sent,
    `${await page.evaluate(() => (window as unknown as { micAsks: number }).micAsks)} asks`,
  ]
}

/** Opens Sing it, a voice stored as an earlier lesson stores it. */
async function toSing(page: Page, voice?: 'lower' | 'higher'): Promise<void> {
  if (voice !== undefined)
    await page.addInitScript((v) => {
      localStorage.setItem('fyp-voice', JSON.stringify(v))
    }, voice)
  await page.goto('/learn/12#sing')
}

const status = (page: Page): Locator => page.locator('#singStatus')
const panel = (page: Page, id: string): Locator =>
  page.locator(`[data-panel="${id}"]`)
const ending = (page: Page, e: 'rest' | 'practise'): Locator =>
  page.locator(`#practiseCard [data-ending="${e}"]`)

/** Plays Merc's notes to their end: 10.0 s of Merc over the chords. */
async function playNotes(page: Page): Promise<void> {
  const play = page.locator('[data-notes-play]')
  await play.click()
  await expect(play).toHaveClass(/\bis-on\b/)
  await expect(play).not.toHaveClass(/\bis-on\b/, { timeout: 30_000 })
}

/** Sweeps the guide to its end, 11.0 s with its count-in, and waits for the feeling question. */
async function sweep(page: Page): Promise<void> {
  await page.locator('[data-guide-start]').click()
  await expect(status(page)).toHaveText('Your turn: sing with the guide.')
  await expect(panel(page, 'feel')).toBeVisible({ timeout: 30_000 })
  await expect(status(page)).toHaveText('How did that feel?')
}

const feel = (page: Page, f: string): Promise<void> =>
  page.locator(`[data-feel="${f}"]`).click()

/** The rest card in the Wrap, with Arpeggio Jumper for another day and Cadence still offered. */
async function expectRested(page: Page): Promise<void> {
  await expect(ending(page, 'rest')).toBeVisible()
  await expect(ending(page, 'practise')).toBeHidden()
  await expect(page.locator('#practiseCard .eyebrow')).toHaveText('Rest today')
  await expect(
    page.locator('#practiseCard .second-drill a.addr'),
  ).toHaveAttribute('href', '/ear-lab?lesson=12')
  await expect(page.locator('#practiseCard .second-drill')).toContainText(
    'then tap Cadence.',
  )
}

for (const viewport of [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
]) {
  test.describe(`Sing it at ${viewport.width} x ${viewport.height}`, () => {
    test.use({ viewport })
    test.describe.configure({ timeout: 120_000 })

    test('the comfort check comes first on every visit; with no voice stored, the choice follows either answer and nothing plays until one is chosen', async ({
      page,
    }) => {
      // a first visit, "I'm comfortable"
      await toSing(page)
      await expect(panel(page, 'comfort')).toBeVisible()
      await expect(panel(page, 'voice')).toBeHidden()
      await page.locator('[data-comfort="sing"]').click()
      await expect(page.locator('[data-voice-line="none"]')).toHaveText(
        'Choose a voice to sing with. If you chose one in an earlier lesson, pick it again:',
      )
      await expect(page.locator('[data-voice-line="stored"]')).toBeHidden()
      for (const v of ['lower', 'higher'])
        await expect(page.locator(`[data-voice="${v}"]`)).toHaveAttribute(
          'aria-pressed',
          'false',
        )
      await expect(panel(page, 'notes')).toBeHidden()

      // the next visit asks again, and "Just listen today" waits for a voice too
      await page.reload()
      await expect(panel(page, 'comfort')).toBeVisible()
      await page.locator('[data-comfort="listen"]').click()
      await expect(panel(page, 'listen')).toBeVisible()
      await expect(page.locator('[data-voice-line="none"]')).toBeVisible()
      await expect(panel(page, 'notes')).toBeHidden()
      expect(
        await page.evaluate(() => localStorage.getItem('fyp-voice')),
      ).toBeNull()
    })

    test('a stored voice shows pressed under its second line, and a tap on the other changes it', async ({
      page,
    }) => {
      await toSing(page, 'lower')
      await page.locator('[data-comfort="sing"]').click()
      await expect(page.locator('[data-voice-line="stored"]')).toHaveText(
        'Keep the voice you chose before, or change it:',
      )
      await expect(page.locator('[data-voice="lower"]')).toHaveAttribute(
        'aria-pressed',
        'true',
      )
      await expect(page.locator('[data-do-readout]')).toContainText(
        'do is C4: C4, G3, A3, F3, C4',
      )

      await page.locator('[data-voice="higher"]').click()

      await expect(page.locator('[data-voice="higher"]')).toHaveAttribute(
        'aria-pressed',
        'true',
      )
      await expect(page.locator('[data-do-readout]')).toContainText(
        'do is C5: C5, G4, A4, F4, C5',
      )
      expect(await page.evaluate(() => localStorage.getItem('fyp-voice'))).toBe(
        JSON.stringify('higher'),
      )
    })

    test('"Just listen today" shows no guide and no Move do, the doctor lines and Merc\'s notes, rests the Wrap, and asks nothing of the microphone', async ({
      page,
    }) => {
      const quiet = await watchQuiet(page)
      await toSing(page)

      await page.locator('[data-comfort="listen"]').click()
      await expect(page.locator('[data-panel="listen"] .doctor')).toBeVisible()
      await page.locator('[data-voice="lower"]').click()

      await expect(page.locator('[data-notes-play]')).toBeVisible()
      await expect(page.locator('[data-guide-start]')).toBeHidden()
      await expect(page.locator('.move-do')).toBeHidden()
      await expect(page.locator('[data-guide-hint]')).toBeHidden()
      await expect(status(page)).toHaveText(
        "Just listening today: press Play Merc's notes to hear them.",
      )
      await expectRested(page)
      await playNotes(page)
      expect(await quiet()).toEqual(['0 asks'])
    })

    test('Start the guide waits for Merc\'s notes; each sweep that ends asks how it felt, the keyboard on the question; "Easy" keeps the guide', async ({
      page,
    }) => {
      const quiet = await watchQuiet(page)
      await toSing(page, 'lower')
      await page.locator('[data-comfort="sing"]').click()
      const start = page.locator('[data-guide-start]')
      await expect(start).toHaveAttribute('aria-disabled', 'true')
      await expect(page.locator('[data-guide-hint]')).toHaveText(
        "Play Merc's notes first",
      )

      await playNotes(page)
      await expect(start).toHaveAttribute('aria-disabled', 'false')
      await expect(page.locator('[data-guide-hint]')).toBeHidden()
      await sweep(page)
      await expect(page.locator('.feel-q')).toBeFocused()

      await feel(page, 'easy')
      await expect(page.locator('[data-after="roots"]')).toHaveText(
        "Do, so, la, fa, do: you just sang the loop's roots.",
      )
      await expect(page.locator('[data-after="roots"]')).toBeFocused()
      await expect(start).toBeVisible()
      await expect(page.locator('.move-do')).toBeVisible()
      await expect(ending(page, 'practise')).toBeVisible()
      await expect(ending(page, 'rest')).toBeHidden()

      // asked afresh after the next sweep, with no answer pressed
      await sweep(page)
      await expect(page.locator('[data-feel="easy"]')).toHaveAttribute(
        'aria-pressed',
        'false',
      )
      expect(await quiet()).toEqual(['0 asks'])
    })

    test('Move do higher is aria-disabled after three taps and lower after four, the readout moving with it', async ({
      page,
    }) => {
      await toSing(page, 'lower')
      await page.locator('[data-comfort="sing"]').click()
      const higher = page.locator('[data-move-do="1"]')
      const lower = page.locator('[data-move-do="-1"]')

      for (let i = 0; i < 3; i++) await higher.click()
      await expect(higher).toHaveAttribute('aria-disabled', 'true')
      await expect(page.locator('[data-do-readout]')).toContainText('do is E')
      for (let i = 0; i < 7; i++) await lower.click()

      await expect(lower).toHaveAttribute('aria-disabled', 'true')
      await expect(higher).toHaveAttribute('aria-disabled', 'false')
      await expect(page.locator('[data-do-readout]')).toContainText('do is A')
    })

    test('"Effortful" puts the guide and Move do away with the gentle line, the Wrap rests with Cadence, and "Easy" later cannot bring the practice card back', async ({
      page,
    }) => {
      const quiet = await watchQuiet(page)
      await toSing(page, 'higher')
      await page.locator('[data-comfort="sing"]').click()
      await playNotes(page)
      await sweep(page)

      await feel(page, 'effortful')

      await expect(page.locator('[data-after="gentle"]')).toHaveText(
        'Keep it gentle: rest before you sing again.',
      )
      await expect(page.locator('[data-guide-start]')).toBeHidden()
      await expect(page.locator('.move-do')).toBeHidden()
      await expect(page.locator('[data-after-doctor]')).toBeHidden()
      await expect(page.locator('#ring .ring-state')).toHaveText('Rest')
      await expectRested(page)
      // the kit's lock: the answer stands, so "Easy" cannot be given after it
      await expect(page.locator('[data-feel="easy"]')).toBeDisabled()
      await expect(ending(page, 'rest')).toBeVisible()
      // Merc still sings
      await expect(page.locator('[data-notes-play]')).toBeVisible()
      expect(await quiet()).toEqual(['0 asks'])
    })

    test('"Uncomfortable" puts the guide and Move do away with the doctor lines, and the Wrap rests', async ({
      page,
    }) => {
      await toSing(page, 'lower')
      await page.locator('[data-comfort="sing"]').click()
      await playNotes(page)
      await sweep(page)

      await feel(page, 'uncomfortable')

      await expect(page.locator('[data-after="enough"]')).toBeVisible()
      await expect(page.locator('[data-after-doctor]')).toBeVisible()
      await expect(page.locator('[data-guide-start]')).toBeHidden()
      await expect(page.locator('.move-do')).toBeHidden()
      await expectRested(page)
    })
  })
}
