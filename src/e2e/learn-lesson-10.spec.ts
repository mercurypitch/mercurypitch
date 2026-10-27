// ============================================================
// Lesson 10 loads at /learn/10 as its own document, and boots
// ============================================================
//
// A draft until Lesson 6's page is live and the vocal coach has looked at
// the sung checkpoint. Every build carries its document, and the e2e bundle
// shows drafts (`build:e2e` sets VITE_DRAFT_LESSONS=1); on mercurypitch.com
// the site worker answers its address with the 404 page until the admin
// console publishes it (src/lesson-gate.ts). Like every lesson it must load
// as itself, never as the 404 page or the studio's cached app shell, and
// its module must boot. Then WEB-SPEC's first end-to-end check (Tests, End
// to end 1), at a phone's size and a desktop's: no AudioContext before the
// first tap, and nothing plays before a play button; its second, the cold
// open: Play the chord before a choice, the moves locked until one, the
// reveal waiting for both moves heard to their end with sound on, and no
// gold on the spiral until it shows, its ring naming each black key by its
// flat; its ninth, the recall shown to everyone and marking nothing done,
// with Lesson 6's step links in a new tab, and the quick check marking
// Lesson 10 done; and its fourteenth: a visitor with the studio installed
// still gets the lesson, not the shell. Its fourth, the chord beads by
// keyboard alone, step by step as each step is wired: Tab reaches every
// control, bead and gap button, the switches toggle `aria-pressed`, Stack
// a third hands the focus to Play the triad, each change reaches the toy's
// polite line, and at 390 x 844 every target is at least 44 px square with
// none overlapping. Each toy's own checks join it as that toy is wired.

import type { Locator, Page } from '@playwright/test'
import { expect, test } from './helpers/lesson-page'

// 60 characters at most (src/tests/lesson-pages.test.ts)
const TITLE = 'Major and minor: the one note that changes | MercuryPitch'

/**
 * Counts the page's AudioContexts and every sound source it starts, from
 * before its first script runs.
 */
async function watchSound(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { audioContexts: number; sources: number }
    w.audioContexts = 0
    w.sources = 0
    const Real = window.AudioContext
    window.AudioContext = class extends Real {
      constructor(options?: AudioContextOptions) {
        super(options)
        w.audioContexts += 1
      }
    }
    const start = AudioScheduledSourceNode.prototype.start
    AudioScheduledSourceNode.prototype.start = function (
      this: AudioScheduledSourceNode,
      ...args: Parameters<typeof start>
    ) {
      w.sources += 1
      start.apply(this, args)
    }
  })
}

/** How many AudioContexts the page has made, and how many sounds it has started. */
const heard = (page: Page): Promise<{ contexts: number; sources: number }> =>
  page.evaluate(() => {
    const w = window as unknown as { audioContexts: number; sources: number }
    return { contexts: w.audioContexts, sources: w.sources }
  })

