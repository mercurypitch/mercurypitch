// ============================================================
// Lesson 28 loads at /learn/28 as its own document, and boots
// ============================================================
//
// Season 2's last lesson, a draft until Lessons 18 and 26 are live, its lab
// test has passed and the vocal coach has signed off its breath marks, its
// voice lines and its checkpoint.
// Every build carries its document, and the e2e bundle shows drafts
// (`build:e2e` sets VITE_DRAFT_LESSONS=1); on mercurypitch.com the site
// worker answers its address with the 404 page until the admin console
// publishes it (src/lesson-gate.ts). Like every lesson it must load as
// itself, never as the 404 page or the studio's cached app shell, and its
// module must boot: at a phone's size and a desktop's, no AudioContext
// before the first tap, and nothing plays before a play button; and a
// visitor with the studio installed still gets the lesson, not the shell.
// It carries Season 2, so its masthead and its map are Season 2's, and it
// draws no staff for show (WEB-SPEC, Look).
//
// Then the page's own (WEB-SPEC, Tests): the cold open's predict, Play the
// song free and never revealing, the two ways held until a choice and the
// reveal once both are heard to their end; nothing answering the predict
// before its choice; Sing it's listening path, and its sing-along when the
// microphone is refused; one sound at a time; nothing asked for short of
// Start, nothing sent away and only its own keys kept; and every target 44
// px or more at a phone's two widths. Sing it's runs with a microphone are
// learn-lesson-28-sing.spec.ts's, on a fake one, and the units'.

import type { Page } from '@playwright/test'
import { expect, test } from './helpers/lesson-page'
import { expectTargets, openStep } from './helpers/lesson-qa'

