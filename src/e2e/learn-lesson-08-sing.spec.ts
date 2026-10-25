// ============================================================
// Lesson 8 Sing it, the line on the beat — every branch, with no microphone
// ============================================================
//
// WEB-SPEC's end-to-end checks 7 and 8 (Tests): the comfort check first in
// its part, every visit; with no voice stored, the voice choice after
// either answer, and nothing after it until a voice is chosen; a stored
// voice shown pressed, and a tap on the other changing it; Start the guide
// aria-disabled until Merc's line has played; "How did that feel?" as each
// guide ends, and what each answer shows and puts away; Again once a visit;
// Move do's lower button at the lowest do keeping the keyboard's place,
// said by the accessibility tree to be unavailable, and a press there
// stopping no line; the Wrap's rest line each branch picks. Nothing
// listens: no call to getUserMedia, and no request that sends anything.
// Merc's line and the guide each run about 8 s with their count-in, so the
// longest test runs about 40 s.

import type { Locator, Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { axState } from './helpers/ax-state'

test.describe('Sing it, the line on the beat, with no microphone', () => {
  test.describe.configure({ timeout: 120_000 })

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
    await page.goto('/learn/08#sing')
  }

  const status = (page: Page): Locator => page.locator('#singStatus')
  const rest = (page: Page): Locator =>
    page.locator('#practiseCard [data-ending="rest"]')

  /** Plays Merc's line to its end: about 8 s of Merc over the groove. */
  async function playLine(page: Page): Promise<void> {
    await page.locator('[data-line-play]').click()
    await expect(status(page)).toHaveText('Merc sings the line.')
    await expect(status(page)).not.toHaveText('Merc sings the line.', {
      timeout: 30_000,
    })
  }

  /** Runs a guide, Start's or Again's, to its end, and waits for the feeling question. */
  async function guide(page: Page, button: string): Promise<void> {
    await page.locator(button).click()
    await expect(status(page)).toHaveText('Your turn: sing with the guide.')
    await expect(page.locator('[data-panel="feel"]')).toBeVisible({
      timeout: 30_000,
    })
    await expect(status(page)).toHaveText('How did that feel?')
  }

  const feel = (page: Page, f: string): Promise<void> =>
    page.locator(`[data-feel="${f}"]`).click()

  test('the comfort check comes first; with no voice stored, nothing after the choice shows until one is chosen', async ({
    page,
  }) => {
    await toSing(page)
    await expect(page.locator('[data-panel="comfort"]')).toBeVisible()
    await expect(status(page)).toHaveText(
      'Before you sing: how is your voice today?',
    )
    await expect(page.locator('[data-panel="line"]')).toBeHidden()

    await page.locator('[data-comfort="sing"]').click()
    await expect(page.locator('[data-voice-line="none"]')).toHaveText(
      'Choose a voice to sing with. If you chose one in an earlier lesson, pick it again:',
    )
    await expect(page.locator('[data-panel="line"]')).toBeHidden()
    await expect(status(page)).toHaveText("Choose the voice you'll sing with.")
    await page.locator('[data-panel="voice"] [data-voice="lower"]').click()

    await expect(page.locator('[data-panel="line"]')).toBeVisible()
    await expect(page.locator('[data-guide-start]')).toHaveAttribute(
      'aria-disabled',
      'true',
    )
    await expect(page.locator('[data-guide-hint]')).toBeVisible()
    await expect(status(page)).toHaveText(
      "Play Merc's line first: Merc sings it, then the guide is yours.",
    )
  })

  test('the lower voice: the line, the guide, "Easy" and its Again, used once, with the practice card kept', async ({
    page,
  }) => {
    const quiet = await watchQuiet(page)
    await toSing(page, 'lower')
    await page.locator('[data-comfort="sing"]').click()
    await expect(page.locator('[data-voice-line="stored"]')).toBeVisible()
    await expect(
      page.locator('[data-panel="voice"] [data-voice="lower"]'),
    ).toHaveAttribute('aria-pressed', 'true')
    await expect(page.locator('[data-do-readout]')).toHaveText('do: as written')

    await playLine(page)
    await expect(status(page)).toHaveText(
      "Start the guide when you're ready, or play Merc's line again.",
    )
    await expect(page.locator('[data-guide-start]')).not.toHaveAttribute(
      'aria-disabled',
      'true',
    )
    await guide(page, '[data-guide-start]')
    await expect(page.locator('.feel-q')).toBeFocused()
    await feel(page, 'easy')
    await expect(page.locator('[data-after="done"]')).toHaveText(
      "That's it: one line over the backbeat, done.",
    )
    await expect(page.locator('[data-guide-again]')).toBeVisible()

    await guide(page, '[data-guide-again]')
    await feel(page, 'easy')
    await expect(page.locator('[data-after="done"]')).toBeVisible()
    await expect(page.locator('[data-guide-again]')).toBeHidden()
    await expect(rest(page)).toBeHidden()
    expect(await quiet()).toEqual(['0 asks'])
  })

  test('a tap on the other voice changes it', async ({ page }) => {
    await toSing(page, 'lower')
    await page.locator('[data-comfort="sing"]').click()
    await expect(page.locator('[data-voice-line="stored"]')).toHaveText(
      'Keep the voice you chose before, or change it:',
    )

    await page.locator('[data-panel="voice"] [data-voice="higher"]').click()

    await expect(
      page.locator('[data-panel="voice"] [data-voice="higher"]'),
    ).toHaveAttribute('aria-pressed', 'true')
    await expect(
      page.locator('[data-panel="voice"] [data-voice="lower"]'),
    ).toHaveAttribute('aria-pressed', 'false')
  })

  test("Move do's lower button keeps the keyboard at the lowest do, is said to be unavailable, and a press there stops no line", async ({
    page,
  }) => {
    // Arrange: do four lower by keyboard, then Merc's line sounding, the keyboard back on lower
    await toSing(page, 'lower')
    await page.locator('[data-comfort="sing"]').click()
    const lower = page.locator('[data-move-do="-1"]')
    const readout = page.locator('[data-do-readout]')
    await lower.focus()
    for (let i = 0; i < 4; i++) await page.keyboard.press('Enter')
    await expect(lower).toHaveAttribute('aria-disabled', 'true')
    await expect(readout).toHaveText('do: 4 semitones lower, the lowest')
    await page.locator('[data-line-play]').click()
    await expect(status(page)).toHaveText('Merc sings the line.')
    await lower.focus()

    // Act
    await page.keyboard.press('Enter')

    // Assert
    await expect(lower).toBeFocused()
    await expect(readout).toHaveText('do: 4 semitones lower, the lowest')
    await expect(status(page)).toHaveText('Merc sings the line.')
    await expect(page.locator('[data-line-play]')).toHaveClass(/\bis-on\b/)
    expect(await axState(page, '[data-move-do="-1"]')).toEqual({
      role: 'button',
      name: 'Move do lower',
      disabled: true,
      focusable: true,
      focused: true,
    })
  })

  test('"Effortful" puts the guide away for the visit and rests the Wrap, and "Easy" after it brings neither back', async ({
    page,
  }) => {
    await toSing(page, 'lower')
    await page.locator('[data-comfort="sing"]').click()
    await playLine(page)
    await guide(page, '[data-guide-start]')

    await feel(page, 'effortful')
    await expect(page.locator('[data-after="gentle"]')).toHaveText(
      'Keep it gentle: rest before you sing again.',
    )
    await expect(page.locator('[data-guide-start]')).toBeHidden()
    await expect(page.locator('[data-guide-again]')).toBeHidden()
    await expect(page.locator('[data-move-part]')).toBeHidden()
    await expect(rest(page)).toBeVisible()

    await feel(page, 'easy')
    await expect(status(page)).toHaveText(
      'Merc can still sing the line for you.',
    )
    await expect(
      page.locator('[data-panel="feel"] [data-after]:visible'),
    ).toHaveCount(0)
    await expect(page.locator('[data-guide-again]')).toBeHidden()
    await expect(rest(page)).toBeVisible()
  })

  test('"Uncomfortable" puts the guide away, shows the doctor lines and rests the Wrap', async ({
    page,
  }) => {
    await toSing(page, 'lower')
    await page.locator('[data-comfort="sing"]').click()
    await playLine(page)
    await guide(page, '[data-guide-start]')

    await feel(page, 'uncomfortable')

    await expect(page.locator('[data-after="enough"]')).toBeVisible()
    await expect(page.locator('[data-after-doctor]')).toBeVisible()
    await expect(page.locator('[data-guide-start]')).toBeHidden()
    await expect(page.locator('[data-move-part]')).toBeHidden()
    await expect(rest(page)).toBeVisible()
  })

  test('"Just listen today" shows no guide and no Move do, the doctor lines, and rests the Wrap, asking nothing of the microphone', async ({
    page,
  }) => {
    const quiet = await watchQuiet(page)
    await toSing(page)

    await page.locator('[data-comfort="listen"]').click()
    await expect(page.locator('[data-panel="listen"] .doctor')).toBeVisible()
    await expect(status(page)).toHaveText(
      'Choose a voice: it picks the Merc who sings.',
    )
    await page.locator('[data-panel="voice"] [data-voice="lower"]').click()

    await expect(page.locator('[data-line-play]')).toBeVisible()
    await expect(page.locator('[data-guide-start]')).toBeHidden()
    await expect(page.locator('[data-move-part]')).toBeHidden()
    await expect(page.locator('[data-guide-hint]')).toBeHidden()
    await expect(status(page)).toHaveText(
      "Just listening today: press Play Merc's line to hear it.",
    )
    await expect(rest(page)).toBeVisible()
    await playLine(page)
    expect(await quiet()).toEqual(['0 asks'])
  })
})
