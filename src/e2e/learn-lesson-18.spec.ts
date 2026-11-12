// ============================================================
// Lesson 18 loads at /learn/18 as its own document, and boots
// ============================================================
//
// A Season 2 voice lesson, a draft until Lessons 16 and 17 are live and the
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
// read locked until a choice and the reveal only once it is heard, holding
// Read Merc's way; each step's plays and what they write on the staff; the
// four words; one sound at a time; the lock, in the step and in the Wrap's
// free play; no microphone asked before Start, nothing sent away and only
// the page's own keys kept; and every target at a phone's width at least
// 44 px square, each step's stage under the masthead. Sing it's take, sung
// into a fake microphone, is learn-lesson-18-sing.spec.ts's, and the tour's
// hold for the predict's choice is learn-lesson-tour.spec.ts's.

import type { Locator, Page } from '@playwright/test'
import { expect, test } from './helpers/lesson-page'
import { expectTargets, openStep } from './helpers/lesson-qa'

// 60 characters at most (src/tests/lesson-pages.test.ts)
const TITLE = 'How to sight-sing a melody in time | MercuryPitch'

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

    test('a hard load of /learn/18 answers 200 with the lesson @smoke', async ({
      page,
    }) => {
      // Act
      const response = await page.goto('/learn/18')

      // Assert
      expect(response?.status()).toBe(200)
      await expect(page).toHaveTitle(TITLE)
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(
        "How do singers read a tune they've never heard without stopping on every note?",
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
      await page.goto('/learn/18')
      await expect(
        page.locator('.ex-seasons [data-season="2"]'),
      ).toHaveAttribute('aria-pressed', 'true')
      await expect(page.locator('#stepNow')).toHaveText('1')
      await expect(page.locator('#deckNextLabel')).toHaveText(
        'Next: What should my eye look for?',
      )

      // Act: the whole page read, top to bottom, with no tap
      for (const id of ['#predict', '#words', '#lesson', '#sing', '#wrap'])
        await page.locator(id).scrollIntoViewIfNeeded()

      // Assert
      expect(await heard(page)).toEqual({ contexts: 0, sources: 0 })
      await expect(page.locator('.lm-btn')).toBeVisible()
      // the Wrap's card names the lesson after this one, from Season 2
      await expect(page.locator('#wrap a.next-card .eyebrow')).toContainText(
        'Next lesson 19',
      )
      expect(errors).toEqual([])
    })

    test("nothing plays but the sound switch's own chime until a play button is pressed", async ({
      page,
    }) => {
      // Arrange: sound on from the gate, which confirms it with its two soft notes
      await watchSound(page)
      await page.goto('/learn/18')
      await page.locator('#gateBtn').click()
      await expect(page.locator('#soundSwitch')).toHaveAttribute(
        'aria-pressed',
        'true',
      )
      const after = await heard(page)

      // Act: a choice, the steps and the sections, none of them a play button
      await page.locator('#predict [data-choice="four"]').click()
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
      await page.goto('/learn/18')
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
  await page.goto('/learn/18')

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

test("the cold open: Merc's read locked until a choice, naming the first four notes as it goes, the reveal only once it is heard, and Read Merc's way in it drawing a gold bracket over each pattern (WEB-SPEC, Toys 1)", async ({
  page,
}) => {
  // Arrange
  test.setTimeout(60_000)
  await page.goto('/learn/18')
  await page.locator('#gateBtn').click()
  const read = page.locator('#heroPlay')
  const staff = page.locator('#heroStaff')
  const reveal = page.locator('#predict .reveal')
  const locked = await read.isDisabled()

  // Act: the choice, then Merc's read heard to its end, 13.4 s
  await page.locator('#predict [data-choice="four"]').click()
  const hidden = await reveal.isHidden()
  await hearOut(read, 20_000)

  // Assert: Tests 5 (FACTS 33, 35, 37)
  expect(locked).toBe(true)
  expect(hidden).toBe(true)
  await expect(reveal).toBeVisible({ timeout: 4000 })
  await expect(reveal.locator('.mono')).toHaveText('You said: only four')
  await expect(staff.locator('.rd-name')).toHaveText(['do', 're', 'mi', 're'])
  await expect(staff.locator('.rd-tag')).toHaveCount(0)

  // Act: Read Merc's way, 12.0 s
  await hearOut(reveal.locator('[data-play="way"]'), 16_000)

  // Assert: a run of steps, then do-mi-so
  await expect(staff.locator('.rd-bracket')).toHaveCount(2)
})

test("each step's plays do what they say: the read by name tags each sung note's lateness, tune A brackets its patterns, tune C counts in, the pad reads the taps' tempo, and the marks write themselves as they sound (WEB-SPEC, Toys 2)", async ({
  page,
}) => {
  // Arrange: every move lands at once, and the choice is in
  test.setTimeout(120_000)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/learn/18')
  await page.locator('#gateBtn').click()
  await page.locator('#predict [data-choice="four"]').click()
  await openStep(page, '/learn/18', 1)
  const toy = page.locator('#toyRead')
  const play = (id: string) => toy.locator(`[data-read-play="${id}"]`)
  const mark = (id: string) => toy.locator(`[data-read-mark="${id}"]`)

  // Step 1: the read by name, 12.0 s, a tag under each note it sings
  await hearOut(play('by-name'), 16_000)
  await expect(toy.locator('.rd-name')).toHaveText(['do', 're', 'mi', 're'])
  await expect(toy.locator('.rd-tag')).toHaveCount(4)

  // Step 2: tune A, 8.0 s, a bracket over each pattern
  await nextStep(page, 2)
  await hearOut(play('tune-a'), 12_000)
  await expect(toy.locator('.rd-bracket')).toHaveCount(2)

  // Step 3: tune C counted in, 12.0 s, then four taps a second apart
  await nextStep(page, 3)
  await hearOut(play('count-in'), 16_000)
  await toy.locator('[data-read-tap]').evaluate(async (pad) => {
    for (let i = 0; i < 4; i++) {
      if (i > 0) await new Promise((r) => window.setTimeout(r, 1000))
      pad.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: ' ',
          bubbles: true,
          cancelable: true,
        }),
      )
      pad.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', bubbles: true }))
    }
  })
  await expect(toy.locator('[data-tap-tempo]')).toHaveText(
    /^Your taps: (59|60|61) BPM$/,
  )

  // Step 4: p then f, 7.0 s, and the breath mark, 8.0 s, each written as it sounds
  await nextStep(page, 4)
  await hearOut(mark('dynamics'), 11_000)
  await expect(toy.locator('.rd-dyn')).toHaveText(['p', 'f'])
  await hearOut(mark('breath'), 12_000)
  await expect(toy.locator('.rd-breath')).toHaveCount(1)
})

