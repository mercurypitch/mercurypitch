// ============================================================
// Lesson 10 Sing it — every branch in the browser, with no microphone
// ============================================================
//
// WEB-SPEC's end-to-end checks 7 and 8 (Tests), at a phone's size and a
// desktop's: the comfort check first, every visit; with no voice stored,
// the voice choice after either answer under its first line, and nothing
// played until a voice is chosen; a stored voice pressed under its second
// line, and a tap on the other changing it; "Just listen today" with no
// guide and no Move do, the doctor lines, and the rest card in the Wrap;
// Start the guide aria-disabled until Merc's notes have played; the
// feeling question as each sweep ends, the keyboard on it and Space
// starting nothing; "Easy" with its line; "Effortful" and "Uncomfortable"
// putting the guide and Move do away, the Wrap resting with Stack still
// offered, and no later answer bringing the practice card back. Nothing
// listens: no call to getUserMedia, and no request that sends anything.
// Then, at the phone's size: Move do at its end said to be unavailable
// and keeping the keyboard, a press there stopping nothing; Merc's notes
// stopped once the section has been away 600 ms, the ring with them; and
// under reduced motion the ring holding still and the guide lighting the
// path's notes in turn in place of its travelling line. And by keyboard
// alone, its part of WEB-SPEC's fourth check: Tab meets each state's
// controls in the order its flow shows them, and each status line reaches
// its live region. Merc's notes are 10.0 s and a sweep 11.0 s with its
// count-in, so the longest test runs about 45 s.

import type { Locator, Page } from '@playwright/test'
import { axState } from './helpers/ax-state'
import { expect, test } from './helpers/lesson-page'
import { liveSaid, scrollStill, tabsWithin, watchLive, } from './helpers/lesson-qa'

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
  await page.goto('/learn/10#sing')
}

const status = (page: Page): Locator => page.locator('#singStatus')
const panel = (page: Page, id: string): Locator =>
  page.locator(`[data-panel="${id}"]`)
const ending = (page: Page, e: 'rest' | 'practise'): Locator =>
  page.locator(`#practiseCard [data-ending="${e}"]`)

