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
// Lesson 10 done; its tenth, every practice link carrying lesson=10 before
// any hash and opening a tab of its own, the Wrap's card in both its
// versions; its fourteenth: a visitor with the studio installed still
// gets the lesson, not the shell; and its fourth, page-wide, at both sizes:
// from the top Tab reaches every control, bead and gap button the page
// shows, step by step, free play's among them; each toggle flips
// `aria-pressed` by keyboard; Stack a third hands the focus to Play the
// triad; each change reaches its own live region, in spoken names, never a
// sharp or flat sign; and at 390 x 844 every section's targets, in each
// state a viewer reaches, are at least 44 px square with none overlapping.
// The chord beads step by step by keyboard, and Step 5's predict, are
// learn-lesson-10-beads.spec.ts's; Sing it by keyboard is
// learn-lesson-10-sing.spec.ts's; the page under reduced motion is
// learn-lesson-10-motion.spec.ts's.

import type { Locator, Page } from '@playwright/test'
import { expect, test } from './helpers/lesson-page'
import { expectTargets, expectTogglesFlip, liveSaid, scrollStill, tagReachable, unreached, watchLive, } from './helpers/lesson-qa'

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

/** Every link on the page into the app, other than the lesson pages and the home and plan links, with its target and rel. */
const appLinks = (page: Page): Promise<(string | null)[][]> =>
  page
    .locator('a[href^="/"]')
    .evaluateAll((links) =>
      links
        .map((a) => [
          a.getAttribute('href'),
          a.getAttribute('target'),
          a.getAttribute('rel'),
        ])
        .filter(
          ([href]) =>
            href !== null &&
            href !== '/' &&
            !href.startsWith('/learn/') &&
            !href.startsWith('/#'),
        ),
    )

