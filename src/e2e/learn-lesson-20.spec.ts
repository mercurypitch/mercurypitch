// ============================================================
// Lesson 20 loads at /learn/20 as its own document, and boots
// ============================================================
//
// A Season 2 voice lesson, a draft until Lessons 5, 9 and 10 are live and
// the vocal coach has signed it off. Every build carries its document, and
// the e2e bundle shows drafts (`build:e2e` sets VITE_DRAFT_LESSONS=1); on
// mercurypitch.com the site worker answers its address with the 404 page
// until the admin console publishes it (src/lesson-gate.ts). Like every
// lesson it must load as itself, never as the 404 page or the studio's
// cached app shell, and its module must boot: at a phone's size and a
// desktop's, no AudioContext before the first tap, and nothing plays
// before a play button; and a visitor with the studio installed still gets
// the lesson, not the shell. It carries Season 2, so its masthead and its
// map are Season 2's, and it draws no staff for show (WEB-SPEC, Look).
// Then the page as a viewer plays it: the cold open's two runs and its
// predict, the three words that play, one sound at a time, the run's beads
// as buttons over the beads, nothing asked of the microphone or sent away
// before Start, and every target a fingertip wide. Sing it's takes are
// learn-lesson-20-sing.spec.ts's, on the fake microphone.

import type { Locator, Page } from '@playwright/test'
import { expect, test } from './helpers/lesson-page'
import { expectTargets, openStep } from './helpers/lesson-qa'

// 60 characters at most (src/tests/lesson-pages.test.ts)
const TITLE = 'Pentatonic scale and singing fast runs | MercuryPitch'

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

for (const viewport of [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
]) {
  test.describe(`the page at ${viewport.width} x ${viewport.height}`, () => {
    test.use({ viewport })

    test('a hard load of /learn/20 answers 200 with the lesson @smoke', async ({
      page,
    }) => {
      // Act
      const response = await page.goto('/learn/20')

      // Assert
      expect(response?.status()).toBe(200)
      await expect(page).toHaveTitle(TITLE)
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(
        'How do singers sing a fast run without the notes smudging together?',
      )
      await expect(page.locator('#root')).toHaveCount(0)
      // a written lesson: no film, so no Watch section
      await expect(page.locator('#watch')).toHaveCount(0)
    })

    test("the page boots with no AudioContext until the first tap, the deck and Season 2's map drawn @smoke", async ({
      page,
    }) => {
      // Arrange
      const errors: string[] = []
      page.on('pageerror', (e) => errors.push(e.message))
      await watchSound(page)
      await page.goto('/learn/20')
      await expect(
        page.locator('.ex-seasons [data-season="2"]'),
      ).toHaveAttribute('aria-pressed', 'true')
      await expect(page.locator('#stepNow')).toHaveText('1')
      await expect(page.locator('#deckNextLabel')).toHaveText(
        'Next: Is there a minor pentatonic too?',
      )

      // Act: the whole page read, top to bottom, with no tap
      for (const id of ['#predict', '#words', '#lesson', '#sing', '#wrap'])
        await page.locator(id).scrollIntoViewIfNeeded()

      // Assert
      expect(await heard(page)).toEqual({ contexts: 0, sources: 0 })
      await expect(page.locator('.lm-btn')).toBeVisible()
      // the Wrap's card names the lesson after this one, from Season 2
      await expect(page.locator('#wrap a.next-card .eyebrow')).toContainText(
        'Next lesson 21',
      )
      expect(errors).toEqual([])
    })

    test("nothing plays but the sound switch's own chime until a play button is pressed", async ({
      page,
    }) => {
      // Arrange: sound on from the gate, which confirms it with its two soft notes
      await watchSound(page)
      await page.goto('/learn/20')
      await page.locator('#gateBtn').click()
      await expect(page.locator('#soundSwitch')).toHaveAttribute(
        'aria-pressed',
        'true',
      )
      const after = await heard(page)

      // Act: a choice, the steps and the sections, none of them a play button
      await page.locator('#predict [data-choice="time"]').click()
      await page.getByRole('button', { name: 'Next step', exact: true }).click()
      await expect(page.locator('#stepNow')).toHaveText('2')
      for (const id of ['#words', '#sing', '#wrap', '#explorer'])
        await page.locator(id).scrollIntoViewIfNeeded()

      // Assert
      expect(after.contexts).toBe(1)
      expect(await heard(page)).toEqual(after)
    })

    test('draws no staff for show: no background staff behind the page, and none on a section head (WEB-SPEC, Look)', async ({
      page,
    }) => {
      // Act
      await page.goto('/learn/20')
      const background = await page.evaluate(
        () => getComputedStyle(document.body).backgroundImage,
      )

      // Assert: the three glows stay, the five-line tile goes
      expect(background).not.toContain('repeating-linear-gradient')
      expect(background).toContain('radial-gradient')
      await expect(page.locator('.mv-staff')).toHaveCount(0)
    })
  })
}

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
  await page.goto('/learn/20')

  // Assert
  await expect(page).toHaveTitle(TITLE)
  await expect(page.locator('#root')).toHaveCount(0)
})