// 60 characters at most (src/tests/lesson-pages.test.ts)
const TITLE = 'Types of cadence and song form | MercuryPitch'

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

    test('a hard load of /learn/28 answers 200 with the lesson @smoke', async ({
      page,
    }) => {
      // Act
      const response = await page.goto('/learn/28')

      // Assert
      expect(response?.status()).toBe(200)
      await expect(page).toHaveTitle(TITLE)
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(
        "How can a song sound as if it's ending, then keep going?",
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
      await page.goto('/learn/28')
      await expect(
        page.locator('.ex-seasons [data-season="2"]'),
      ).toHaveAttribute('aria-pressed', 'true')
      await expect(page.locator('#stepNow')).toHaveText('1')
      await expect(page.locator('#deckNextLabel')).toHaveText(
        'Next: How can a song fake its ending?',
      )

      // Act: the whole page read, top to bottom, with no tap
      for (const id of ['#predict', '#words', '#lesson', '#sing', '#wrap'])
        await page.locator(id).scrollIntoViewIfNeeded()

      // Assert
      expect(await heard(page)).toEqual({ contexts: 0, sources: 0 })
      await expect(page.locator('.lm-btn')).toBeVisible()
      // the Wrap's card closes Season 2: the season's last lesson names no next
      await expect(
        page.locator('#wrap [data-next-card="end"] .eyebrow'),
      ).toHaveText('End of Season 2')
      expect(errors).toEqual([])
    })

    test("nothing plays but the sound switch's own chime until a play button is pressed", async ({
      page,
    }) => {
      // Arrange: sound on from the gate, which confirms it with its two soft notes
      await watchSound(page)
      await page.goto('/learn/28')
      await page.locator('#gateBtn').click()
      await expect(page.locator('#soundSwitch')).toHaveAttribute(
        'aria-pressed',
        'true',
      )
      const after = await heard(page)

      // Act: a choice, the steps and the sections, none of them a play button
      await page.locator('#predict [data-choice="tavi"]').click()
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
      await page.goto('/learn/28')
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
  await page.goto('/learn/28')

  // Assert
  await expect(page).toHaveTitle(TITLE)
  await expect(page.locator('#root')).toHaveCount(0)
})

/** Counts every ask for the microphone, from before the page's first script; `refuse` answers each with a refusal. */
async function spyOnMicrophone(
  page: Page,
  refuse = false,
): Promise<() => Promise<number>> {
  await page.addInitScript((no) => {
    const w = window as unknown as { micAsks: number }
    w.micAsks = 0
    const media = navigator.mediaDevices as MediaDevices | undefined
    if (media === undefined) return
    const ask = media.getUserMedia.bind(media)
    media.getUserMedia = (constraints) => {
      w.micAsks += 1
      return no
        ? Promise.reject(new DOMException('Refused', 'NotAllowedError'))
        : ask(constraints)
    }
  }, refuse)
  return () =>
    page.evaluate(() => (window as unknown as { micAsks: number }).micAsks)
}

/** Moves the deck on by its Next step button, to step `n`. */
async function nextStep(page: Page, n: number): Promise<void> {
  await page.getByRole('button', { name: 'Next step', exact: true }).click()
  await expect(page.locator('#stepNow')).toHaveText(String(n))
}

/** The page's sections, and Sing it's panels, that show now. */
const panelsShown = (page: Page): Promise<(string | undefined)[]> =>
  page
    .locator('#singCard .sing-panel')
    .evaluateAll((ps) =>
      ps
        .filter((p) => !(p as HTMLElement).hidden)
        .map((p) => (p as HTMLElement).dataset.panel),
    )

test("the cold open: Play the song free and never revealing, the two ways held until a choice and played one at a time, and the reveal once both are heard to their end, Step 2's words with it (WEB-SPEC, Tests 4)", async ({
  page,
}) => {
  // Arrange: sound on from the gate
  test.setTimeout(60_000)
  await watchSound(page)
  await page.goto('/learn/28')
  await page.locator('#gateBtn').click()
  const song = page.locator('#heroPlay')
  const ending = page.locator('.hero-plays [data-play="ending"]')
  const going = page.locator('.hero-plays [data-play="going"]')
  const reveal = page.locator('#predict .reveal')
  const heldLine = page.locator('[data-held-line="2"]')
  const heldWords = page.locator('[data-held="2"]')
  const before = {
    ending: await ending.isDisabled(),
    going: await going.isDisabled(),
    line: await heldLine.isVisible(),
    words: await heldWords.isHidden(),
  }

  // Act: the song, then a choice; the ending heard to its end, the other
  // way pressed while it sounds and waiting its turn (kit/predict.ts); then
  // the other way heard to its end
  const quiet = await heard(page)
  await song.click()
  await expect
    .poll(async () => (await heard(page)).sources)
    .toBeGreaterThan(quiet.sources)
  const duringSong = await reveal.isHidden()
  await page.locator('#predict [data-choice="merc"]').click()
  await ending.click()
  await expect(ending).toHaveClass(/\bis-on\b/)
  await going.click()
  const goingLit = await going.evaluate((b) => b.classList.contains('is-on'))
  await expect(ending).not.toHaveClass(/\bis-on\b/, { timeout: 10_000 })
  const afterOne = await reveal.isHidden()
  await going.click()

  // Assert
  expect(before).toEqual({
    ending: true,
    going: true,
    line: true,
    words: true,
  })
  expect([duringSong, goingLit, afterOne]).toEqual([true, false, true])
  await expect(reveal).toBeVisible({ timeout: 10_000 })
  await expect(heldLine).toBeHidden()
  await expect(heldWords).toBeVisible()
})

/** Whether each play the choice opens is disabled, each lock line shows, and each figure draws the hero's empty bars. */
const holds = (page: Page) =>
  page.evaluate(() => {
    const off = (sel: string): boolean =>
      document.querySelector<HTMLButtonElement>(sel)?.disabled ?? false
    const shows = (sel: string): boolean => {
      const e = document.querySelector<HTMLElement>(sel)
      return e !== null && e.offsetParent !== null
    }
    return {
      figure: off('#stepsStage [data-pitch-line]'),
      step: off('[data-step-play="phrase1"]'),
      free: off('#freePlay [data-state="1"]'),
      freePlay: off('#freePlay [data-toy-play="phrase1"]'),
      listen: off('#singCard [data-listen-play]'),
      start: off('#singCard [data-panel="start"] [data-sing="start"]'),
      q4: off('#qs [data-quiz-play="phrase"]'),
      word: off('#words [data-word-play="cadence"]'),
      locks: [
        shows('#toyScore [data-lock-line]'),
        shows('#freePlay [data-lock-line]'),
        shows('#singCard [data-sing-lock]'),
        shows('#qs [data-quiz-held]'),
      ],
      emptyBars: [
        shows('#toyScore .score-locked'),
        shows('#singCard .score-locked'),
      ],
    }
  })

test("nothing answers the predict before its choice: the steps' figure and plays, free play, Sing it and quick check 4 wait under their lock lines over the hero's empty bars, the word plays free, and the choice opens them all (WEB-SPEC, Tests 5 and 6)", async ({
  page,
}) => {
  // Arrange: sound on from the gate, on Step 1
  await page.goto('/learn/28')
  await page.locator('#gateBtn').click()
  await expect(page.locator('#qs [data-quiz-play="phrase"]')).toBeAttached()
  const first = await holds(page)
  const q4Held = await page.locator('#qs [data-quiz-held]').textContent()

  // Act: the cold open's choice
  await page.locator('#predict [data-choice="merc"]').click()

  // Assert: held until it, open from it
  expect(first).toEqual({
    figure: true,
    step: true,
    free: true,
    freePlay: true,
    listen: true,
    start: true,
    q4: true,
    word: false,
    locks: [true, true, true, true],
    emptyBars: [true, true],
  })
  expect(q4Held?.trim()).toBe('Choose an answer at the top to try this.')
  await expect
    .poll(() => holds(page))
    .toEqual({
      figure: false,
      step: false,
      free: false,
      freePlay: false,
      listen: false,
      start: false,
      q4: false,
      word: false,
      locks: [false, false, false, false],
      emptyBars: [false, false],
    })
})

test("Sing it's listening path: Just listen today opens Play the song, with no voice question, no headphones check, no Start, no sing-along and no count-in's dots, and plays both parts, with no microphone asked (WEB-SPEC, Tests 12)", async ({
  page,
}) => {
  // Arrange: sound on from the gate, the choice made
  const asks = await spyOnMicrophone(page)
  await watchSound(page)
  await page.goto('/learn/28')
  await page.locator('#gateBtn').click()
  await page.locator('#predict [data-choice="merc"]').click()
  await page.locator('#sing').scrollIntoViewIfNeeded()
  const play = page.locator('[data-listen-play]')

  // Act
  await page.locator('[data-comfort="listen"]').click()

  // Assert: the listening panel, and nothing that sings
  await expect(page.locator('[data-panel="listen"]')).toBeVisible()
  expect(await panelsShown(page)).toEqual(['listen'])
  for (const sel of [
    '[data-voice="lower"]',
    '[data-phones="on"]',
    '[data-sing="start"]',
    '[data-sing="along"]',
  ])
    await expect(
      page.locator(`#singCard ${sel}`).filter({ visible: true }),
    ).toHaveCount(0)
  await expect(page.locator('[data-sing-count]')).toBeHidden()

  // Act: the play
  const before = await heard(page)
  await play.click()

  // Assert
  await expect(play).toHaveClass(/\bis-on\b/)
  await expect
    .poll(async () => (await heard(page)).sources)
    .toBeGreaterThan(before.sources)
  expect(await asks()).toBe(0)
})

test("Sing it with the microphone refused: the voice, the headphones question naming the other part, the briefing, then Start opens the sing-along, which has Tavi sing do for the higher voice, counts in and plays Merc's part under the cursor, then asks how it felt (WEB-SPEC, Tests 12)", async ({
  page,
}) => {
  // Arrange: sound on from the gate, the choice made, every ask refused
  test.setTimeout(75_000)
  const asks = await spyOnMicrophone(page, true)
  await page.goto('/learn/28')
  await page.locator('#gateBtn').click()
  await page.locator('#predict [data-choice="merc"]').click()
  await page.locator('#sing').scrollIntoViewIfNeeded()
  const status = page.locator('#singStatus')

  // Act: Sing, the higher voice, headphones on, then Start
  await page.locator('[data-comfort="sing"]').click()
  await page.locator('[data-voice="higher"]').click()
  await expect(page.locator('[data-panel="phones"]')).toContainText(
    "Merc's part",
  )
  await page.locator('[data-phones="on"]').click()
  await page.locator('[data-panel="start"] [data-sing="start"]').click()

  // Assert: the sing-along, asked for once and refused
  await expect(status).toHaveText(
    'No microphone? Sing along anyway: nothing listens.',
  )
  expect(await panelsShown(page)).toEqual(['along'])

  // Act: the sing-along, to its end
  await page.locator('[data-sing="along"]').click()

  // Assert: do, the count-in, the part, then the question
  await expect(status).toHaveText('Tavi sings do.')
  await expect(status).toHaveText('Counting in: one bar.', { timeout: 5000 })
  await expect(status).toHaveText('Your turn: sing in time with the cursor.', {
    timeout: 8000,
  })
  await expect(page.locator('[data-panel="feel"]')).toBeVisible({
    timeout: 40_000,
  })
  await page.locator('[data-feel="easy"]').click()
  await expect(status).toHaveText('You sang your part with the other one.')
  await expect(
    page
      .locator('[data-panel="after"] .sing-btns button')
      .filter({ visible: true }),
  ).toHaveText(['Sing along again', 'Done for today'])
  expect(await asks()).toBe(1)
})

test("one sound at a time: the hero's song, the word, a step's play, quick check 4, free play and Just listen today's play each stop the one before (WEB-SPEC, Tests)", async ({
  page,
}) => {
  // Arrange: sound on, the choice made, Sing it on its listening path, then
  // the deck on Step 1, every press made where it stands, so no section
  // scrolls away and stops a play by Lesson 3's rule for leaving
  // (kit/leave.ts). The hero's play brings its drawing back into view, at
  // once under reduced motion.
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/learn/28')
  await page.locator('#gateBtn').click()
  await page.locator('#predict [data-choice="merc"]').click()
  await page.locator('[data-comfort="listen"]').dispatchEvent('click')
  await expect(page.locator('[data-listen-play]')).toBeVisible()
  await openStep(page, '/learn/28', 1)
  await expect(page.locator('#qs [data-quiz-play="phrase"]')).toBeEnabled()

  // Act: each press 150 ms after the one before, by script, so no press
  // scrolls a play off screen (which stops it after 600 ms on its own)
  const lit = await page.evaluate(async () => {
    const PLAYS = [
      '#heroPlay',
      '#words [data-word-play="cadence"]',
      '[data-step-play="phrase1"]',
      '#qs [data-quiz-play="phrase"]',
      '#freePlay [data-toy-play="phrase1"]',
      '[data-listen-play]',
    ]
    const on = (sel: string): boolean =>
      document.querySelector(sel)?.classList.contains('is-on') ?? false
    const press = async (sel: string): Promise<string> => {
      document.querySelector<HTMLElement>(sel)?.click()
      await new Promise((r) => window.setTimeout(r, 150))
      return PLAYS.filter(on).join(' ')
    }
    const out: string[] = []
    for (const sel of [...PLAYS, PLAYS[0]]) out.push(await press(sel))
    return out
  })

  // Assert: only the newest is lit, every time
  expect(lit).toEqual([
    '#heroPlay',
    '#words [data-word-play="cadence"]',
    '[data-step-play="phrase1"]',
    '#qs [data-quiz-play="phrase"]',
    '#freePlay [data-toy-play="phrase1"]',
    '[data-listen-play]',
    '#heroPlay',
  ])
})

test("the page asks for no microphone short of Start, sends nothing away and keeps only its own keys, through the cold open, the word, the steps, Sing it's listening path, free play and the quizzes", async ({
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
  await page.goto('/learn/28')

  // Act: the song and a choice, the word, Step 2's play, Sing it's
  // listening path and its play, a free-play state, and an answer in each quiz
  await page.locator('#heroPlay').click()
  await page.locator('#predict [data-choice="merc"]').click()
  await page.locator('[data-word-play="cadence"]').click()
  await openStep(page, '/learn/28', 2)
  await page.locator('[data-step-play="phrase1"]').dispatchEvent('click')
  await page.locator('#sing').scrollIntoViewIfNeeded()
  await page.locator('[data-comfort="listen"]').click()
  await page.locator('[data-listen-play]').click()
  await page.locator('#freePlay [data-state="2"]').click()
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
        !/^fyp-l28-(seed|quiz-v1|recall-seed|recall-v1)$/.test(k) &&
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

    test('every target of the hero, its reveal, Steps 1 to 4, Sing it and free play is at least 44 px square, none overlapping another, and nothing scrolls sideways (WEB-SPEC, Edge cases)', async ({
      page,
    }) => {
      // Arrange: sound on and the predict revealed, both ways heard to
      // their end, so every step shows all its controls
      test.setTimeout(120_000)
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.goto('/learn/28')
      await page.locator('#gateBtn').click()
      await page.locator('#predict [data-choice="merc"]').click()
      const ending = page.locator('.hero-plays [data-play="ending"]')
      const going = page.locator('.hero-plays [data-play="going"]')
      await ending.click()
      await expect(ending).not.toHaveClass(/\bis-on\b/, { timeout: 10_000 })
      await going.click()
      await expect(page.locator('#predict .reveal')).toBeVisible({
        timeout: 12_000,
      })
      const counts: Record<string, number> = {}

      // Act, Assert
      counts.hero = await expectTargets(page, '.hero-plays', 'The hero')
      counts.predict = await expectTargets(page, '#predict', 'The predict')
      await openStep(page, '/learn/28', 1)
      for (let n = 1; n <= 4; n++) {
        if (n > 1) await nextStep(page, n)
        // the step's figure, then its own text, whose plays sit there
        counts[`step ${String(n)}`] =
          (await expectTargets(page, '#stepsStage', `Step ${String(n)}`)) +
          (await expectTargets(
            page,
            `#step-${String(n)}`,
            `Step ${String(n)}'s text`,
          ))
      }
      await page.locator('#sing').scrollIntoViewIfNeeded()
      await page.locator('[data-comfort="sing"]').click()
      await page.locator('[data-voice="lower"]').click()
      counts.sing = await expectTargets(page, '#singCard', 'Sing it')
      counts.free = await expectTargets(page, '#freePlay', 'Free play')
      expect(counts).toEqual({
        hero: 3,
        predict: 2,
        'step 1': 5,
        'step 2': 7,
        'step 3': 7,
        'step 4': 6,
        sing: 4,
        free: 7,
      })
    })
  })
}