/** Plays Merc's notes to their end: 10.0 s of Merc. A press that must not scroll the page sends the click alone. */
async function playNotes(page: Page, still = false): Promise<void> {
  const play = page.locator('[data-notes-play]')
  if (still) await play.dispatchEvent('click')
  else await play.click()
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

/** The rest card in the Wrap, with Drone Intonation for another day and Stack still offered. */
async function expectRested(page: Page): Promise<void> {
  await expect(ending(page, 'rest')).toBeVisible()
  await expect(ending(page, 'practise')).toBeHidden()
  await expect(page.locator('#practiseCard .eyebrow')).toHaveText('Rest today')
  await expect(
    page.locator('#practiseCard .second-drill a.addr'),
  ).toHaveAttribute('href', '/ear-lab?lesson=10')
  await expect(page.locator('#practiseCard .second-drill')).toContainText(
    'then tap Stack.',
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
      await expect(page.locator('[data-do-readout]')).toHaveText('do is E3')

      await page.locator('[data-voice="higher"]').click()

      await expect(page.locator('[data-voice="higher"]')).toHaveAttribute(
        'aria-pressed',
        'true',
      )
      await expect(page.locator('[data-voice="lower"]')).toHaveAttribute(
        'aria-pressed',
        'false',
      )
      await expect(page.locator('[data-do-readout]')).toHaveText('do is E4')
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

    test('Start the guide waits for Merc\'s notes; each sweep that ends asks how it felt, the keyboard on the question and Space starting nothing; "Easy" keeps the guide', async ({
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
      await page.keyboard.press('Space')
      await expect(status(page)).toHaveText('How did that feel?')
      await expect(start).not.toHaveClass(/\bis-on\b/)

      await feel(page, 'easy')
      await expect(page.locator('[data-after="moved"]')).toHaveText(
        'Do-mi-so, then do-me-so: you just moved the third.',
      )
      await expect(page.locator('[data-after="moved"]')).toBeFocused()
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
      await expect(page.locator('[data-feel="easy"]')).toBeEnabled()
      expect(await quiet()).toEqual(['0 asks'])
    })

    test('"Effortful" puts the guide and Move do away with the gentle line, the Wrap rests with Stack, and no later answer brings the practice card back', async ({
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
      // the ring rests, and never says "again" after "Effortful"
      await expect(page.locator('#ring .ring-state')).toHaveText('Rest')
      await expectRested(page)
      // the kit's lock: the answer stands, so "Easy" cannot be given after it
      await expect(page.locator('[data-feel="easy"]')).toBeDisabled()
      await expect(ending(page, 'rest')).toBeVisible()
      // Merc still sings, at the do Move do last set
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

    // WEB-SPEC, End to end 4: Sing it's part of the page's keyboard sweep
    test('by keyboard alone, Tab meets its controls in the order its flow shows them, and each status reaches its live region', async ({
      page,
    }) => {
      // Arrange: no voice stored, every live text kept
      await watchLive(page)
      await toSing(page)
      const card = page.locator('#singCard')
      // a walk off the card's end scrolls the page away, and the scroll
      // back lands before a press: what plays stops once Sing it has been
      // off screen 600 ms (sing.ts `onLeave`)
      const press = async (sel: string): Promise<void> => {
        await card.locator(sel).focus()
        await expect.poll(() => scrollStill(page)).toBe(true)
        await page.keyboard.press('Enter')
      }
      // from the card's start, and from where the flow puts the keyboard's place
      const fromTop = (): Promise<string[]> =>
        tabsWithin(page, '#singCard', '#singCard')
      const fromHere = (): Promise<string[]> =>
        tabsWithin(page, null, '#singCard')
      const voices = [
        'Lower: sing with Merc, around A3',
        'Higher: sing with Tavi, around A4',
      ]
      const notes = [
        "Play Merc's notes",
        'Start the guide',
        'Move do lower',
        'Move do higher',
      ]
      const feelings = ['Easy', 'Workable', 'Effortful', 'Uncomfortable']

      // Act: the comfort check, the voice, Merc's notes, the guide, the answer
      const met = [await fromTop()]
      await press('[data-comfort="sing"]')
      met.push(await fromHere())
      await press('[data-voice="lower"]')
      met.push(await fromHere(), await fromTop())
      await press('[data-notes-play]')
      await expect(card.locator('[data-notes-play]')).toHaveClass(/\bis-on\b/)
      await expect(card.locator('[data-notes-play]')).not.toHaveClass(
        /\bis-on\b/,
        { timeout: 30_000 },
      )
      await press('[data-guide-start]')
      await expect(panel(page, 'feel')).toBeVisible({ timeout: 30_000 })
      met.push(await fromHere(), await fromTop())
      await press('[data-feel="easy"]')
      await expect(status(page)).toHaveText(
        'Do-mi-so, then do-me-so: you just moved the third.',
      )

      // Assert: each state's controls in the card's order, the comfort
      // answer and the sweep's end handing the place on to what comes next
      expect(met).toEqual([
        ["I'm comfortable: let's sing", 'Just listen today'],
        voices,
        [voices[1], ...notes],
        [...voices, ...notes],
        feelings,
        [...voices, ...notes, ...feelings],
      ])
      // and the flow's lines, in turn, in its status line
      expect(
        (await liveSaid(page))
          .filter((s) => s.where === 'singStatus')
          .map((s) => s.text),
      ).toEqual([
        'Before you sing: how is your voice today?',
        "Choose the voice you'll sing with.",
        "Play Merc's notes first: Merc sings them, then the guide is yours.",
        "Start the guide when you're ready, or play Merc's notes again.",
        'Your turn: sing with the guide.',
        'How did that feel?',
        'Do-mi-so, then do-me-so: you just moved the third.',
      ])
    })
  })
}

test.describe('Sing it at 390 x 844', () => {
  test.use({ viewport: { width: 390, height: 844 } })
  test.describe.configure({ timeout: 120_000 })

  test("Move do's lower button keeps the keyboard at the lowest do, is said to be unavailable, and a press there stops Merc's notes no more", async ({
    page,
  }) => {
    // Arrange: do four lower by keyboard, Merc's notes sounding, the keyboard back on lower
    await toSing(page, 'lower')
    await page.locator('[data-comfort="sing"]').click()
    const lower = page.locator('[data-move-do="-1"]')
    const readout = page.locator('[data-do-readout]')
    await lower.focus()
    for (let i = 0; i < 4; i++) await page.keyboard.press('Enter')
    await expect(lower).toHaveAttribute('aria-disabled', 'true')
    await expect(readout).toHaveText('do is C3')
    const play = page.locator('[data-notes-play]')
    await play.click()
    await expect(play).toHaveClass(/\bis-on\b/)
    await lower.focus()

    // Act
    await page.keyboard.press('Enter')

    // Assert
    await expect(lower).toBeFocused()
    await expect(readout).toHaveText('do is C3')
    await expect(play).toHaveClass(/\bis-on\b/)
    expect(await axState(page, '[data-move-do="-1"]')).toEqual({
      role: 'button',
      name: 'Move do lower',
      disabled: true,
      focusable: true,
      focused: true,
    })
  })

  test("stops Merc's notes, the ring with them, once the section has been away 600 ms", async ({
    page,
  }) => {
    // Arrange: Merc's notes sounding, the ring listening
    await toSing(page, 'lower')
    await page.locator('[data-comfort="sing"]').click()
    const play = page.locator('[data-notes-play]')
    await play.click()
    await expect(play).toHaveClass(/\bis-on\b/)
    await expect(page.locator('#ring .ring-state')).toHaveText('Listen')

    // Act: away to the map and back after a second
    await page.locator('#explorer').scrollIntoViewIfNeeded()
    await page.waitForFunction(
      () =>
        !document
          .querySelector('[data-notes-play]')
          ?.classList.contains('is-on'),
      undefined,
      { timeout: 3000 },
    )
    await page.locator('#singCard').scrollIntoViewIfNeeded()

    // Assert: stopped well before its 10 s, not heard, the ring at rest
    await expect(play).not.toHaveClass(/\bis-on\b/)
    await expect(page.locator('#ring .ring-state')).toHaveText('Rest')
    await expect(page.locator('[data-guide-start]')).toHaveAttribute(
      'aria-disabled',
      'true',
    )
  })
})

/** Mid-sweep, what the guide's canvas shows: a full-height column (the travelling line), and how many pixels are lit full. */
async function guideNow(page: Page): Promise<{ line: boolean; lit: number }> {
  return page.locator('#chordGuide canvas').evaluate((el) => {
    const canvas = el as HTMLCanvasElement
    const ctx = canvas.getContext('2d')
    if (ctx === null) throw new Error('no 2D context')
    const { width: w, height: h } = canvas
    const px = ctx.getImageData(0, 0, w, h).data
    let line = false
    let lit = 0
    for (let x = 0; x < w; x++) {
      let column = 0
      for (let y = 0; y < h; y++) {
        const a = px[(y * w + x) * 4 + 3]
        if (a > 40) column += 1
        if (a >= 250) lit += 1
      }
      // the line runs the guide's height, 6 px short of each edge; no stretch of the path comes near
      if (column > 0.8 * h) line = true
    }
    return { line, lit }
  })
}

/** From now on, every ripple the ring draws and every size its breathing circle takes. */
async function watchRing(
  page: Page,
): Promise<() => Promise<{ ripples: number; radii: string[] }>> {
  await page.evaluate(() => {
    const w = window as unknown as {
      ringLog: { ripples: number; radii: string[] }
    }
    const log = { ripples: 0, radii: [] as string[] }
    w.ringLog = log
    const ring = document.querySelector('#ring')
    if (ring === null) throw new Error('no ring')
    new MutationObserver((records) => {
      for (const r of records) {
        log.ripples += Array.from(r.addedNodes).filter(
          (n) => n.nodeName === 'circle',
        ).length
        const el = r.target as Element
        if (r.attributeName === 'r' && el.classList.contains('ring-breath'))
          log.radii.push(el.getAttribute('r') ?? '')
      }
    }).observe(ring, { subtree: true, childList: true, attributes: true })
  })
  return () =>
    page.evaluate(
      () =>
        (window as unknown as { ringLog: { ripples: number; radii: string[] } })
          .ringLog,
    )
}

/** The ring's countdown through the sweep, `n` seconds left. */
const secondsLeft = (page: Page, n: number): Promise<void> =>
  expect(page.locator('#ring .ring-state')).toHaveText(
    `Sing with the line · ${n}`,
    { timeout: 30_000 },
  )

/** Merc's notes heard, the guide and the ring in view, and Start the guide pressed; the ring watched from then. */
async function startSweep(
  page: Page,
): Promise<() => Promise<{ ripples: number; radii: string[] }>> {
  await toSing(page, 'lower')
  await page.locator('[data-comfort="sing"]').click()
  await playNotes(page)
  // the guide and the ring on screen, where they draw, and kept there
  await page.locator('#ring').scrollIntoViewIfNeeded()
  const ring = await watchRing(page)
  await page.locator('[data-guide-start]').dispatchEvent('click')
  await expect(page.locator('#ring .ring-state')).toHaveText('Get ready')
  return ring
}

test.describe('Sing it in motion and held still, at 390 x 844', () => {
  test.use({ viewport: { width: 390, height: 844 } })
  test.describe.configure({ timeout: 120_000 })

  test('sweeps a travelling line along the path, the ring breathing', async ({
    page,
  }) => {
    const ring = await startSweep(page)

    await secondsLeft(page, 8)
    const now = await guideNow(page)
    await secondsLeft(page, 6)
    const { radii } = await ring()

    expect(now.line).toBe(true)
    expect(new Set(radii).size).toBeGreaterThan(3)
  })

  test("under reduced motion lights the path's notes in turn instead of the line, and the ring holds still with no ripples", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await toSing(page, 'lower')
    await page.locator('[data-comfort="sing"]').click()
    // the guide and the ring on screen, where they draw, and kept there
    await page.locator('#ring').scrollIntoViewIfNeeded()
    const singing = await watchRing(page)
    await playNotes(page, true)
    const sung = await singing()
    const ring = await watchRing(page)
    await page.locator('[data-guide-start]').dispatchEvent('click')

    await secondsLeft(page, 8)
    const early = await guideNow(page)
    await secondsLeft(page, 4)
    const later = await guideNow(page)
    const { radii } = await ring()

    expect(sung.ripples).toBe(0)
    expect([early.line, later.line]).toEqual([false, false])
    expect(early.lit).toBeGreaterThan(0)
    expect(later.lit).toBeGreaterThan(early.lit)
    expect([...new Set(radii)].filter((r) => r !== '150')).toEqual(['153.0'])
  })
})
