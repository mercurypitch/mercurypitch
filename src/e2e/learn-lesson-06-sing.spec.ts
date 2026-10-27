// ============================================================
// Lesson 6 Sing it — every branch, with no microphone and no request
// ============================================================
//
// WEB-SPEC's end-to-end checks 5, 6 and 10 (Tests): the comfort check
// first on every visit; with no voice stored, nothing after the voice
// choice until one is chosen; a stored voice shown pressed, and a tap on
// the other changing it; a black-key do, Move do four lower, on one line
// in the ring; Move do's lower button at the lowest do keeping the
// keyboard's place, said by the accessibility tree to be unavailable, and
// a press there stopping no version; Start the guide aria-disabled until
// a version has played; "How did that feel?" as each sweep ends, and what
// each answer shows and puts away; the Wrap's practise card each branch
// picks. Nothing listens: no call to getUserMedia, and no request that
// sends anything. A line shown under a row of buttons (the do readout
// under the plays, a feeling's answer under the four feelings) stands
// clear of the row, as a line stands under a line (kit/lesson-voice.css).
// Merc's versions are 9.6 s and a sweep 10.6 s with its count-in, so the
// longest test runs about 45 s.

import type { Locator, Page } from '@playwright/test'
import { axState } from './helpers/ax-state'
import { expect, test } from './helpers/lesson-page'