/** Counts every ask for the microphone, from before the page's first script. */
async function spyOnMicrophone(page: Page): Promise<() => Promise<number>> {
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
  return () =>
    page.evaluate(() => (window as unknown as { micAsks: number }).micAsks)
}

/** Moves the deck on by its Next step button, to step `n`. */
async function nextStep(page: Page, n: number): Promise<void> {
  await page.getByRole('button', { name: 'Next step', exact: true }).click()
  await expect(page.locator('#stepNow')).toHaveText(String(n))
}

/** Presses a play button and waits while it lights and goes dark: its sound heard to its end. */
async function hearOut(play: Locator, timeout = 8000): Promise<void> {
  await play.click()
  await expect(play).toHaveClass(/\bis-on\b/, { timeout: 2000 })
  await expect(play).not.toHaveClass(/\bis-on\b/, { timeout })
}

test('the cold open: the run fast and slowly for everyone, each lit while it plays and either stopping the other; the choice locks both and shows the reveal, the status line speaking it (WEB-SPEC, Toys 2 and 3)', async ({
  page,
}) => {
  // Arrange
  await page.goto('/learn/20')
  await page.locator('#gateBtn').click()
  const fast = page.locator('.hero-plays [data-play="fast"]')
  const slow = page.locator('.hero-plays [data-play="slow"]')
  const reveal = page.locator('#predict .reveal')

  // Act: the fast run heard out, 1.80 s; the slow one, 5.40 s, cut short by it
  await hearOut(fast, 4000)
  await slow.click()
  await expect(slow).toHaveClass(/\bis-on\b/)
  await fast.click()
  const hidden = await reveal.isHidden()
  await page.locator('#predict [data-choice="share"]').click()

  // Assert
  await expect(slow).not.toHaveClass(/\bis-on\b/)
  expect(hidden).toBe(true)
  await expect(reveal).toBeVisible()
  await expect(page.locator('#predict .lock-hint')).toBeHidden()
  for (const c of ['time', 'share'])
    await expect(page.locator(`#predict [data-choice="${c}"]`)).toBeDisabled()
  await expect(page.locator('[data-announcer]')).toContainText(
    'What share of their tries came out right.',
  )
  // the hero still plays after the choice
  await hearOut(fast, 4000)
})

test('three of the four words play, each said once heard, and Agility plays nothing (WEB-SPEC, Toys 4)', async ({
  page,
}) => {
  // Arrange
  test.setTimeout(60_000)
  await page.goto('/learn/20#words')
  await page.locator('#gateBtn').click()
  const said = page.locator('[data-words-said]')

  for (const [word, line] of [
    ['run', "Merc's run, slowly: a note every 0.6 seconds."],
    [
      'pentatonic',
      'C major pentatonic: C, D, E, G, A, C. Steps of 2, 2, 3, 2 and 3 semitones.',
    ],
    [
      'minor',
      'A minor pentatonic: A, C, D, E, G, A. Steps of 3, 2, 2, 3 and 2 semitones.',
    ],
  ]) {
    // Act
    await hearOut(page.locator(`[data-word-play="${word}"]`), 10_000)

    // Assert
    await expect(said).toHaveText(line)
  }
  await expect(page.locator('[data-word-play="agility"]')).toHaveCount(0)
})

