// ============================================================
// Lesson 16 loads at /learn/16 as its own document, and boots
// ============================================================
//
// A Season 2 voice lesson, a draft until Lessons 9 and 15 are live and the
// vocal coach has signed it off. Every build carries its document, and
// the e2e bundle shows drafts (`build:e2e` sets VITE_DRAFT_LESSONS=1); on
// mercurypitch.com the site worker answers its address with the 404 page
// until the admin console publishes it (src/lesson-gate.ts). Like every
// lesson it must load as itself, never as the 404 page or the studio's
// cached app shell, and its module must boot: at a phone's size and a
// desktop's, no AudioContext before the first tap, and nothing plays
// before a play button; and a visitor with the studio installed still gets
// the lesson, not the shell. It carries Season 2, so its masthead and its
// map are Season 2's, and it draws no staff for show (WEB-SPEC, Look).
//
// Then the page's parts in a browser (WEB-SPEC, Tests): the cold open's
// tries locked until a choice and Tavi's line drawn orange; each step's
// toy, the staircase turning into the staff; the three words; one sound at
// a time; no microphone asked before Start, nothing sent away and only the
// page's own keys kept; and every target at a phone's width at least 44 px
// square, each step's stage under the masthead. Sing it's take, sung into
// a fake microphone, is learn-lesson-16-sing.spec.ts's.

import type { Locator, Page } from '@playwright/test'
import { expect, test } from './helpers/lesson-page'
import { expectTargets, openStep } from './helpers/lesson-qa'

