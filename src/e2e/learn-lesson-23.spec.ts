// ============================================================
// Lesson 23 loads at /learn/23 as its own document, and boots
// ============================================================
//
// A Season 2 page, a draft until Lesson 6's page is live and the vocal
// coach has looked at Sing it. Every build
// carries its document, and the e2e bundle shows drafts (`build:e2e` sets
// VITE_DRAFT_LESSONS=1); on mercurypitch.com the site worker answers its
// address with the 404 page until the admin console publishes it
// (src/lesson-gate.ts). Like every lesson it must load as itself, never as
// the 404 page or the studio's cached app shell, and its module must boot: at
// a phone's size and a desktop's, no AudioContext before the first tap, and
// nothing plays before a play button; and a visitor with the studio
// installed still gets the lesson, not the shell. It carries Season 2, so
// its masthead and its map are Season 2's, and it draws no staff for show
// (WEB-SPEC, Look). Then the page's parts in a real browser: the cold open
// and its predict, each step's controls, the four words, Sing it and its
// listening pair, one sound at a time across all of them, no microphone,
// nothing sent away and only its own keys kept, and every target 44 px or
// more at a phone's two widths (WEB-SPEC, Tests).

import type { Locator, Page } from '@playwright/test'
import { expect, test } from './helpers/lesson-page'
import { expectTargets, openStep } from './helpers/lesson-qa'