test("one sound at a time: a word's play stops the hero's run, a step's play stops a word's, and the hero's run stops a step's (WEB-SPEC, Tests 15)", async ({
  page,
}) => {
  // Arrange: sound on and the choice made
  await page.goto('/learn/20')
  await page.locator('#gateBtn').click()
  await page.locator('#predict [data-choice="time"]').click()

  // Act: each press 150 ms after the one before, by script, so no press
  // scrolls a play off screen (which stops it after 600 ms on its own)
  const lit = await page.evaluate(async () => {
    const HERO = '.hero-plays [data-play="slow"]'
    const WORD = '#words [data-word-play="run"]'
    const STEP = '#toyStairs [data-stairs-play="up"]'
    const on = (sel: string): boolean =>
      document.querySelector(sel)?.classList.contains('is-on') ?? false
    const press = async (sel: string) => {
      document.querySelector<HTMLElement>(sel)?.click()
      await new Promise((r) => window.setTimeout(r, 150))
      return [HERO, WORD, STEP].filter(on).join(' ')
    }
    return [
      await press(HERO),
      await press(WORD),
      await press(STEP),
      await press(HERO),
      await press(STEP),
      await press(WORD),
    ]
  })

  // Assert: only the newest is lit, every time
  expect(lit).toEqual([
    '.hero-plays [data-play="slow"]',
    '#words [data-word-play="run"]',
    '#toyStairs [data-stairs-play="up"]',
    '.hero-plays [data-play="slow"]',
    '#toyStairs [data-stairs-play="up"]',
    '#words [data-word-play="run"]',
  ])
})

test("the run's beads are buttons over the beads at a desktop's size, in the steps and in free play: a clear fingertip square on each, up the run to la and back down (WEB-SPEC, Contract)", async ({
  page,
}) => {
  // Arrange
  await page.setViewportSize({ width: 1440, height: 900 })
  await openStep(page, '/learn/20', 3)

  for (const toy of ['#toyRun', '#freeRun']) {
    // Act
    await page.locator(toy).scrollIntoViewIfNeeded()
    const beads = await page.locator(`${toy} .bead-hit`).evaluateAll((bs) =>
      bs.map((b) => {
        const r = b.getBoundingClientRect()
        const look = getComputedStyle(b)
        return {
          x: r.x + r.width / 2,
          y: Math.round(r.y + r.height / 2),
          size: [Math.round(r.width), Math.round(r.height)],
          clear: look.backgroundColor === 'rgba(0, 0, 0, 0)',
        }
      }),
    )

    // Assert
    expect(beads, toy).toHaveLength(9)
    for (const b of beads) expect(b.size, toy).toEqual([44, 44])
    expect(
      beads.every((b) => b.clear),
      toy,
    ).toBe(true)
    for (let i = 1; i < 9; i++)
      expect(beads[i].x, `${toy} bead ${String(i)}`).toBeGreaterThanOrEqual(
        beads[i - 1].x + 44,
      )
    // do, re, mi, so up to la, then down again: each higher on the way up
    const ys = beads.map((b) => b.y)
    for (let i = 1; i <= 4; i++) expect(ys[i], toy).toBeLessThan(ys[i - 1])
    for (let i = 5; i < 9; i++) expect(ys[i], toy).toBeGreaterThan(ys[i - 1])
    expect(ys[8], toy).toBe(ys[0])
  }
})

test('the page asks for no microphone before Start, sends nothing away and keeps only its own keys, through the cold open, a word, the steps, Sing it, free play and the quizzes', async ({
  page,
}) => {
  // Arrange: every ask for the microphone counted, every request off this site kept
  test.setTimeout(60_000)
  const asks = await spyOnMicrophone(page)
  const away: string[] = []
  page.on('request', (r) => {
    const u = new URL(r.url())
    if (
      u.protocol.startsWith('http') &&
      u.hostname !== 'localhost' &&
      u.hostname !== '127.0.0.1'
    )
      away.push(u.href)
  })
  await page.goto('/learn/20')

  // Act: the choice and a run, a word, Step 1's play and Step 3's run, Sing
  // it up to its Start, free play's run, and an answer in each quiz
  await page.locator('#predict [data-choice="time"]').click()
  await page.locator('.hero-plays [data-play="fast"]').click()
  await page.locator('[data-word-play="pentatonic"]').click()
  await openStep(page, '/learn/20', 1)
  await page.locator('#toyStairs [data-stairs-play="up"]').click()
  await nextStep(page, 2)
  await nextStep(page, 3)
  await page.locator('#toyRun [data-run-play="run"]').click()
  await page.locator('#sing').scrollIntoViewIfNeeded()
  await page.locator('[data-comfort="sing"]').click()
  await page.locator('[data-voice="higher"]').click()
  await expect(page.locator('[data-sing="start"]')).toBeVisible()
  await page.locator('#freeRun [data-run-play="run"]').click()
  await page.locator('#recall-qs .q .opt').first().click()
  await page.locator('#qs .q .opt').first().click()
  for (const id of ['#words', '#lesson', '#sing', '#wrap', '#explorer'])
    await page.locator(id).scrollIntoViewIfNeeded()

  // Assert
  expect(await asks()).toBe(0)
  expect(away).toEqual([])
  const keys = await page.evaluate(() => Object.keys(localStorage).sort())
  expect(
    keys.filter(
      (k) =>
        !/^fyp-l20-(seed|quiz-v1|recall-seed|recall-v1)$/.test(k) &&
        !/^fyp-(voice|done|pos|sound|motion|tour|tour-seen)$/.test(k),
    ),
  ).toEqual([])
  expect(
    await page.evaluate(async () =>
      'indexedDB' in window && 'databases' in indexedDB
        ? (await indexedDB.databases()).map((d) => d.name)
        : [],
    ),
  ).toEqual([])
})