// WEB-SPEC, End to end 1, at a phone's size and a desktop's
for (const viewport of [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
]) {
  test.describe(`the page at ${viewport.width} x ${viewport.height}`, () => {
    test.use({ viewport })

    test('a hard load of /learn/10 answers 200 with the lesson @smoke', async ({
      page,
    }) => {
      // Act
      const response = await page.goto('/learn/10')

      // Assert
      expect(response?.status()).toBe(200)
      await expect(page).toHaveTitle(TITLE)
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(
        'Which single note turns a major chord into a minor one?',
      )
      await expect(page.locator('#root')).toHaveCount(0)
      // a written lesson: no film, so no Watch section
      await expect(page.locator('#watch')).toHaveCount(0)
    })

    test('the page boots with no AudioContext until the first tap, the deck and the map drawn @smoke', async ({
      page,
    }) => {
      // Arrange
      const errors: string[] = []
      page.on('pageerror', (e) => errors.push(e.message))
      await watchSound(page)
      // the page booted: the map drawn, and the deck on Step 1 (read before the
      // scroll, which the steps follow)
      await page.goto('/learn/10')
      await expect(page.locator('#exList .ex-row')).toHaveCount(15)
      await expect(page.locator('#stepNow')).toHaveText('1')
      await expect(page.locator('#deckNextLabel')).toHaveText(
        'Next: What if I stack another third on top?',
      )

      // Act: the whole page read, top to bottom, with no tap
      for (const id of ['#predict', '#words', '#lesson', '#sing', '#wrap'])
        await page.locator(id).scrollIntoViewIfNeeded()

      // Assert
      expect(await heard(page)).toEqual({ contexts: 0, sources: 0 })
      await expect(page.locator('.lm-btn')).toBeVisible()
      // Lesson 11 has no page yet: the Wrap's card leads to it on the map
      await expect(page.locator('#wrap a.next-card')).toHaveAttribute(
        'data-select-lesson',
        '11',
      )
      expect(errors).toEqual([])
    })

    test("nothing plays but the sound switch's own chime until a play button is pressed", async ({
      page,
    }) => {
      // Arrange: sound on from the gate, which confirms it with its two soft notes
      await watchSound(page)
      await page.goto('/learn/10')
      await page.locator('#gateBtn').click()
      await expect(page.locator('#soundSwitch')).toHaveAttribute(
        'aria-pressed',
        'true',
      )
      const after = await heard(page)

      // Act: a choice, the steps and the sections, none of them a play button
      await page.locator('#predict [data-choice="mi"]').click()
      await page.getByRole('button', { name: 'Next step', exact: true }).click()
      await expect(page.locator('#stepNow')).toHaveText('2')
      for (const id of ['#words', '#sing', '#wrap', '#explorer'])
        await page.locator(id).scrollIntoViewIfNeeded()

      // Assert
      expect(after.contexts).toBe(1)
      expect(await heard(page)).toEqual(after)
    })
  })
}

/** How many of the hero spiral's pixels are the page's gold (#ffd84d), which only mi's halo takes, from the reveal. */
const goldPixels = (page: Page): Promise<number> =>
  page.locator('#heroSpiral canvas').evaluate((c: HTMLCanvasElement) => {
    const ctx = c.getContext('2d')
    if (ctx === null) return -1
    const { data } = ctx.getImageData(0, 0, c.width, c.height)
    let n = 0
    for (let i = 0; i < data.length; i += 4)
      if (
        data[i] > 225 &&
        data[i + 1] > 190 &&
        data[i + 1] < 235 &&
        data[i + 2] < 130
      )
        n += 1
    return n
  })