test('the four words each play, their figures lit as they sound and dark once they end (WEB-SPEC, Toys 3)', async ({
  page,
}) => {
  // Arrange
  test.setTimeout(60_000)
  await page.goto('/learn/18#words')
  await page.locator('#gateBtn').click()
  const fig = (w: string) => page.locator(`[data-word-fig="${w}"]`)
  const play = (w: string) => page.locator(`[data-word-play="${w}"]`)
  const lit = '.is-sounding, .is-now'

  for (const w of ['countin', 'dynamics', 'staccato', 'slur']) {
    // Act
    await play(w).click()

    // Assert
    await expect(fig(w).locator(lit).first()).toBeVisible({ timeout: 4000 })
    await expect(play(w)).not.toHaveClass(/\bis-on\b/, { timeout: 10_000 })
    await expect(fig(w).locator(lit)).toHaveCount(0)
  }
})

test("one sound at a time: a word's play stops Merc's read, a step's play stops a word's, and Merc's read stops a step's (WEB-SPEC, Tests 18)", async ({
  page,
}) => {
  // Arrange: sound on, the choice made and a voice chosen, every play
  // drawn; Sing it answered where it stands, so no section scrolls away and
  // stops a press by Lesson 3's rule for leaving (kit/leave.ts)
  await page.goto('/learn/18')
  await page.locator('#gateBtn').click()
  await page.locator('#predict [data-choice="four"]').click()
  await page.locator('[data-comfort="sing"]').dispatchEvent('click')
  await page.locator('[data-voice="lower"]').dispatchEvent('click')

  // Act: each press 150 ms after the one before, by script, so no press
  // scrolls a play off screen (which stops it after 600 ms on its own)
  const lit = await page.evaluate(async () => {
    const READ = '#heroPlay'
    const WORD = '#words [data-word-play="staccato"]'
    const STEP = '#toyRead [data-read-play="by-name"]'
    const on = (sel: string): boolean =>
      document.querySelector(sel)?.classList.contains('is-on') ?? false
    const press = async (sel: string) => {
      document.querySelector<HTMLElement>(sel)?.click()
      await new Promise((r) => window.setTimeout(r, 150))
      return [READ, WORD, STEP].filter(on).join(' ')
    }
    return [
      await press(READ),
      await press(WORD),
      await press(STEP),
      await press(READ),
      await press(STEP),
      await press(WORD),
    ]
  })

  // Assert: only the newest is lit, every time
  expect(lit).toEqual([
    '#heroPlay',
    '#words [data-word-play="staccato"]',
    '#toyRead [data-read-play="by-name"]',
    '#heroPlay',
    '#toyRead [data-read-play="by-name"]',
    '#words [data-word-play="staccato"]',
  ])
})