for (const width of [390, 344]) {
  test.describe(`the page's targets at ${String(width)} px wide`, () => {
    test.use({ viewport: { width, height: 844 } })

    test("every target of the hero, the words, the four steps, Sing it and free play is at least 44 px square, none overlapping another, each step's stage fits under the masthead, and nothing scrolls sideways (WEB-SPEC, Contract)", async ({
      page,
    }) => {
      // Arrange
      test.setTimeout(90_000)
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.goto('/learn/20')
      const counts: Record<string, number> = {}
      counts.predict = await expectTargets(page, '#predict', 'The predict')
      await page.locator('#predict [data-choice="time"]').click()

      // Act, Assert
      counts.hero = await expectTargets(page, '.hero-plays', 'The hero')
      counts.words = await expectTargets(page, '#words', 'The words')
      await openStep(page, '/learn/20', 1)
      // at 344 px eight stairs share about 312 px, 39 px each, the page's one
      // target under 44 px, as on Lessons 4's and 21's staircases: there the
      // staircase's controls and its Slide are checked, each still 44 px
      const narrow = width < 390
      const stairs = async (toy: string, what: string): Promise<number> =>
        narrow
          ? (await expectTargets(page, `${toy} .stairs-controls`, what)) +
            ((await page.locator(`${toy} [data-slide-row]`).isVisible())
              ? await expectTargets(page, `${toy} [data-slide-row]`, what)
              : 0)
          : expectTargets(page, toy, what)
      for (let n = 1; n <= 4; n++) {
        if (n > 1) await nextStep(page, n)
        counts[`step ${String(n)}`] =
          n <= 2
            ? await stairs('#toyStairs', `Step ${String(n)}`)
            : await expectTargets(page, '#toyRun', `Step ${String(n)}`)
        // the masthead is 58 px: the stage fits the 786 px below it
        const stage = await page
          .locator('#stepsStage .stage-card')
          .boundingBox()
        expect(stage?.height ?? 0, `Step ${String(n)}'s stage`).toBeLessThan(
          786,
        )
      }
      await page.locator('#sing').scrollIntoViewIfNeeded()
      await page.locator('[data-comfort="sing"]').click()
      await page.locator('[data-voice="lower"]').click()
      counts.sing = await expectTargets(page, '#singCard', 'Sing it')
      // free play's staircase lays its stairs out as it first comes into view
      await page.locator('#freeStairs').scrollIntoViewIfNeeded()
      await expect(
        page.locator('#freeStairs .stair-hit').first(),
      ).toHaveAttribute('style', /left/)
      counts.free = narrow
        ? (await stairs('#freeStairs', 'Free play')) +
          (await expectTargets(page, '#freeRun', 'Free play'))
        : await expectTargets(page, '#freePlay', 'Free play')
      expect(counts).toEqual({
        // the predict's two choices, then the hero's two runs under the stage
        predict: 2,
        hero: 2,
        // three words play; Agility has no play
        words: 3,
        // the stairs, Play up, Leave out fa and ti and the Slide's three, or
        // at 344 px all but the stairs
        'step 1': narrow ? 5 : 13,
        // C's five and its play, then Major · Minor
        'step 2': narrow ? 3 : 9,
        // Tempo's five notches, the run, smudged and the staff switch: on a
        // phone the beads are no buttons, too close for 44 px each
        'step 3': 8,
        // Staccato · Legato, the run and the staff switch
        'step 4': 4,
        // the two voices, the two runs, Move do's two, Merc's run, Start and
        // the warm-up's three plays
        sing: 11,
        // both toys with every control, the stairs left out at 344 px
        free: narrow ? 17 : 25,
      })
    })
  })
}