// WEB-SPEC, End to end 2, at a phone's size and a desktop's
for (const viewport of [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
]) {
  test.describe(`the cold open at ${viewport.width} x ${viewport.height}`, () => {
    test.use({ viewport })

    test('Play the chord plays before a choice, the moves wait for one, and the reveal waits for both heard to their end with sound on', async ({
      page,
    }) => {
      test.setTimeout(90_000)
      // Arrange
      const errors: string[] = []
      page.on('pageerror', (e) => errors.push(e.message))
      await watchSound(page)
      await page.goto('/learn/10')
      const chord = page.locator('#heroPlay')
      const [mi, so] = ['move-mi', 'move-so'].map((p) =>
        page.locator(`.hero-plays [data-play="${p}"]`),
      )
      const spiral = page.locator('#heroSpiral canvas')
      const reveal = page.locator('#predict .reveal')
      const hint = page.locator('#predict .lock-hint')
      const said = page.locator('[data-hero-said]')
      const sound = page.locator('#soundSwitch')
      /** Plays `b` and waits for it to finish. */
      const playThrough = async (b: Locator): Promise<void> => {
        await b.click()
        await expect(b).toHaveClass(/\bis-on\b/)
        await expect(b).not.toHaveClass(/\bis-on\b/, { timeout: 10_000 })
      }

      // Act, Assert: Play the chord before a choice plays and reveals nothing
      await sound.click()
      await expect(sound).toHaveAttribute('aria-pressed', 'true')
      for (const b of [mi, so]) await expect(b).toBeDisabled()
      await playThrough(chord)
      await expect(said).toHaveText('C, E and G together.')
      await expect(reveal).toBeHidden()
      expect((await heard(page)).sources).toBeGreaterThan(0)

      // the choice unlocks the two moves
      await page.locator('#predict [data-choice="mi"]').click()
      for (const b of [mi, so]) await expect(b).toBeEnabled()

      // mi heard to its end, landed on E flat 4, leaves it hidden, with nothing gold
      await playThrough(mi)
      await expect(said).toHaveText('Mi moved down a semitone: C, E flat, G.')
      await expect(hint).toHaveText(
        'Now hear both moves, mi down and so down, for the answer.',
      )
      await expect(reveal).toBeHidden()
      expect(await goldPixels(page)).toBe(0)

      // so cut short by a note played on the spiral brings nothing
      await so.click()
      await expect(so).toHaveClass(/\bis-on\b/)
      await spiral.focus()
      await page.keyboard.press('Enter')
      await expect(so).not.toHaveClass(/\bis-on\b/)
      await expect(reveal).toBeHidden()

      // and so does so cut short as the Sound switch silences it
      await so.click()
      await expect(so).toHaveClass(/\bis-on\b/)
      await sound.click()
      await expect(sound).toHaveAttribute('aria-pressed', 'false')
      await expect(so).not.toHaveClass(/\bis-on\b/)
      await expect(reveal).toBeHidden()

      // with sound off, so says nothing played, and still no reveal
      await playThrough(so)
      await expect(hint).toHaveText(
        'Sound is off, so nothing played. Turn sound on to hear the chord, then play it again.',
      )
      await expect(reveal).toBeHidden()
      expect(await goldPixels(page)).toBe(0)

      // sound on, so heard to its end brings the reveal, and mi's gold halo
      await sound.click()
      await expect(sound).toHaveAttribute('aria-pressed', 'true')
      await playThrough(so)
      await expect(reveal).toBeVisible()
      await expect(reveal.locator('.mono')).toHaveText('You said: mi')
      await expect.poll(() => goldPixels(page)).toBeGreaterThan(0)
      expect(errors).toEqual([])
    })

    test('the ring names each black key by its flat, and nothing on the spiral is gold before the reveal', async ({
      page,
    }) => {
      // Arrange
      await page.goto('/learn/10')
      const spiral = page.locator('#heroSpiral canvas')
      await spiral.scrollIntoViewIfNeeded()

      // Act: from the slider's first note, A3, six up to E flat 4
      await spiral.focus()
      for (let i = 0; i < 6; i++) await page.keyboard.press('ArrowRight')

      // Assert: the page's names are flats (WEB-SPEC, Toys 2)
      await expect(spiral).toHaveAttribute(
        'aria-valuetext',
        'E flat 4, 311 hertz',
      )
      expect(await goldPixels(page)).toBe(0)
    })
  })
}

/** The steps' chord beads. */
const TOY = '#toyChord'

/** What has the focus, by name: its label, or its words. */
const focusedName = (page: Page): Promise<string> =>
  page.evaluate(() => {
    const el = document.activeElement
    return (el?.getAttribute('aria-label') ?? el?.textContent ?? '')
      .replace(/\s+/g, ' ')
      .trim()
  })

/** Opens step `n` from the address, as a step link does. */
async function openStep(page: Page, n: number): Promise<void> {
  await page.goto(`/learn/10#step-${n}`)
  await expect(page.locator('#stepNow')).toHaveText(String(n))
}

/** The names Tab meets from `from`, one for each of `count` presses. */
async function tabsFrom(
  page: Page,
  from: Locator,
  count: number,
): Promise<string[]> {
  await from.focus()
  const met: string[] = []
  for (let i = 0; i < count; i++) {
    await page.keyboard.press('Tab')
    met.push(await focusedName(page))
  }
  return met
}

interface Box {
  readonly name: string
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
}

/** Every button showing on the stage: at least 44 px square, and no two overlapping. */
async function expectTargets(page: Page, what: string): Promise<void> {
  const boxes: Box[] = await page
    .locator(`${TOY} button:visible`)
    .evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect()
        return {
          name: el.getAttribute('aria-label') ?? el.textContent?.trim() ?? '',
          x: r.x,
          y: r.y,
          w: r.width,
          h: r.height,
        }
      }),
    )
  expect(boxes.length, what).toBeGreaterThan(0)
  for (const b of boxes) {
    expect(b.w, `${what}: ${b.name}`).toBeGreaterThanOrEqual(44)
    expect(b.h, `${what}: ${b.name}`).toBeGreaterThanOrEqual(44)
  }
  // a segmented switch's halves meet edge to edge, a fraction of a pixel
  // either way, as Lesson 7's controls do
  const overlap = (a: Box, b: Box): boolean =>
    a.x < b.x + b.w - 0.5 &&
    b.x < a.x + a.w - 0.5 &&
    a.y < b.y + b.h - 0.5 &&
    b.y < a.y + a.h - 0.5
  boxes.forEach((a, i) =>
    boxes.forEach((b, j) => {
      if (i < j)
        expect(overlap(a, b), `${what}: ${a.name} and ${b.name}`).toBe(false)
    }),
  )
}