test("the lock: Step 1's reads locked in the step and in the Wrap's free play until the predict's choice, Step 2's tunes playing before it, and open at once for a learner who has done the lesson (WEB-SPEC, Tests 20)", async ({
  page,
}) => {
  // Arrange
  test.setTimeout(40_000)
  await page.goto('/learn/18')
  await page.locator('#gateBtn').click()
  const step = (id: string) => page.locator(`#toyRead [data-read-play="${id}"]`)
  const free = (id: string) =>
    page.locator(`#freePlay [data-read-play="${id}"]`)
  for (const b of [step('by-name'), step('way'), free('by-name'), free('way')])
    await expect(b).toBeDisabled()
  await expect(page.locator('#toyRead [data-read-lock]')).toBeVisible()
  await expect(page.locator('#freePlay [data-read-lock]')).toBeVisible()

  // Act: Step 2's tune A before any choice, then the choice
  await openStep(page, '/learn/18', 2)
  await hearOut(step('tune-a'), 12_000)
  await page.locator('#predict [data-choice="seven"]').dispatchEvent('click')

  // Assert (FACTS 1a)
  for (const b of [step('by-name'), step('way'), free('by-name'), free('way')])
    await expect(b).toBeEnabled()
  await expect(page.locator('#freePlay [data-read-lock]')).toBeHidden()

  // Act: a learner who has done the lesson, on a new visit
  await page.addInitScript(() => localStorage.setItem('fyp-done', '[18]'))
  await page.reload()

  // Assert: open before any choice
  for (const b of [step('by-name'), free('by-name')])
    await expect(b).toBeEnabled()
  await expect(page.locator('#freePlay [data-read-lock]')).toBeHidden()
})

test('the page asks for no microphone before Start, sends nothing away and keeps only its own keys, through the cold open, a word, the steps and the pad, Sing it, free play and the quizzes', async ({
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
  await page.goto('/learn/18')

  // Act: the choice and Merc's read, a word, Step 1's read and Step 3's
  // pad, Sing it up to its Start, free play's tune A, and an answer in each quiz
  await page.locator('#predict [data-choice="four"]').click()
  await page.locator('#heroPlay').click()
  await page.locator('[data-word-play="countin"]').click()
  await openStep(page, '/learn/18', 1)
  await page.locator('#toyRead [data-read-play="by-name"]').click()
  await nextStep(page, 2)
  await nextStep(page, 3)
  await page.locator('#toyRead [data-read-tap]').click()
  await page.locator('#sing').scrollIntoViewIfNeeded()
  await page.locator('[data-comfort="sing"]').click()
  await page.locator('[data-voice="higher"]').click()
  await expect(page.locator('[data-sing="start"]')).toBeVisible()
  await page.locator('#freePlay [data-read-play="tune-a"]').click()
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
        !/^fyp-l18-(seed|quiz-v1|recall-seed|recall-v1)$/.test(k) &&
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

    test("every target of the hero, the words, the four steps, Sing it and free play is at least 44 px square, none overlapping another, each step's stage fits under the masthead, and nothing scrolls sideways (WEB-SPEC, Edge cases)", async ({
      page,
    }) => {
      // Arrange: the choice in, so every step shows all its controls
      test.setTimeout(90_000)
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.goto('/learn/18')
      const counts: Record<string, number> = {}
      counts.predict = await expectTargets(page, '#predict', 'The predict')
      await page.locator('#predict [data-choice="four"]').click()

      // Act, Assert
      counts.hero = await expectTargets(page, '.hero-plays', 'The hero')
      counts.words = await expectTargets(page, '#words', 'The words')
      await openStep(page, '/learn/18', 1)
      for (let n = 1; n <= 4; n++) {
        if (n > 1) await nextStep(page, n)
        counts[`step ${String(n)}`] = await expectTargets(
          page,
          '#toyRead',
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
        // the predict's two choices, then Watch Merc read under the stage
        predict: 2,
        hero: 1,
        words: 4,
        // each step's own plays, with the Clef and Names switches and the
        // pitch-line switch; on a phone the notes are not buttons, too
        // narrow for 44 px each
        'step 1': 7,
        'step 2': 7,
        // tune C's play with the count-in, Count and the tap pad
        'step 3': 8,
        // the five marks' examples
        'step 4': 10,
        // the two voices, Names and Start
        sing: 5,
        // every play from the steps, Count, the switches and no tap pad
        free: 16,
      })
    })
  })
}
