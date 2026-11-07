// ============================================================
// Lesson 24 loads at /learn/24 as its own document, and boots
// ============================================================
//
// A Season 2 voice lesson, a draft until the lab's two tests and the vocal
// coach's sign-off. Every build carries its document, and the e2e bundle
// shows drafts (`build:e2e` sets VITE_DRAFT_LESSONS=1); on mercurypitch.com
// the site worker answers its address with the 404 page until the admin
// console publishes it (src/lesson-gate.ts). Like every lesson it must load
// as itself, never as the 404 page or the studio's cached app shell, and its
// module must boot: at a phone's size and a desktop's, no AudioContext
// before the first tap, nothing plays before a play button, and nothing
// scrolls sideways; and a visitor with the studio installed still gets the
// lesson, not the shell. It carries Season 2, so its masthead and its map
// are Season 2's, and it draws no staff for show (WEB-SPEC, Look).
//
// Then the page's own (WEB-SPEC, Tests): the cold open's predict, the slide
// held until a choice and the reveal once it is heard; nothing answering
// either predict before its choice; Sing it's listening path and its
// sing-along, with no microphone asked; one sound at a time; nothing sent
// away and only its own keys kept; and every target 44 px or more at a
// phone's two widths. Sing it's sets, with a microphone, are the units'
// (sing.test.ts): a browser's fake microphone cannot keep quiet for the
// quiet check and then sing do, so and mi in time.

import type { Page } from '@playwright/test'
import { expect, test } from './helpers/lesson-page'
import { expectTargets, openStep } from './helpers/lesson-qa'

