// ============================================================
// Lesson 9 Sing it — the card in the browser, the microphone counted
// ============================================================
//
// WEB-SPEC's end-to-end check 6 (Tests), its parts that need no voice, at
// a phone's size and a desktop's: "Just listen today" never calls
// `navigator.mediaDevices.getUserMedia` (a spy), even with Merc's ladder
// played, shows its line and the doctor lines, and leaves the rest card in
// the Wrap; with the sound off, Start asks for no microphone and its hint
// says the sound is off, naming Start; and a refused permission shows the
// no-microphone line and keeps the practice card. The voice is stored as
// an earlier lesson stores it, so the card goes from the comfort check
// straight to its path. The takes are the fake microphone's, one spec for
// each sound it plays: learn-lesson-09-sing-a3.spec.ts, -d3 and -steps.

import { expect, test } from './helpers/lesson-page'
import { ending, micAsks, prepare, start, status, toSing, watchMic, } from './helpers/lesson-09-sing'

for (const viewport of [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
]) {
  test.describe(`at ${viewport.width} x ${viewport.height}`, () => {
    test.use({ viewport })

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
      await expect(
        page.locator('.doctor[data-listen-why="listen"]'),
      ).toBeVisible()
      await expect(start(page)).toBeHidden()
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
      await toSing(page)
      // the switch turns sound on from unset, then off
      await page.locator('#soundSwitch').click()
      await page.locator('#soundSwitch').click()
      await expect(page.locator('#soundSwitch')).toHaveAttribute(
        'aria-pressed',
        'false',
      )

      await start(page).click()

      await expect(page.locator('[data-start-hint]')).toHaveText(
        "Sound is off, so nothing played. Turn sound on to hear Merc's ladder, then press Start.",
      )
      await expect(page.locator('[data-start-hint]')).toBeVisible()
      await expect(status(page)).toHaveText('Your turn: do-mi-so-do, slowly.')
      expect(await micAsks(page)).toBe(0)
    })

    test('a refused microphone listens only, and keeps the practice card', async ({
      page,
    }) => {
      await watchMic(page, true)
      await toSing(page)

      await start(page).click()

      await expect(status(page)).toHaveText(
        'No microphone? Sing along anyway: Merc sings the ladder first, and nothing listens.',
      )
      await expect(page.locator('[data-listen-why="nomic"]')).toBeVisible()
      await expect(start(page)).toBeHidden()
      await expect(ending(page, 'practise')).toBeVisible()
      expect(await micAsks(page)).toBe(1)
    })
  })
}