test.describe('Sing it, with no microphone', () => {
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
    await page.goto('/learn/06#sing')
  }

  const status = (page: Page): Locator => page.locator('#singStatus')

  /** Plays a version to its end: 9.6 s of Merc. */
  async function playVersion(page: Page, n: 1 | 2): Promise<void> {
    await page.locator(`[data-version="${n}"]`).click()
    await expect(status(page)).toHaveText(
      `Merc sings the ${n === 1 ? 'first' : 'second'} version.`,
    )
    await expect(status(page)).not.toHaveText(/^Merc sings/, {
      timeout: 30_000,
    })
  }

  /** Sweeps the guide to its end, 10.6 s, and waits for the feeling question. */
  async function sweep(page: Page): Promise<void> {
    await page.locator('[data-guide-start]').click()
    await expect(status(page)).toHaveText('Your turn: sing with the line.')
    await expect(page.locator('[data-panel="feel"]')).toBeVisible({
      timeout: 30_000,
    })
    await expect(status(page)).toHaveText('How did that feel?')
  }

  const feel = (page: Page, f: string): Promise<void> =>
    page.locator(`[data-feel="${f}"]`).click()

  /** The room between a row of buttons and the line shown under it, in px. */
  async function gapUnder(row: Locator, line: Locator): Promise<number> {
    const above = await row.boundingBox()
    const below = await line.boundingBox()
    expect(above, 'the row is laid out').not.toBeNull()
    expect(below, 'the line is laid out').not.toBeNull()
    return (below?.y ?? 0) - ((above?.y ?? 0) + (above?.height ?? 0))
  }

  test('the comfort check comes first; with no voice stored, nothing after the choice shows until one is chosen', async ({
    page,
  }) => {
    await toSing(page)
    await expect(page.locator('[data-panel="comfort"]')).toBeVisible()
    await expect(page.locator('[data-panel="versions"]')).toBeHidden()

    await page.locator('[data-comfort="sing"]').click()
    await expect(page.locator('[data-voice-line="none"]')).toBeVisible()
    await expect(page.locator('[data-panel="versions"]')).toBeHidden()
    await page.locator('[data-panel="voice"] [data-voice="lower"]').click()

    await expect(page.locator('[data-panel="versions"]')).toBeVisible()
    await expect(page.locator('[data-guide-start]')).toHaveAttribute(
      'aria-disabled',
      'true',
    )
    await expect(page.locator('[data-guide-hint]')).toBeVisible()
    await expect(status(page)).toHaveText(
      "Play Merc's version first: Merc sings it, then the guide is yours.",
    )
  })

  test('the lower voice: both versions sung, "Easy" each time, the transposed line and the Interval Trainer card', async ({
    page,
  }) => {
    const quiet = await watchQuiet(page)
    await toSing(page, 'lower')
    await page.locator('[data-comfort="sing"]').click()
    const lower = page.locator('[data-panel="voice"] [data-voice="lower"]')
    await expect(lower).toHaveAttribute('aria-pressed', 'true')
    await expect(page.locator('[data-do-readout]')).toHaveText(
      'do is D3, then F3',
    )

    await playVersion(page, 1)
    await sweep(page)
    await expect(page.locator('.feel-q')).toBeFocused()
    await feel(page, 'easy')
    await expect(page.locator('[data-after="one"]')).toBeVisible()

    await playVersion(page, 2)
    await sweep(page)
    await feel(page, 'easy')
    await expect(page.locator('[data-after="both"]')).toHaveText(
      'One tune, two starting notes: you just transposed it.',
    )
    await expect(
      page.locator('#practiseCard [data-ending="practise"]'),
    ).toBeVisible()
    await expect(
      page.locator('#practiseCard [data-ending="rest"]'),
    ).toBeHidden()
    expect(await quiet()).toEqual(['0 asks'])
  })

  test('a tap on the other voice changes it, and Merc sings from its do', async ({
    page,
  }) => {
    await toSing(page, 'lower')
    await page.locator('[data-comfort="sing"]').click()

    await page.locator('[data-panel="voice"] [data-voice="higher"]').click()

    await expect(
      page.locator('[data-panel="voice"] [data-voice="higher"]'),
    ).toHaveAttribute('aria-pressed', 'true')
    await expect(
      page.locator('[data-panel="voice"] [data-voice="lower"]'),
    ).toHaveAttribute('aria-pressed', 'false')
    await expect(page.locator('[data-do-readout]')).toHaveText(
      'do is D4, then F4',
    )
  })

  test('a black-key do stays on one line in the ring: four lower is "Do: B♭2 · 117 Hz"', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await toSing(page, 'lower')
    await page.locator('[data-comfort="sing"]').click()
    const lower = page.locator('[data-move-do="-1"]')
    for (let i = 0; i < 4; i++) await lower.click()
    await expect(lower).toHaveAttribute('aria-disabled', 'true')

    const note = page.locator('#ring .ring-note')
    await expect(note).toContainText('117 Hz')
    // every piece of the note drawn on one line: the sign's span sits in it
    const drawn = await note.evaluate((el) => {
      const range = document.createRange()
      range.selectNodeContents(el)
      const rects = Array.from(range.getClientRects()).filter(
        (r) => r.width > 1 && r.height > 1,
      )
      const tops = rects.map((r) => r.top)
      return {
        pieces: rects.length,
        spread: Math.max(...tops) - Math.min(...tops),
        line: Math.min(...rects.map((r) => r.height)),
      }
    })
    expect(drawn.pieces).toBeGreaterThan(1)
    expect(drawn.spread).toBeLessThan(drawn.line / 2)
  })

  test("Move do's lower button keeps the keyboard at the lowest do, is said to be unavailable, and a press there stops no version", async ({
    page,
  }) => {
    // Arrange: do four lower by keyboard, then the first version sounding, the keyboard back on lower
    await toSing(page, 'lower')
    await page.locator('[data-comfort="sing"]').click()
    const lower = page.locator('[data-move-do="-1"]')
    const readout = page.locator('[data-do-readout]')
    await lower.focus()
    for (let i = 0; i < 4; i++) await page.keyboard.press('Enter')
    await expect(lower).toHaveAttribute('aria-disabled', 'true')
    const lowest = (await readout.textContent()) ?? ''
    await page.locator('[data-version="1"]').click()
    await expect(status(page)).toHaveText('Merc sings the first version.')
    await lower.focus()

    // Act
    await page.keyboard.press('Enter')

    // Assert
    await expect(lower).toBeFocused()
    await expect(readout).toHaveText(lowest)
    await expect(status(page)).toHaveText('Merc sings the first version.')
    await expect(page.locator('[data-version="1"]')).toHaveClass(/\bis-on\b/)
    expect(await axState(page, '[data-move-do="-1"]')).toEqual({
      role: 'button',
      name: 'lower',
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
    await playVersion(page, 1)
    await sweep(page)

    await feel(page, 'effortful')
    await expect(page.locator('[data-after="gentle"]')).toHaveText(
      'Keep it gentle: rest before you sing again.',
    )
    // the answer stands clear of the four feelings, not flush under them
    expect(
      await gapUnder(
        page.locator('.feelings'),
        page.locator('[data-after="gentle"]'),
      ),
    ).toBeGreaterThanOrEqual(11.5)
    await expect(page.locator('[data-guide-start]')).toBeHidden()
    await expect(page.locator('.move-do')).toBeHidden()
    await expect(
      page.locator('#practiseCard [data-ending="rest"]'),
    ).toBeVisible()
    await expect(
      page.locator('#practiseCard [data-ending="practise"]'),
    ).toBeHidden()

    await feel(page, 'easy')
    await expect(status(page)).toHaveText(
      'Merc can still sing either version for you.',
    )
    await expect(
      page.locator('[data-panel="feel"] [data-after]:visible'),
    ).toHaveCount(0)
    await expect(page.locator('[data-guide-start]')).toBeHidden()
    await expect(
      page.locator('#practiseCard [data-ending="rest"]'),
    ).toBeVisible()
  })

  test('"Uncomfortable" puts the guide away, shows the doctor lines and rests the Wrap', async ({
    page,
  }) => {
    await toSing(page, 'lower')
    await page.locator('[data-comfort="sing"]').click()
    await playVersion(page, 1)
    await sweep(page)

    await feel(page, 'uncomfortable')

    await expect(page.locator('[data-after="enough"]')).toBeVisible()
    await expect(page.locator('[data-after-doctor]')).toBeVisible()
    await expect(page.locator('[data-guide-start]')).toBeHidden()
    await expect(page.locator('.move-do')).toBeHidden()
    await expect(
      page.locator('#practiseCard [data-ending="rest"]'),
    ).toBeVisible()
  })

  test('"Just listen today" shows no guide and no Move do, the doctor lines, and rests the Wrap, asking nothing of the microphone', async ({
    page,
  }) => {
    const quiet = await watchQuiet(page)
    await toSing(page)

    await page.locator('[data-comfort="listen"]').click()
    await expect(page.locator('[data-panel="listen"] .doctor')).toBeVisible()
    await page.locator('[data-panel="voice"] [data-voice="lower"]').click()

    await expect(page.locator('[data-panel="versions"]')).toBeVisible()
    await expect(page.locator('[data-version="1"]')).toBeVisible()
    await expect(page.locator('[data-guide-start]')).toBeHidden()
    await expect(page.locator('.move-do')).toBeHidden()
    await expect(page.locator('[data-guide-hint]')).toBeHidden()
    await expect(status(page)).toHaveText(
      'Just listening today: press a Play button to hear Merc.',
    )
    // the do readout stands clear of the plays above it, the hint and the
    // guide's line hidden between them
    expect(
      await gapUnder(
        page.locator('[data-panel="versions"] .sing-btns'),
        page.locator('[data-do-readout]'),
      ),
    ).toBeGreaterThanOrEqual(11.5)
    await expect(
      page.locator('#practiseCard [data-ending="rest"]'),
    ).toBeVisible()
    await playVersion(page, 1)
    expect(await quiet()).toEqual(['0 asks'])
  })
})