// 60 characters at most (src/tests/lesson-pages.test.ts)
const TITLE = 'How to sing in tune with a drone | MercuryPitch'

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

    test('a hard load of /learn/24 answers 200 with the lesson @smoke', async ({
      page,
    }) => {
      // Act
      const response = await page.goto('/learn/24')

      // Assert
      expect(response?.status()).toBe(200)
      await expect(page).toHaveTitle(TITLE)
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(
        'Hold a note against a drone: how can you hear when the two are in tune?',
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
      await page.goto('/learn/24')
      await expect(
        page.locator('.ex-seasons [data-season="2"]'),
      ).toHaveAttribute('aria-pressed', 'true')
      await expect(page.locator('#stepNow')).toHaveText('1')
      await expect(page.locator('#deckNextLabel')).toHaveText(
        'Next: Do two different notes throb too?',
      )

      // Act: the whole page read, top to bottom, with no tap
      for (const id of ['#predict', '#words', '#lesson', '#sing', '#wrap'])
        await page.locator(id).scrollIntoViewIfNeeded()

      // Assert
      expect(await heard(page)).toEqual({ contexts: 0, sources: 0 })
      await expect(page.locator('.lm-btn')).toBeVisible()
      // the Wrap's card names the lesson after this one, from Season 2
      await expect(page.locator('#wrap a.next-card .eyebrow')).toContainText(
        'Next lesson 25',
      )
      expect(errors).toEqual([])
    })

    test("nothing plays but the sound switch's own chime until a play button is pressed", async ({
      page,
    }) => {
      // Arrange: sound on from the gate, which confirms it with its two soft notes
      await watchSound(page)
      await page.goto('/learn/24')
      await page.locator('#gateBtn').click()
      await expect(page.locator('#soundSwitch')).toHaveAttribute(
        'aria-pressed',
        'true',
      )
      const after = await heard(page)

      // Act: a choice, the steps and the sections, none of them a play button
      await page.locator('#predict [data-choice="stops"]').click()
      await page.getByRole('button', { name: 'Next step', exact: true }).click()
      await expect(page.locator('#stepNow')).toHaveText('2')
      for (const id of ['#words', '#sing', '#wrap', '#explorer'])
        await page.locator(id).scrollIntoViewIfNeeded()

      // Assert
      expect(after.contexts).toBe(1)
      expect(await heard(page)).toEqual(after)
    })

    test("the hero's two plays sit right under the stage, before the predict card", async ({
      page,
    }) => {
      // Act
      await page.goto('/learn/24')
      const box = async (sel: string) =>
        (await page.locator(sel).boundingBox()) ?? { y: 0, height: 0 }
      const stage = await box('#heroStage')
      const plays = await box('.hero-plays')
      const predict = await box('#predict')

      // Assert: under 1080 px the kit orders the hero's parts, and the plays
      // go with the stage, never to the top of the hero
      expect(plays.y).toBeGreaterThanOrEqual(stage.y + stage.height - 1)
      expect(plays.y + plays.height).toBeLessThanOrEqual(predict.y)
    })

    test('fits the screen across: no sideways scroll, the Wrap included', async ({
      page,
    }) => {
      // Arrange
      await page.goto('/learn/24')
      await expect(page.locator('#wrap a.next-card')).toBeVisible()

      // Act: every section met, free play's state switch and the next-lesson still among them
      for (const id of ['#predict', '#words', '#lesson', '#sing', '#wrap'])
        await page.locator(id).scrollIntoViewIfNeeded()
      const widths = await page.evaluate(() => ({
        page: document.documentElement.scrollWidth,
        screen: document.documentElement.clientWidth,
      }))

      // Assert
      expect(widths.page).toBeLessThanOrEqual(widths.screen)
    })

    test('draws no staff for show: no background staff behind the page, and none on a section head (WEB-SPEC, Look)', async ({
      page,
    }) => {
      // Act
      await page.goto('/learn/24')
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
  await page.goto('/learn/24')

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

/**
 * Both predicts' choices, made where the page stands: Step 2's sits in the
 * deck, which a scroll to it could carry on to another step.
 */
async function chooseBoth(page: Page): Promise<void> {
  await page.locator('#predict [data-choice="stops"]').dispatchEvent('click')
  await page.locator('#predict2 [data-choice="third"]').dispatchEvent('click')
}

test("the cold open: the pair free and never revealing, the slide held until a choice, and the reveal once the slide is heard to its end, Step 1's words with it (WEB-SPEC, Tests 4)", async ({
  page,
}) => {
  // Arrange: sound on from the gate
  test.setTimeout(40_000)
  await watchSound(page)
  await page.goto('/learn/24')
  await page.locator('#gateBtn').click()
  const pair = page.locator('#heroPlay')
  const slide = page.locator('.hero-plays [data-play="slide"]')
  const reveal = page.locator('#predict .reveal')
  const held = page.locator('#step-1 [data-held="1"]')
  const words = page.locator('#step-1 [data-reveal1]')
  const before = {
    slide: await slide.isDisabled(),
    held: await held.isHidden(),
    words: await words.first().isHidden(),
  }

  // Act: the pair heard to its end, 3 s, then a choice and the slide, 10 s
  const quiet = await heard(page)
  await pair.click()
  await expect
    .poll(async () => (await heard(page)).sources)
    .toBeGreaterThan(quiet.sources)
  await expect(pair).not.toHaveClass(/\bis-on\b/, { timeout: 6000 })
  const afterPair = await reveal.isHidden()
  await page.locator('#predict [data-choice="stops"]').click()
  await slide.click()
  const during = await reveal.isHidden()

  // Assert
  expect(before).toEqual({ slide: true, held: false, words: true })
  expect(afterPair).toBe(true)
  expect(during).toBe(true)
  await expect(reveal).toBeVisible({ timeout: 14_000 })
  await expect(held).toBeHidden()
  await expect(words.first()).toBeVisible()
})

test("nothing answers either predict before its choice: the steps' chart, free play, the Pure word and quick check 4's play wait for the cold open's; the piano's mi over the drone, free play's later states and Just listen today's play for Step 2's (WEB-SPEC, Tests 5 and 6)", async ({
  page,
}) => {
  // Arrange: sound on from the gate, on Step 1
  await page.goto('/learn/24')
  await page.locator('#gateBtn').click()
  const toy = page.locator('#toyChart')
  const free = page.locator('#freePlay')
  const pure = page.locator('#words [data-word-play="pure"]')
  const quiz = page.locator('#qs [data-quiz-play="pure"]')
  const hint = page.locator('#predict2 .lock-hint')
  const mi = page.locator('#step-3 [data-step-play="mi-piano"]')
  const freeMi = free.locator('[data-drone-play="mi-piano"]')
  const listen = page.locator('[data-listen-play]')
  await expect(quiz).toBeAttached()
  const first = {
    toy: await toy.locator('[data-drone-play="221"]').isDisabled(),
    top: await toy.locator('#droneTop').isDisabled(),
    lock: await toy.locator('[data-drone-lock]').isVisible(),
    free: await free.locator('[data-free-state="1"]').isDisabled(),
    pure: await pure.isDisabled(),
    drone: await page.locator('#words [data-word-play="drone"]').isDisabled(),
    quiz: await quiz.isDisabled(),
    choice: await page.locator('#predict2 [data-choice="fifth"]').isDisabled(),
  }
  await expect(hint).toHaveText('Choose an answer at the top first.')

  // Act: the cold open's choice
  await page.locator('#predict [data-choice="stops"]').click()

  // Assert: open, Step 2's own still held
  expect(first).toEqual({
    toy: true,
    top: true,
    lock: true,
    free: true,
    pure: true,
    drone: false,
    quiz: true,
    choice: true,
  })
  await expect(toy.locator('[data-drone-play="221"]')).toBeEnabled()
  await expect(toy.locator('[data-drone-lock]')).toBeHidden()
  await expect(free.locator('[data-free-state="1"]')).toBeEnabled()
  await expect(pure).toBeEnabled()
  await expect(page.locator('#words [data-word-lock]')).toBeHidden()
  await expect(quiz).toBeEnabled()
  await expect(page.locator('#qs [data-quiz-held]')).toBeHidden()
  await expect(hint).toHaveText('Choose an answer to unlock the two intervals.')
  await expect(mi).toBeDisabled()
  await expect(listen).toBeDisabled()
  await free.locator('[data-free-state="3"]').dispatchEvent('click')
  await expect(freeMi).toBeDisabled()
  await expect(free.locator('[data-drone-lock2]')).toBeVisible()

  // Act: Step 2's choice
  await page.locator('#predict2 [data-choice="third"]').dispatchEvent('click')

  // Assert
  await expect(mi).toBeEnabled()
  await expect(freeMi).toBeEnabled()
  await expect(free.locator('[data-drone-lock2]')).toBeHidden()
  await expect(listen).toBeEnabled()
  await expect(page.locator('[data-listen-lock]')).toBeHidden()
})

test("Sing it's listening path: the voice, then no Move do, headphones check, Start or sing-along, and its play, Merc's so and mi over the drone, waiting for Step 2's choice, with no microphone asked (WEB-SPEC, Tests 12)", async ({
  page,
}) => {
  // Arrange: sound on from the gate
  const asks = await spyOnMicrophone(page)
  await watchSound(page)
  await page.goto('/learn/24')
  await page.locator('#gateBtn').click()
  await page.locator('#sing').scrollIntoViewIfNeeded()
  const play = page.locator('[data-listen-play]')

  // Act: Just listen today, before either choice, then the voice Merc's
  // notes are sung in, since none is stored
  await page.locator('[data-comfort="listen"]').click()
  await expect(page.locator('[data-panel="voice"]')).toBeVisible()
  await page.locator('[data-voice="lower"]').click()

  // Assert: the listening panel alone
  await expect(page.locator('[data-panel="listen"]')).toBeVisible()
  await expect(
    page.locator('#singCard .sing-panel').filter({ visible: true }),
  ).toHaveCount(1)
  for (const sel of [
    '[data-move-do="1"]',
    '[data-phones="on"]',
    '[data-sing="start"]',
    '[data-sing="along"]',
  ])
    await expect(
      page.locator(`#singCard ${sel}`).filter({ visible: true }),
    ).toHaveCount(0)
  await expect(play).toBeDisabled()
  await expect(page.locator('[data-listen-lock]')).toBeVisible()

  // Act: both choices, then the play
  await chooseBoth(page)
  await expect(play).toBeEnabled()
  const before = await heard(page)
  await play.click()

  // Assert
  await expect(page.locator('[data-listen-lock]')).toBeHidden()
  await expect(play).toHaveClass(/\bis-on\b/)
  await expect
    .poll(async () => (await heard(page)).sources)
    .toBeGreaterThan(before.sources)
  expect(await asks()).toBe(0)
})

test('Sing it: the voice, then Move do and the headphones question; No headphones opens the sing-along, which sings do where Move do left it, with no microphone asked (WEB-SPEC, Tests 3 and 12)', async ({
  page,
}) => {
  // Arrange: sound on from the gate
  const asks = await spyOnMicrophone(page)
  await page.goto('/learn/24')
  await page.locator('#gateBtn').click()
  await page.locator('#sing').scrollIntoViewIfNeeded()
  const lower = page.locator('[data-move-do="-1"]')
  const higher = page.locator('[data-move-do="1"]')
  const doNow = page.locator('[data-do-now]')

  // Act: Sing, then the voice
  await page.locator('[data-comfort="sing"]').click()
  await page.locator('[data-voice="lower"]').click()

  // Assert: do on D, the lower end said but never disabled, so it keeps
  // its focus and its name
  await expect(page.locator('[data-panel="prepare"]')).toBeVisible()
  await expect(doNow).toHaveText('Do: D3')
  await expect(lower).toHaveAttribute('aria-disabled', 'true')
  expect(await lower.evaluate((b) => (b as HTMLButtonElement).disabled)).toBe(
    false,
  )

  // Act: do a semitone higher, No headphones, then the sing-along
  await higher.click()
  await expect(doNow).toContainText('D♯')
  await page.locator('[data-phones="off"]').click()
  await expect(page.locator('[data-panel="along"]')).toBeVisible()
  await page.locator('[data-sing="along"]').click()

  // Assert: do first, on D♯3, Merc alone; nothing listens
  await expect(lower).toHaveAttribute('aria-disabled', 'false')
  await expect(page.locator('[data-hold-head]')).toHaveText('Do, D♯3')
  await expect(page.locator('#singStatus')).toHaveText(
    'Merc sings do, D♯3, alone.',
  )
  expect(await asks()).toBe(0)
})

test("one sound at a time: the hero's pair, a word, the steps' chart, quick check 4, free play and Just listen today's play each stop the one before (WEB-SPEC, Tests)", async ({
  page,
}) => {
  // Arrange: sound on, both choices made, Sing it on its listening path,
  // every press made where it stands, so no section scrolls away and stops
  // a play by Lesson 3's rule for leaving (kit/leave.ts)
  await page.goto('/learn/24')
  await page.locator('#gateBtn').click()
  await chooseBoth(page)
  await page.locator('[data-comfort="listen"]').dispatchEvent('click')
  await page.locator('[data-voice="lower"]').dispatchEvent('click')
  await expect(page.locator('[data-listen-play]')).toBeEnabled()
  await expect(page.locator('#qs [data-quiz-play="pure"]')).toBeEnabled()

  // Act: each press 150 ms after the one before, by script, so no press
  // scrolls a play off screen (which stops it after 600 ms on its own)
  const lit = await page.evaluate(async () => {
    const PLAYS = [
      '#heroPlay',
      '#words [data-word-play="drone"]',
      '#toyChart [data-drone-play="221"]',
      '#qs [data-quiz-play="pure"]',
      '#freePlay [data-drone-play="222"]',
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
    '#words [data-word-play="drone"]',
    '#toyChart [data-drone-play="221"]',
    '#qs [data-quiz-play="pure"]',
    '#freePlay [data-drone-play="222"]',
    '[data-listen-play]',
    '#heroPlay',
  ])
})

test('the page asks for no microphone short of Start, sends nothing away and keeps only its own keys, through the cold open, a word, the steps, Sing it, free play and the quizzes', async ({
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
  await page.goto('/learn/24')

  // Act: the hero's pair and a choice, a word, Step 1's chart, the
  // sing-along, a free-play state, and an answer in each quiz
  await page.locator('#heroPlay').click()
  await page.locator('#predict [data-choice="stops"]').click()
  await page.locator('[data-word-play="pure"]').click()
  await openStep(page, '/learn/24', 1)
  await page.locator('#toyChart [data-drone-play="221"]').dispatchEvent('click')
  await page.locator('#sing').scrollIntoViewIfNeeded()
  await page.locator('[data-comfort="sing"]').click()
  await page.locator('[data-voice="higher"]').click()
  await page.locator('[data-phones="off"]').click()
  await page.locator('[data-sing="along"]').click()
  await page.locator('#freePlay [data-free-state="2"]').click()
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
        !/^fyp-l24-(seed|quiz-v1|recall-seed|recall-v1)$/.test(k) &&
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
      // Arrange: sound on and both predicts revealed, the slide and both
      // intervals heard to their ends, so every step shows all its controls
      test.setTimeout(120_000)
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.goto('/learn/24')
      await page.locator('#gateBtn').click()
      await page.locator('#predict [data-choice="stops"]').click()
      await page.locator('.hero-plays [data-play="slide"]').click()
      await expect(page.locator('#predict .reveal')).toBeVisible({
        timeout: 14_000,
      })
      await openStep(page, '/learn/24', 2)
      await page
        .locator('#predict2 [data-choice="third"]')
        .dispatchEvent('click')
      for (const k of ['fifth', 'third']) {
        const play = page.locator(`#predict2 [data-play="${k}"]`)
        await play.dispatchEvent('click')
        await expect(play).not.toHaveClass(/\bis-on\b/, { timeout: 7000 })
      }
      await expect(page.locator('#predict2 .reveal')).toBeVisible()
      const counts: Record<string, number> = {}

      // Act, Assert
      counts.hero = await expectTargets(page, '.hero-plays', 'The hero')
      await openStep(page, '/learn/24', 1)
      for (let n = 1; n <= 4; n++) {
        if (n > 1) await nextStep(page, n)
        // the step's chart, then its own text, whose plays and predict sit there
        counts[`step ${String(n)}`] =
          (await expectTargets(page, '#toyChart', `Step ${String(n)}`)) +
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
        hero: 2,
        'step 1': 7,
        'step 2': 9,
        'step 3': 3,
        'step 4': 2,
        sing: 4,
        free: 11,
      })
    })
  })
}