// 60 characters at most (src/tests/lesson-pages.test.ts)
const TITLE = 'How to sight-sing a melody from the staff | MercuryPitch'

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

    test('a hard load of /learn/16 answers 200 with the lesson @smoke', async ({
      page,
    }) => {
      // Act
      const response = await page.goto('/learn/16')

      // Assert
      expect(response?.status()).toBe(200)
      await expect(page).toHaveTitle(TITLE)
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(
        "Can you sing a tune you've never heard, just by reading it?",
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
      await page.goto('/learn/16')
      await expect(
        page.locator('.ex-seasons [data-season="2"]'),
      ).toHaveAttribute('aria-pressed', 'true')
      await expect(page.locator('#stepNow')).toHaveText('1')
      await expect(page.locator('#deckNextLabel')).toHaveText(
        'Next: Do I need perfect pitch for this?',
      )

      // Act: the whole page read, top to bottom, with no tap
      for (const id of ['#predict', '#words', '#lesson', '#sing', '#wrap'])
        await page.locator(id).scrollIntoViewIfNeeded()

      // Assert
      expect(await heard(page)).toEqual({ contexts: 0, sources: 0 })
      await expect(page.locator('.lm-btn')).toBeVisible()
      // the Wrap's card names the lesson after this one, from Season 2
      await expect(page.locator('#wrap a.next-card .eyebrow')).toContainText(
        'Next lesson 17',
      )
      expect(errors).toEqual([])
    })

    test("nothing plays but the sound switch's own chime until a play button is pressed", async ({
      page,
    }) => {
      // Arrange: sound on from the gate, which confirms it with its two soft notes
      await watchSound(page)
      await page.goto('/learn/16')
      await page.locator('#gateBtn').click()
      await expect(page.locator('#soundSwitch')).toHaveAttribute(
        'aria-pressed',
        'true',
      )
      const after = await heard(page)

      // Act: a choice, the steps and the sections, none of them a play button
      await page.locator('#predict [data-choice="tune"]').click()
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
      await page.goto('/learn/16')
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
  await page.goto('/learn/16')

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

test("the cold open: Tavi's tries locked until a choice, her line with no note drawn orange one place under the written notes, and the reveal once both are heard (WEB-SPEC, Toys 1)", async ({
  page,
}) => {
  // Arrange
  test.setTimeout(40_000)
  await page.goto('/learn/16')
  await page.locator('#gateBtn').click()
  const play = (k: string) => page.locator(`.hero-plays [data-play="${k}"]`)
  const staff = page.locator('#heroStaff')
  const reveal = page.locator('#predict .reveal')
  const locked = [
    await play('alone').isDisabled(),
    await play('note').isDisabled(),
  ]
  const atRest = await staff.locator('.st-head.is-orange').count()

  // Act: the choice, then each try heard to its end
  await page.locator('#predict [data-choice="tune"]').click()
  await hearOut(play('alone'))
  const once = await reveal.isHidden()
  const orange = await staff.locator('.st-head.is-orange').count()
  await hearOut(play('note'))

  // Assert: FACTS 33 and 35
  expect(locked).toEqual([true, true])
  expect(atRest).toBe(0)
  expect(once).toBe(true)
  expect(orange).toBe(5)
  await expect(staff.locator('.st-head:not(.is-orange)')).toHaveCount(5)
  await expect(reveal).toBeVisible({ timeout: 4000 })
})

test("each step's toy does what it says: the staircase turns into the staff with the house and the syllables, the steps' plays sound, Hear it inside takes 8 s, and Names off hides the syllables (WEB-SPEC, Toys 2 and 3)", async ({
  page,
}) => {
  // Arrange: every move lands at once, and the choice is in
  test.setTimeout(90_000)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/learn/16')
  await page.locator('#gateBtn').click()
  await page.locator('#predict [data-choice="tune"]').click()
  await openStep(page, '/learn/16', 1)

  // Step 1: a bare staff under the staircase, until it turns into it
  const stairs = page.locator('#toyStairs')
  const bare = await stairs.locator('[data-staff-viz] .st-head').count()
  await hearOut(stairs.locator('[data-stairs-play]'))
  await hearOut(stairs.locator('[data-stairs-turn]'), 10_000)
  expect(bare).toBe(0)
  await expect(stairs.locator('[data-staff-viz] .st-head')).toHaveCount(5)
  await expect(stairs.locator('[data-staff-viz] .st-home')).toHaveCount(1)
  await expect(stairs.locator('[data-staff-viz] .st-syl')).toHaveText([
    'do',
    're',
    'mi',
    'fa',
    'so',
  ])

  // Step 2: Play do
  await nextStep(page, 2)
  const toy = page.locator('#toyStaff')
  await hearOut(toy.locator('[data-staff-play="do"]'))

  // Step 3: Hear it inside, do to so each lit a second before it sounds, 8.0 s
  await nextStep(page, 3)
  const inside = toy.locator('[data-hear-inside]')
  await inside.click()
  await expect(inside).toHaveAttribute('aria-pressed', 'true')
  const run = toy.locator('[data-staff-play="do-so"]')
  const pressed = Date.now()
  await hearOut(run, 12_000)
  // 8.0 s with the beat before each note, where plain do to so takes 2.9
  expect(Date.now() - pressed).toBeGreaterThan(7000)
  await inside.click()
  await expect(inside).toHaveAttribute('aria-pressed', 'false')

  // Step 4: the triad, and do, mi then do, so
  await nextStep(page, 4)
  await hearOut(toy.locator('[data-staff-play="triad"]'))
  await hearOut(toy.locator('[data-staff-play="turn"]'))

  // Step 5: Names off keeps the house and drops the syllables
  await nextStep(page, 5)
  await expect(toy.locator('.st-syl')).toHaveCount(5)
  await toy.locator('[data-names="off"]').click()
  await expect(toy.locator('.st-syl')).toHaveCount(0)
  await expect(toy.locator('.st-home')).toHaveCount(1)
  await toy.locator('[data-names="on"]').click()
  await expect(toy.locator('.st-syl')).toHaveCount(5)
})

test('the three words each play, their figures lit as they sound and dark once they end (WEB-SPEC, Toys 4)', async ({
  page,
}) => {
  // Arrange
  test.setTimeout(40_000)
  await page.goto('/learn/16#words')
  await page.locator('#gateBtn').click()
  const fig = (w: string) => page.locator(`[data-word-fig="${w}"]`)
  const play = (w: string) => page.locator(`[data-word-play="${w}"]`)

  for (const w of ['sight', 'triad', 'audiation']) {
    // Act
    await play(w).click()

    // Assert
    await expect(fig(w).locator('.st-head.is-lit').first()).toBeVisible({
      timeout: 4000,
    })
    await expect(play(w)).not.toHaveClass(/\bis-on\b/, { timeout: 8000 })
    await expect(fig(w).locator('.st-head.is-lit')).toHaveCount(0)
  }
})

test("one sound at a time: a word's play stops a try, a try stops a step's play, and a step's play stops a word (WEB-SPEC, Tests 17)", async ({
  page,
}) => {
  // Arrange: sound on, a choice made and a voice chosen, every play drawn;
  // Sing it answered where it stands, so no section scrolls away and stops
  // a press by Lesson 3's rule for leaving (kit/leave.ts)
  await page.goto('/learn/16')
  await page.locator('#gateBtn').click()
  await page.locator('#predict [data-choice="tune"]').click()
  await page.locator('[data-comfort="listen"]').dispatchEvent('click')
  await page.locator('[data-voice="lower"]').dispatchEvent('click')

  // Act: each press 150 ms after the one before, by script, so no press
  // scrolls a play off screen (which stops it after 600 ms on its own)
  const lit = await page.evaluate(async () => {
    const TRY = '.hero-plays [data-play="alone"]'
    const WORD = '#words [data-word-play="sight"]'
    const STEP = '#toyStaff [data-staff-play="do-so"]'
    const on = (sel: string): boolean =>
      document.querySelector(sel)?.classList.contains('is-on') ?? false
    const press = async (sel: string) => {
      document.querySelector<HTMLElement>(sel)?.click()
      await new Promise((r) => window.setTimeout(r, 150))
      return [TRY, WORD, STEP].filter(on).join(' ')
    }
    return [
      await press(TRY),
      await press(WORD),
      await press(STEP),
      await press(TRY),
      await press(STEP),
      await press(WORD),
    ]
  })

  // Assert: only the newest is lit, every time
  expect(lit).toEqual([
    '.hero-plays [data-play="alone"]',
    '#words [data-word-play="sight"]',
    '#toyStaff [data-staff-play="do-so"]',
    '.hero-plays [data-play="alone"]',
    '#toyStaff [data-staff-play="do-so"]',
    '#words [data-word-play="sight"]',
  ])
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
  await page.goto('/learn/16')

  // Act: the choice and a try, a word, Step 1's play, Sing it up to its
  // Start, free play's do, and an answer in each quiz
  await page.locator('#predict [data-choice="tune"]').click()
  await page.locator('#heroPlay').click()
  await page.locator('[data-word-play="audiation"]').click()
  await openStep(page, '/learn/16', 1)
  await page.locator('#toyStairs [data-stairs-play]').click()
  await page.locator('#sing').scrollIntoViewIfNeeded()
  await page.locator('[data-comfort="sing"]').click()
  await page.locator('[data-voice="higher"]').click()
  await expect(page.locator('[data-sing="start"]')).toBeVisible()
  await page.locator('#freePlay [data-staff-play="do"]').click()
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
        !/^fyp-l16-(seed|quiz-v1|recall-seed|recall-v1)$/.test(k) &&
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

    test("every target of the hero, the words, the five steps, Sing it and free play is at least 44 px square, none overlapping another, each step's stage fits under the masthead, and nothing scrolls sideways (WEB-SPEC, Edge cases)", async ({
      page,
    }) => {
      // Arrange: the choice in, so every step shows all its controls
      test.setTimeout(90_000)
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.goto('/learn/16')
      await page.locator('#predict [data-choice="tune"]').click()
      const toys = [
        '',
        '#toyStairs',
        '#toyStaff',
        '#toyStaff',
        '#toyStaff',
        '#toyStaff',
      ]
      const counts: Record<string, number> = {}

      // Act, Assert
      counts.hero = await expectTargets(page, '.hero-plays', 'The hero')
      counts.words = await expectTargets(page, '#words', 'The words')
      await openStep(page, '/learn/16', 1)
      for (let n = 1; n <= 5; n++) {
        if (n > 1) await nextStep(page, n)
        counts[`step ${String(n)}`] = await expectTargets(
          page,
          toys[n],
          `Step ${String(n)}`,
        )
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
      await page.locator('#freePlay').scrollIntoViewIfNeeded()
      counts.free = await expectTargets(page, '#freePlay', 'Free play')
      expect(counts).toEqual({
        // the two tries
        hero: 2,
        words: 3,
        // the play, the turn, the clef, the pitch-line switch and five stairs
        'step 1': 10,
        // each step's own plays, with the clef and the pitch-line switch
        'step 2': 4,
        'step 3': 5,
        'step 4': 5,
        'step 5': 7,
        // the two voices and Start
        sing: 3,
        // four plays, Hear it inside, Names, the clef and the pitch-line switch
        free: 10,
      })
    })
  })
}