// 60 characters at most (src/tests/lesson-pages.test.ts)
const TITLE = 'Interval quality: perfect, major and minor | MercuryPitch'

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

    test('a hard load of /learn/23 answers 200 with the lesson @smoke', async ({
      page,
    }) => {
      // Act
      const response = await page.goto('/learn/23')

      // Assert
      expect(response?.status()).toBe(200)
      await expect(page).toHaveTitle(TITLE)
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(
        'Which interval splits the octave exactly in half, and why does it want to move?',
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
      await page.goto('/learn/23')
      await expect(
        page.locator('.ex-seasons [data-season="2"]'),
      ).toHaveAttribute('aria-pressed', 'true')
      await expect(page.locator('#stepNow')).toHaveText('1')
      await expect(page.locator('#deckNextLabel')).toHaveText(
        'Next: Is every interval major or minor?',
      )

      // Act: the whole page read, top to bottom, with no tap
      for (const id of ['#predict', '#words', '#lesson', '#sing', '#wrap'])
        await page.locator(id).scrollIntoViewIfNeeded()

      // Assert
      expect(await heard(page)).toEqual({ contexts: 0, sources: 0 })
      await expect(page.locator('.lm-btn')).toBeVisible()
      // the Wrap's card names the lesson after this one, from Season 2
      await expect(page.locator('#wrap a.next-card .eyebrow')).toContainText(
        'Next lesson 24',
      )
      expect(errors).toEqual([])
    })

    test("nothing plays but the sound switch's own chime until a play button is pressed", async ({
      page,
    }) => {
      // Arrange: sound on from the gate, which confirms it with its two soft notes
      await watchSound(page)
      await page.goto('/learn/23')
      await page.locator('#gateBtn').click()
      await expect(page.locator('#soundSwitch')).toHaveAttribute(
        'aria-pressed',
        'true',
      )
      const after = await heard(page)

      // Act: a choice, the steps and the sections, none of them a play button
      await page.locator('#predict [data-choice="g"]').click()
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
      await page.goto('/learn/23')
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
  await page.goto('/learn/23')

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

/** The stage toy's control `selector` finds in the row its step shows. */
const showing = (page: Page, selector: string): Locator =>
  page.locator(`#toyStaff ${selector}`).filter({ visible: true })

/** Moves the deck on by its Next step button, to step `n`. */
async function nextStep(page: Page, n: number): Promise<void> {
  await page.getByRole('button', { name: 'Next step', exact: true }).click()
  await expect(page.locator('#stepNow')).toHaveText(String(n))
}

test('the cold open: only the two Cs and the octave before a choice, the splits locked until one, each split counted as it sounds, and the reveal once both are heard (WEB-SPEC, Toys 2 and 3)', async ({
  page,
}) => {
  // Arrange
  test.setTimeout(40_000)
  await page.goto('/learn/23')
  await page.locator('#gateBtn').click()
  const line = page.locator('#heroLine')
  const counts = line.locator('.hl-count')
  const reveal = page.locator('#predict .reveal')
  const split = (k: 'g' | 'fs') =>
    page.locator(`.hero-plays [data-play="${k}"]`)
  const locked = [await split('g').isDisabled(), await split('fs').isDisabled()]

  // Act: the octave heard, a choice, then each split heard to its end
  await page.locator('#heroPlay').click()
  await expect(page.locator('#heroPlay')).not.toHaveClass(/\bis-on\b/, {
    timeout: 6000,
  })
  const octave = [await line.locator('.hl-lane').count(), await counts.count()]
  await page.locator('#predict [data-choice="g"]').click()
  await split('g').click()
  await expect(counts).toHaveText(['7', '5'], { timeout: 3000 })
  const once = await reveal.isHidden()
  await expect(split('g')).not.toHaveClass(/\bis-on\b/, { timeout: 6000 })
  await split('fs').click()
  await expect(counts).toHaveText(['6', '6'], { timeout: 3000 })

  // Assert: the octave lights only its two ends, and a split draws all
  // thirteen lanes and counts its two leaps
  expect(locked).toEqual([true, true])
  expect(octave).toEqual([2, 0])
  expect(once).toBe(true)
  await expect(line.locator('.hl-lane')).toHaveCount(13)
  await expect(reveal).toBeVisible({ timeout: 8000 })
})

test("each step's controls do what they say: the readout names each interval, Fold sums the octave, B and F close into C and E, and the line curls into a ring (WEB-SPEC, Toys 1)", async ({
  page,
}) => {
  // Arrange: every move lands at once, and the choice is in
  test.setTimeout(60_000)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/learn/23')
  await page.locator('#gateBtn').click()
  await page.locator('#predict [data-choice="fs"]').click()
  await openStep(page, '/learn/23', 1)
  const readout = page.locator('#toyStaff [data-iv-readout]')

  // Act, Assert: Step 1, C up to E and then E flat, then a step up
  await showing(page, '[data-iv-play="c-e"]').click()
  await expect(readout).toHaveText(
    'C up to E: 3 letters · 4 semitones · a major third',
    { timeout: 4000 },
  )
  await showing(page, '[data-iv-play="c-eb"]').click()
  // the sign spoken too, its word in a visually hidden span
  await expect(readout).toHaveText(
    'C up to E♭ flat: 3 letters · 3 semitones · a minor third',
    { timeout: 4000 },
  )
  await showing(page, '[data-staff-step="1"]').click()
  await expect(readout).toHaveText(
    'C up to F: 4 letters · 5 semitones · a perfect fourth',
    { timeout: 4000 },
  )

  // Step 2: the fourth, then the tritone a sharp makes of it
  await nextStep(page, 2)
  await showing(page, '[data-iv-play="c-f-fs"]').click()
  await expect(readout).toContainText('a tritone', { timeout: 6000 })

  // Step 3: the fifth folded, its two spans summed against the octave
  await nextStep(page, 3)
  await showing(page, '[data-iv-play="fold-g"]').click()
  await expect(readout).toContainText('5 + 4 = 9 · 7 + 5 = 12', {
    timeout: 6000,
  })

  // Step 4: B and F, then C and E, and the line curled into a ring
  await nextStep(page, 4)
  await showing(page, '[data-iv-play="b-f"]').click()
  await expect(readout).toHaveText(
    'C up to E: 3 letters · 4 semitones · a major third',
    { timeout: 6000 },
  )
  await showing(page, '[data-iv-curl]').click()
  await expect(showing(page, '[data-iv-curl]')).toHaveText(
    'Straighten the line',
  )
})

test('the four words each play and stay written, the line under Number and Quality, no pitch line in any figure (WEB-SPEC, Toys 4)', async ({
  page,
}) => {
  // Arrange
  test.setTimeout(40_000)
  await page.goto('/learn/23#words')
  await page.locator('#gateBtn').click()
  const fig = (w: string) => page.locator(`[data-word-fig="${w}"]`)
  const play = (w: string) => page.locator(`[data-word-play="${w}"]`)

  // Act, Assert: each heard to its end, its last pair kept
  for (const [w, line] of [
    ['number', '3 letters'],
    ['quality', 'minor'],
    ['perfect', null],
    ['inversion', null],
  ] as const) {
    await play(w).click()
    await expect(play(w)).not.toHaveClass(/\bis-on\b/, { timeout: 6000 })
    await expect(fig(w).locator('.st-head')).toHaveCount(2)
    if (line === null)
      await expect(fig(w).locator('.wf-caption')).toHaveCount(0)
    else await expect(fig(w).locator('.wf-caption')).toHaveText(line)
  }
  await expect(page.locator('#words .st-lane, #words .iv-lane')).toHaveCount(0)
})

test("Sing it: the voice before anything plays, the guide once Merc's notes are heard, How did that feel? after its sweep, this page's line after Easy, and ti and fa written on their own staff, with no microphone asked (WEB-SPEC, Toys 5)", async ({
  page,
}) => {
  // Arrange
  test.setTimeout(60_000)
  const asks = await spyOnMicrophone(page)
  await page.goto('/learn/23')
  await page.locator('#gateBtn').click()
  await page.locator('#sing').scrollIntoViewIfNeeded()
  const notes = page.locator('[data-notes-play]')
  const start = page.locator('[data-guide-start]')

  // Act, Assert: the comfort check, then the voice, before any play shows
  await page.locator('[data-comfort="sing"]').click()
  await expect(notes).toBeHidden()
  await expect(page.locator('[data-listen-pair]')).toBeHidden()
  await page.locator('[data-voice="lower"]').click()
  await expect(page.locator('#singStaff .st-head')).toHaveCount(4)
  await expect(page.locator('#singStaff .st-home')).toHaveCount(2)
  await expect(start).toHaveAttribute('aria-disabled', 'true')

  // Merc's notes heard to their end, 7.0 s, open the guide
  await notes.click()
  await expect(page.locator('#singStaff .st-head.is-amber')).toHaveCount(1)
  await expect(start).toHaveAttribute('aria-disabled', 'false', {
    timeout: 10_000,
  })

  // the guide: a count-in, a 7.0 s sweep, then the question
  await start.click()
  await expect(page.locator('#singStaff .st-sweep')).toHaveCount(1, {
    timeout: 3000,
  })
  await expect(page.locator('[data-panel="feel"]')).toBeVisible({
    timeout: 12_000,
  })
  await page.locator('[data-feel="easy"]').click()
  await expect(page.locator('#singStatus')).toHaveText(
    'A fifth, then a fourth: one interval and its upside down.',
  )

  // then just listen: two pairs, each written as it sounds
  await page.locator('[data-pair-play]').click()
  await expect(page.locator('#pairStaff .st-head')).toHaveCount(4, {
    timeout: 4000,
  })
  await expect(page.locator('#pairStaff .st-sign')).toHaveCount(2)
  await expect(page.locator('[data-pair-play]')).not.toHaveClass(/\bis-on\b/, {
    timeout: 4000,
  })
  expect(await asks()).toBe(0)
})

test("one sound at a time: the recall's pair stops a split, a split stops the pair, and a word, a toy move and Play ti and fa stop any of them (WEB-SPEC, Tests 15)", async ({
  page,
}) => {
  // Arrange: sound on, a choice made and a voice chosen, every play drawn;
  // Sing it answered where it stands, so no section scrolls away and stops
  // a press by Lesson 3's rule for leaving (kit/leave.ts)
  await page.goto('/learn/23')
  await page.locator('#gateBtn').click()
  await page.locator('#predict [data-choice="g"]').click()
  await page.locator('[data-comfort="listen"]').dispatchEvent('click')
  await page.locator('[data-voice="lower"]').dispatchEvent('click')
  await expect(
    page.locator('#recall-qs [data-quiz-play="fourth"]'),
  ).toBeAttached()

  // Act: each press 150 ms after the one before, by script, so no press
  // scrolls a play off screen (which stops it after 600 ms on its own)
  const lit = await page.evaluate(async () => {
    const SPLIT = '.hero-plays [data-play="g"]'
    const PAIR = '#recall-qs [data-quiz-play="fourth"]'
    const WORD = '#words [data-word-play="number"]'
    const TIFA = '[data-pair-play]'
    const MOVE = '#toyStaff [data-staff-step="1"]'
    const on = (sel: string): boolean =>
      document.querySelector(sel)?.classList.contains('is-on') ?? false
    const press = async (sel: string) => {
      document.querySelector<HTMLElement>(sel)?.click()
      await new Promise((r) => window.setTimeout(r, 150))
      return [SPLIT, PAIR, WORD, TIFA].filter(on).join(' ')
    }
    return [
      await press(SPLIT),
      await press(PAIR),
      await press(SPLIT),
      await press(WORD),
      await press(TIFA),
      await press(MOVE),
      await press(PAIR),
      await press(TIFA),
    ]
  })

  // Assert: only the newest is lit, every time, and a move lights nothing
  expect(lit).toEqual([
    '.hero-plays [data-play="g"]',
    '#recall-qs [data-quiz-play="fourth"]',
    '.hero-plays [data-play="g"]',
    '#words [data-word-play="number"]',
    '[data-pair-play]',
    '',
    '#recall-qs [data-quiz-play="fourth"]',
    '[data-pair-play]',
  ])
})

test('the page asks for no microphone, sends nothing away and keeps only its own keys, through the cold open, a word, the steps, Sing it and the quizzes', async ({
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
  await page.goto('/learn/23')

  // Act: the hero's play and a choice, a word, Step 1's play, Merc's notes,
  // ti and fa, a free-play move, and an answer in each quiz
  await page.locator('#heroPlay').click()
  await page.locator('#predict [data-choice="g"]').click()
  await page.locator('[data-word-play="perfect"]').click()
  await openStep(page, '/learn/23', 1)
  await showing(page, '[data-iv-play="c-e"]').click()
  await page.locator('#sing').scrollIntoViewIfNeeded()
  await page.locator('[data-comfort="sing"]').click()
  await page.locator('[data-voice="higher"]').click()
  await page.locator('[data-notes-play]').click()
  await page.locator('[data-pair-play]').click()
  await page.locator('#freePlay [data-staff-step="1"]').click()
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
        !/^fyp-l23-(seed|quiz-v1|recall-seed|recall-v1)$/.test(k) &&
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

    test('every target of the hero, Steps 1 to 4, Sing it and free play is at least 44 px square, none overlapping another, and nothing scrolls sideways (WEB-SPEC, Edge cases)', async ({
      page,
    }) => {
      // Arrange: the choice in, so every step shows all its controls
      test.setTimeout(90_000)
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.goto('/learn/23')
      await page.locator('#predict [data-choice="fs"]').click()
      const counts: Record<string, number> = {}

      // Act, Assert
      counts.hero = await expectTargets(page, '.hero-plays', 'The hero')
      await openStep(page, '/learn/23', 1)
      for (let n = 1; n <= 4; n++) {
        if (n > 1) await nextStep(page, n)
        counts[`step ${String(n)}`] = await expectTargets(
          page,
          '#toyStaff',
          `Step ${String(n)}`,
        )
      }
      await page.locator('#sing').scrollIntoViewIfNeeded()
      await page.locator('[data-comfort="sing"]').click()
      await page.locator('[data-voice="lower"]').click()
      counts.sing = await expectTargets(page, '#singCard', 'Sing it')
      counts.free = await expectTargets(page, '#freePlay', 'Free play')
      expect(counts).toEqual({
        hero: 3,
        'step 1': 9,
        'step 2': 9,
        'step 3': 10,
        'step 4': 9,
        sing: 6,
        free: 9,
      })
    })
  })
}