// WEB-SPEC, End to end 10, as learn-lesson-08.spec.ts checks its card
test("every practice link carries lesson=10 before any hash and opens a tab of its own, and the Wrap's rest card links no singing drill", async ({
  page,
}) => {
  // Arrange: the map's card for this lesson drawn, with its practise link
  await page.goto('/learn/10')
  await expect(page.locator('#exCardHost h3')).toHaveText('Major and minor')
  const practise = page.locator('#practiseCard')
  /** The card's links a viewer sees, each with its target and rel. */
  const shown = (): Promise<(string | null)[][]> =>
    practise
      .locator('a:visible')
      .evaluateAll((links) =>
        links.map((a) => [
          a.getAttribute('href'),
          a.getAttribute('target'),
          a.getAttribute('rel'),
        ]),
      )
  await expect(practise.locator('[data-ending="practise"]')).toBeVisible()
  const practiseLinks = await shown()

  // Act: "Just listen today" leaves the rest card in the Wrap
  await page.locator('[data-comfort="listen"]').click()
  await expect(practise.locator('[data-ending="rest"]')).toBeVisible()
  await expect(practise.locator('[data-ending="practise"]')).toBeHidden()

  // Assert: the practise card links Drone Intonation and Stack, each in a
  // new tab; the rest card only Stack, which needs no voice, with Drone
  // Intonation's address in its words alone, since nothing may send the
  // learner to sing after a rest answer (REQ-GVC-055)
  const drone = ['/pitch-training?lesson=10', '_blank', 'noopener']
  const stack = ['/ear-lab?lesson=10', '_blank', 'noopener']
  expect(practiseLinks).toEqual([drone, stack])
  expect(await shown()).toEqual([stack])
  await expect(practise.locator('[data-ending="rest"]')).toContainText(
    'mercurypitch.com/pitch-training, then tap Drone Intonation.',
  )
  // and every link into the app, the map card's and the footer's among them
  const all = await appLinks(page)
  expect(new Set(all.map(([href]) => href))).toEqual(
    new Set(['/pitch-training?lesson=10', '/ear-lab?lesson=10']),
  )
  for (const [href, target, rel] of all) {
    expect(href, `${href}`).toMatch(/^\/[a-z-]+\?lesson=10(#|$)/)
    expect([target, rel], `${href}`).toEqual(['_blank', 'noopener'])
  }
})

/** Presses `b` by keyboard. */
async function press(page: Page, b: Locator, key = 'Enter'): Promise<void> {
  await b.focus()
  await page.keyboard.press(key)
}

// WEB-SPEC, End to end 4, page-wide, at a phone's size and a desktop's
for (const viewport of [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
]) {
  test.describe(`the whole page by keyboard at ${viewport.width} x ${viewport.height}`, () => {
    test.use({ viewport })
    test.describe.configure({ timeout: 180_000 })

    test("Tab reaches every control from the top, then each step's controls, beads and gaps; each toggle flips aria-pressed, Stack a third hands the focus to Play the triad, and each change reaches its live region", async ({
      page,
    }) => {
      // Arrange: sound on, so no hint says it is off, and every live text kept
      await watchLive(page)
      await page.goto('/learn/10')
      await page.locator('#gateBtn').click()
      await expect(page.locator('#exList .ex-row')).toHaveCount(15)
      const toy = (sel: string): Locator => page.locator(`#toyChord ${sel}`)
      const free = (sel: string): Locator => page.locator(`#freePlay ${sel}`)

      // Act, Assert: from the top, free play's beads and gaps among them
      const shown = await tagReachable(page, 'body', 'top')
      expect(shown).toBeGreaterThan(60)
      expect(await unreached(page, null, 'top', shown)).toEqual([])
      expect(await expectTogglesFlip(page, '#mast', 'the masthead')).toBe(2)
      expect(await expectTogglesFlip(page, '#freePlay', 'free play')).toBe(4)
      await press(page, free('[data-chord-root="1"]'))
      await press(page, free('[data-quality="minor"]'))

      // each step by keyboard: its stage's controls, beads and gaps, and its
      // text. A walk scrolls the page, and on a wide screen the step in the
      // viewport's middle picks the toy, so after one the step's address
      // opens it again, as a step link does
      const reopen = async (n: number): Promise<void> => {
        await page.evaluate((s) => {
          window.location.hash = ''
          window.location.hash = `#step-${s}`
        }, n)
        await expect(page.locator('#stepNow')).toHaveText(String(n))
        await expect.poll(() => scrollStill(page)).toBe(true)
      }
      await reopen(1)
      for (const n of [1, 2, 3, 4, 5]) {
        if (n > 1) await press(page, page.getByLabel('Next step'))
        await expect(page.locator('#stepNow')).toHaveText(String(n))
        await expect.poll(() => scrollStill(page)).toBe(true)
        if (n === 2) {
          await press(page, toy('[data-chord-stack]'))
          await expect(toy('[data-chord-play="triad"]')).toBeFocused()
        }
        if (n === 5)
          await press(page, page.locator('#predictScale [data-choice="three"]'))
        expect(
          await expectTogglesFlip(page, '#toyChord', `Step ${n}`),
        ).toBeGreaterThan(0)
        const count = await tagReachable(page, '#lesson', `step${n}`)
        expect(
          await unreached(page, '#lesson', `step${n}`, count),
          `Step ${n}`,
        ).toEqual([])
        // the walk scrolled past the step's text
        await reopen(n)
      }

      // Assert: each change said in its own live region, and never a sign
      const said = await liveSaid(page)
      for (const line of [
        { where: 'freePlay', text: 'Root higher: D, F sharp, A. D major.' },
        {
          where: 'freePlay',
          text: 'Minor: the third moved down a semitone, to F 4. D minor.',
        },
        {
          where: 'toyChord',
          text: 'Minor: the top note moved down a semitone, to E flat 4. A minor third.',
        },
        { where: 'toyChord', text: 'Stacked: C, E, G. C major.' },
        {
          where: 'toyChord',
          text: 'Scale: C, D, E, F, G, A, B, C. C major scale.',
        },
        {
          where: 'announcer',
          text: 'Step 2 of 5: What if I stack another third on top?',
        },
      ])
        expect(said).toContainEqual(line)
      expect(said.filter((s) => /[♯♭]/u.test(s.text))).toEqual([])
    })
  })
}

// WEB-SPEC, End to end 4's targets, page-wide, at 390 x 844
test.describe('every target on the page at 390 x 844', () => {
  test.use({ viewport: { width: 390, height: 844 } })
  test.describe.configure({ timeout: 120_000 })

  test('is at least 44 px square, none overlapping, and nothing scrolls sideways, in every section and state', async ({
    page,
  }) => {
    // Arrange
    await page.goto('/learn/10')
    const counted: Record<string, number> = {}
    const check = async (scope: string, what: string): Promise<void> => {
      counted[what] = await expectTargets(page, scope, what)
    }

    // Act, Assert: section by section, each state a viewer reaches
    await check('section.hero', 'the cold open')
    await page.locator('#predict [data-choice="mi"]').click()
    await check('section.hero', 'the cold open, chosen')
    await check('#recall', 'the recall')
    await check('#words', 'the four words')
    await check('#sing', 'Sing it: the comfort check')
    await page.locator('[data-comfort="sing"]').click()
    await check('#sing', 'Sing it: the voice choice')
    await page.locator('[data-voice="lower"]').click()
    await check('#sing', 'Sing it: ready')
    await check('#check', 'the quick check')
    await check('#wrap', 'the Wrap and free play')
    await page.locator('#freePlay [data-view="scale"]').click()
    await check('#wrap', 'the Wrap, free play spread')
    await check('#explorer', 'the season map')
    await page.reload()
    await page.locator('[data-comfort="listen"]').click()
    await check('#sing', 'Sing it: just listen')

    expect(
      Object.entries(counted).filter(([, n]) => n === 0),
      'a section with no target',
    ).toEqual([])
  })
})

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