// WEB-SPEC, End to end 4, Steps 1 and 2, at a phone's size and a desktop's
for (const viewport of [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
]) {
  test.describe(`the chord beads by keyboard at ${viewport.width} x ${viewport.height}`, () => {
    test.use({ viewport })

    test('Step 1: Tab reaches every control, bead and gap button; Major · Minor and Slow toggle aria-pressed, and the switch is said', async ({
      page,
    }) => {
      // Arrange
      await openStep(page, 1)
      const said = page.locator(`${TOY} [data-chord-said]`)
      const [major, minor] = ['major', 'minor'].map((qy) =>
        page.locator(`${TOY} [data-chord-quality] [data-quality="${qy}"]`),
      )
      const slow = page.locator(`${TOY} [data-chord-slow]`)

      // Act: Tab from Play the third
      const met = await tabsFrom(
        page,
        page.locator(`${TOY} [data-chord-play="third"]`),
        6,
      )

      // Assert: the controls in reading order, then the beads, then the gap
      expect(met).toEqual([
        'Slow',
        'Major',
        'Minor',
        'C 4, the bottom note',
        'E 4, the top note',
        '4, major third: C 4 up to E 4',
      ])

      // Act, Assert: Minor by keyboard, said once, the gap renamed
      await expect(major).toHaveAttribute('aria-pressed', 'true')
      await minor.focus()
      await page.keyboard.press('Enter')
      await expect(minor).toHaveAttribute('aria-pressed', 'true')
      await expect(major).toHaveAttribute('aria-pressed', 'false')
      await expect(said).toHaveText(
        'Minor: the top note moved down a semitone, to E flat 4. A minor third.',
      )
      await expect(page.locator(`${TOY} .chord-hit-gap`)).toHaveAttribute(
        'aria-label',
        '3, minor third: C 4 up to E flat 4',
      )

      // Slow on and off by keyboard
      await slow.focus()
      await page.keyboard.press('Space')
      await expect(slow).toHaveAttribute('aria-pressed', 'true')
      await page.keyboard.press('Space')
      await expect(slow).toHaveAttribute('aria-pressed', 'false')
    })

    test('Step 2: Stack a third hands the focus to Play the triad and says what it stacked, and Tab reaches the three beads and both gaps', async ({
      page,
    }) => {
      // Arrange
      await openStep(page, 2)
      const stack = page.locator(`${TOY} [data-chord-stack]`)
      const triad = page.locator(`${TOY} [data-chord-play="triad"]`)
      await expect(triad).toBeHidden()

      // Act
      await stack.focus()
      await page.keyboard.press('Enter')

      // Assert
      await expect(triad).toBeFocused()
      await expect(stack).toBeHidden()
      await expect(page.locator(`${TOY} [data-chord-said]`)).toHaveText(
        'Stacked: C, E, G. C major.',
      )
      expect(await tabsFrom(page, triad, 6)).toEqual([
        'Slow',
        'C 4, the root',
        'E 4, the third',
        'G 4, the fifth',
        '4, major third: C 4 up to E 4',
        '3, minor third: E 4 up to G 4',
      ])
    })
  })
}

// WEB-SPEC, End to end 4's targets, at 390 x 844
test.describe('the chord beads’ targets at 390 x 844', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('every target of Steps 1 and 2 is at least 44 px square, and none overlaps another', async ({
    page,
  }) => {
    // Arrange
    await openStep(page, 1)
    await expect(page.locator(`${TOY} .chord-hit`)).toHaveCount(3)

    // Act, Assert: Step 1 in major and in minor, Step 2 before and after its stack
    await expectTargets(page, 'Step 1')
    await page
      .locator(`${TOY} [data-chord-quality] [data-quality="minor"]`)
      .click()
    await expectTargets(page, 'Step 1 in minor')
    await page.getByRole('button', { name: 'Next step', exact: true }).click()
    await expect(page.locator('#stepNow')).toHaveText('2')
    await expectTargets(page, 'Step 2')
    await page.locator(`${TOY} [data-chord-stack]`).click()
    await expect(page.locator(`${TOY} .chord-hit`)).toHaveCount(5)
    await expectTargets(page, 'Step 2 stacked')
  })
})

// WEB-SPEC, End to end 9, at a phone's size and a desktop's
for (const viewport of [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
]) {
  test.describe(`the quizzes at ${viewport.width} x ${viewport.height}`, () => {
    test.use({ viewport })

    test("the recall shows open to everyone, marks nothing done and links Lesson 6's steps in a new tab; the quick check marks Lesson 10 done", async ({
      page,
    }) => {
      // Arrange: no lesson done
      await page.goto('/learn/10')
      expect(await page.evaluate(() => localStorage.getItem('fyp-done'))).toBe(
        null,
      )
      const recall = page.locator('#recall-qs')
      const check = page.locator('#qs')
      /** Answers `option`, in `quiz`. */
      const answer = (quiz: Locator, option: string): Promise<void> =>
        quiz.getByRole('button', { name: option, exact: true }).click()

      // Act: the recall, open, both answered with the misconception
      await expect(page.locator('#recallQuiz')).toBeVisible()
      await expect(recall.locator('.q')).toHaveCount(2)
      await answer(recall, '5 semitones: a perfect fourth')
      await answer(recall, 'A step')

      // Assert: nothing marked done, and each step link opens Lesson 6 in a new tab
      expect(await page.evaluate(() => localStorage.getItem('fyp-done'))).toBe(
        null,
      )
      const links = await recall
        .locator('.fb a')
        .evaluateAll((as) =>
          as.map((a) => [
            a.getAttribute('href'),
            a.getAttribute('target'),
            a.textContent,
          ]),
        )
      expect(links).toEqual([
        ['/learn/06#step-5', '_blank', 'Try Lesson 6, Step 5 again'],
        ['/learn/06#step-2', '_blank', 'Try Lesson 6, Step 2 again'],
      ])

      // Act: question 2's chord plays from its slot, then the quick check,
      // a wrong answer's step link first
      const chord = check.getByRole('button', {
        name: "Play the question's chord",
      })
      await chord.click()
      await expect(chord).toHaveClass(/\bis-on\b/)
      await expect(chord).not.toHaveClass(/\bis-on\b/, { timeout: 10_000 })
      await answer(check, "They're right: minor sounds sad to everyone")
      await check.locator('a', { hasText: 'Try Step 4 again' }).click()
      await expect(page.locator('#stepNow')).toHaveText('4')
      await answer(check, '3')
      await answer(check, 'Minor')
      await answer(check, 'E, A and B: mi, la and ti become me, le and te')

      // Assert: every line starts the kit's way, and Lesson 10 is done
      await expect(page.locator('#scoreN')).toHaveText('3')
      const lines = await page
        .locator('#recall-qs .fb, #qs .fb')
        .evaluateAll((els) => els.map((e) => e.textContent?.trim() ?? ''))
      expect(lines).toHaveLength(6)
      for (const line of lines) expect(line).toMatch(/^(Right\.|Not quite\.)/)
      expect(await page.evaluate(() => localStorage.getItem('fyp-done'))).toBe(
        '[10]',
      )
      // the map's card on a desktop, the list's open row on a phone
      await page.locator('#explorer').scrollIntoViewIfNeeded()
      await expect(page.locator('#explorer .ex-card')).toContainText('Done')
    })
  })
}

// WEB-SPEC, End to end 14, as Lesson 3's spec checks its own
test('a visitor with the studio installed still gets the lesson, not the shell @smoke', async ({
  page,
}) => {
  // Arrange: the studio's service worker installed, and in control
  await page.goto('/')
  await page.waitForFunction(
    async () =>
      (await navigator.serviceWorker.getRegistration('/')) !== undefined,
    undefined,
    { timeout: 20_000 },
  )
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await page.reload()
  await page.waitForFunction(
    () => navigator.serviceWorker.controller !== null,
    undefined,
    { timeout: 20_000 },
  )

  // Act
  await page.goto('/learn/10')

  // Assert
  await expect(page).toHaveTitle(TITLE)
  await expect(page.locator('#root')).toHaveCount(0)
})
