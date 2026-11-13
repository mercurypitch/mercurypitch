// ============================================================
// Lesson 26 loads at /learn/26 as its own document, and boots
// ============================================================
//
// A Season 2 voice lesson, a draft until Lessons 12 and 24 are live, its
// lab test has passed and the vocal coach has signed off its voice lines
// and its checkpoint.
// Every build carries its document, and the e2e bundle shows drafts
// (`build:e2e` sets VITE_DRAFT_LESSONS=1); on mercurypitch.com the site
// worker answers its address with the 404 page until the admin console
// publishes it (src/lesson-gate.ts). Like every lesson it must load as
// itself, never as the 404 page or the studio's cached app shell, and its
// module must boot: at a phone's size and a desktop's, no AudioContext
// before the first tap, and nothing plays before a play button; and a
// visitor with the studio installed still gets the lesson, not the shell.
// It carries Season 2, so its masthead and its map are Season 2's, and it
// draws no staff at all (WEB-SPEC, Look). A hero play pressed with the
// drawing scrolled away brings it back by the page's own scroll, never the
// stage's, which clips its bubbles.
//
// Then the page's own (WEB-SPEC, Tests): the cold open's predict, Play them
// together held until a choice and the reveal once it is heard; nothing
// answering the predict before its choice; Sing it's listening path and its
// sing-along, with no microphone asked; one sound at a time; nothing sent
// away and only its own keys kept; and every target 44 px or more at a
// phone's two widths. Sing it's runs, with a microphone, are the units'
// (sing.test.ts): a browser's fake microphone cannot keep quiet for the
// quiet check and then sing a part in time against another.

import type { Page } from '@playwright/test'
import { expect, test } from './helpers/lesson-page'
import { expectTargets, openStep } from './helpers/lesson-qa'

// 60 characters at most (src/tests/lesson-pages.test.ts)
const TITLE = 'How to sing a harmony in thirds | MercuryPitch'

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

    test('a hard load of /learn/26 answers 200 with the lesson @smoke', async ({
      page,
    }) => {
      // Act
      const response = await page.goto('/learn/26')

      // Assert
      expect(response?.status()).toBe(200)
      await expect(page).toHaveTitle(TITLE)
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(
        'Can you make a harmony by singing the tune a third higher?',
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
      await page.goto('/learn/26')
      await expect(
        page.locator('.ex-seasons [data-season="2"]'),
      ).toHaveAttribute('aria-pressed', 'true')
      await expect(page.locator('#stepNow')).toHaveText('1')
      await expect(page.locator('#deckNextLabel')).toHaveText(
        'Next: Is a harmony the tune moved up?',
      )

      // Act: the whole page read, top to bottom, with no tap
      for (const id of ['#predict', '#words', '#lesson', '#sing', '#wrap'])
        await page.locator(id).scrollIntoViewIfNeeded()

      // Assert
      expect(await heard(page)).toEqual({ contexts: 0, sources: 0 })
      await expect(page.locator('.lm-btn')).toBeVisible()
      // the Wrap's card names the lesson after this one, from Season 2
      await expect(page.locator('#wrap a.next-card .eyebrow')).toContainText(
        'Next lesson 27',
      )
      expect(errors).toEqual([])
    })

    test("nothing plays but the sound switch's own chime until a play button is pressed", async ({
      page,
    }) => {
      // Arrange: sound on from the gate, which confirms it with its two soft notes
      await watchSound(page)
      await page.goto('/learn/26')
      await page.locator('#gateBtn').click()
      await expect(page.locator('#soundSwitch')).toHaveAttribute(
        'aria-pressed',
        'true',
      )
      const after = await heard(page)

      // Act: a choice, the steps and the sections, none of them a play button
      await page.locator('#predict [data-choice="leaves"]').click()
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
      await page.goto('/learn/26')
      const background = await page.evaluate(
        () => getComputedStyle(document.body).backgroundImage,
      )

      // Assert: the three glows stay, the five-line tile goes
      expect(background).not.toContain('repeating-linear-gradient')
      expect(background).toContain('radial-gradient')
      await expect(page.locator('.mv-staff')).toHaveCount(0)
    })

    test("brings the hero's drawing back by the page's scroll when a play is pressed with it scrolled away, and never scrolls the stage", async ({
      page,
    }) => {
      // Arrange: the choice made, the drawing scrolled away above the screen
      await page.goto('/learn/26')
      await page.locator('#predict [data-choice="leaves"]').click()
      await page.evaluate(() => {
        const figure = document.querySelector('#heroTune')
        if (figure === null) throw new Error('no #heroTune')
        // at once: the page's own scroll is smooth
        window.scrollBy({
          top: figure.getBoundingClientRect().bottom + 40,
          behavior: 'instant',
        })
      })

      // Act: Play them together, pressed where it sits, as a finger would
      await page.evaluate(() =>
        document
          .querySelector<HTMLButtonElement>(
            '.hero-plays [data-play="together"]',
          )
          ?.click(),
      )

      // Assert: the drawing in view again, the stage's bubbles where they were
      await expect
        .poll(() =>
          page.evaluate(() => {
            const r = document
              .querySelector('#heroTune')
              ?.getBoundingClientRect()
            return (
              r !== undefined && r.top >= 0 && r.bottom <= window.innerHeight
            )
          }),
        )
        .toBe(true)
      expect(
        await page.evaluate(
          () => document.querySelector('#heroStage')?.scrollTop ?? -1,
        ),
      ).toBe(0)
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
  await page.goto('/learn/26')

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

/** Whether each of Steps 1 and 2's held words is hidden. */
const heldHidden = (page: Page): Promise<boolean[]> =>
  page
    .locator('[data-held]')
    .evaluateAll((els) => els.map((e) => (e as HTMLElement).hidden))

test("the cold open: the tune free and never revealing, Play them together held until a choice, and the reveal once it is heard to its end, Steps 1 and 2's words with it (WEB-SPEC, Tests 4)", async ({
  page,
}) => {
  // Arrange: sound on from the gate
  test.setTimeout(45_000)
  await watchSound(page)
  await page.goto('/learn/26')
  await page.locator('#gateBtn').click()
  const tune = page.locator('#heroPlay')
  const together = page.locator('.hero-plays [data-play="together"]')
  const reveal = page.locator('#predict .reveal')
  const heldLine = page.locator('[data-held-line="1"]')
  const before = {
    together: await together.isDisabled(),
    line: await heldLine.isVisible(),
    words: await heldHidden(page),
  }

  // Act: the tune heard to its end, 8 s, then a choice and the two together
  const quiet = await heard(page)
  await tune.click()
  await expect
    .poll(async () => (await heard(page)).sources)
    .toBeGreaterThan(quiet.sources)
  await expect(tune).not.toHaveClass(/\bis-on\b/, { timeout: 11_000 })
  const afterTune = await reveal.isHidden()
  await page.locator('#predict [data-choice="leaves"]').click()
  await together.click()
  const during = await reveal.isHidden()

  // Assert
  expect(before).toEqual({ together: true, line: true, words: [true, true] })
  expect(afterTune).toBe(true)
  expect(during).toBe(true)
  await expect(reveal).toBeVisible({ timeout: 12_000 })
  await expect(heldLine).toBeHidden()
  expect(await heldHidden(page)).toEqual([false, false])
})

test("nothing answers the predict before its choice: the steps' figure and every step's play, free play, quick check 2's answers and quick check 4's play wait, the words play free, and the choice opens them all (WEB-SPEC, Tests 5 and 6)", async ({
  page,
}) => {
  // Arrange: sound on from the gate, on Step 1
  await page.goto('/learn/26')
  await page.locator('#gateBtn').click()
  const stage = page.locator('#stepsStage')
  const free = page.locator('#freePlay')
  const q2 = page.locator('#qs .q', { hasText: 'A friend harmonises a tune' })
  const q4 = page.locator('#qs [data-quiz-play="parts"]')
  await expect(q4).toBeAttached()
  const first = {
    up: await stage.locator('[data-pair="1"]').isDisabled(),
    lock: await stage.locator('[data-lock-line]').isVisible(),
    step3: await page.locator('[data-step-play="duet"]').isDisabled(),
    free: await free.locator('[data-toy-play="thirds"]').isDisabled(),
    word: await page.locator('#words [data-word-play="part"]').isDisabled(),
    q2: await q2.locator('.opt').first().isDisabled(),
    q2Held: await q2.locator('[data-quiz-held]').textContent(),
    q4: await q4.isDisabled(),
  }

  // Act: the cold open's choice
  await page.locator('#predict [data-choice="leaves"]').click()

  // Assert: held until it, open from it
  expect(first).toEqual({
    up: true,
    lock: true,
    step3: true,
    free: true,
    word: false,
    q2: true,
    q2Held: 'Choose an answer at the top to try this.',
    q4: true,
  })
  await expect(stage.locator('[data-pair="1"]')).toBeEnabled()
  await expect(stage.locator('[data-lock-line]')).toBeHidden()
  await expect(page.locator('[data-step-play="duet"]')).toBeEnabled()
  await expect(free.locator('[data-toy-play="thirds"]')).toBeEnabled()
  await expect(q2.locator('.opt').first()).toBeEnabled()
  await expect(q2.locator('[data-quiz-held]')).toBeHidden()
  await expect(q4).toBeEnabled()
})

test("Sing it's listening path: Just listen today, the voice, then the listening panel with no headphones check, Start or sing-along, and its play, with no microphone asked (WEB-SPEC, Tests 11)", async ({
  page,
}) => {
  // Arrange: sound on from the gate
  const asks = await spyOnMicrophone(page)
  await watchSound(page)
  await page.goto('/learn/26')
  await page.locator('#gateBtn').click()
  await page.locator('#sing').scrollIntoViewIfNeeded()
  const play = page.locator('[data-listen-play]')

  // Act: Just listen today, then the voice that picks who sings, since none is stored
  await page.locator('[data-comfort="listen"]').click()
  await expect(page.locator('[data-panel="voice"]')).toBeVisible()
  await page.locator('[data-voice="lower"]').click()

  // Assert: the listening panel, the voice kept beside it, and nothing that sings
  await expect(page.locator('[data-panel="listen"]')).toBeVisible()
  expect(
    await page
      .locator('#singCard .sing-panel')
      .evaluateAll((ps) =>
        ps
          .filter((p) => !(p as HTMLElement).hidden)
          .map((p) => (p as HTMLElement).dataset.panel),
      ),
  ).toEqual(['listen', 'voice'])
  for (const sel of [
    '[data-phones="on"]',
    '[data-sing="start"]',
    '[data-sing="along"]',
  ])
    await expect(
      page.locator(`#singCard ${sel}`).filter({ visible: true }),
    ).toHaveCount(0)

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

test("Sing it: the voice, then the headphones question naming the other singer's part; No headphones opens the sing-along, which sings your part alone, counts in and plays the two parts, then asks how it felt, with no microphone asked (WEB-SPEC, Tests 11)", async ({
  page,
}) => {
  // Arrange: sound on from the gate
  test.setTimeout(60_000)
  const asks = await spyOnMicrophone(page)
  await page.goto('/learn/26')
  await page.locator('#gateBtn').click()
  await page.locator('#sing').scrollIntoViewIfNeeded()
  const status = page.locator('#singStatus')

  // Act: Sing, then the higher voice
  await page.locator('[data-comfort="sing"]').click()
  await page.locator('[data-voice="higher"]').click()

  // Assert: Tavi sings the other part for the higher voice
  await expect(page.locator('[data-panel="phones"]')).toBeVisible()
  await expect(page.locator('[data-panel="phones"]')).toContainText(
    "Tavi's part",
  )

  // Act: No headphones, then the sing-along
  await page.locator('[data-phones="off"]').click()
  await expect(page.locator('[data-panel="along"]')).toBeVisible()
  await page.locator('[data-sing="along"]').click()

  // Assert: the model, the count-in, the two parts, then the question
  await expect(status).toHaveText('Tavi sings your part alone first.')
  await expect(status).toHaveText('Counting in: one bar.', { timeout: 10_000 })
  await expect(status).toHaveText(/^The sing-along:/, { timeout: 8000 })
  await expect(page.locator('[data-panel="feel"]')).toBeVisible({
    timeout: 12_000,
  })
  await page.locator('[data-feel="easy"]').click()
  await expect(
    page
      .locator('[data-panel="after"] .sing-btns button')
      .filter({ visible: true }),
  ).toHaveText(['Swap parts', 'Sing along again', 'Done for today'])
  expect(await asks()).toBe(0)
})

test("one sound at a time: the hero's tune, a word, the steps' figure, quick check 4, free play and Just listen today's play each stop the one before (WEB-SPEC, Tests)", async ({
  page,
}) => {
  // Arrange: sound on, the choice made, Sing it on its listening path (its
  // voice brings the card into view), then the deck on Step 2, every press
  // made where it stands, so no section scrolls away and stops a play by
  // Lesson 3's rule for leaving (kit/leave.ts). The hero's play brings its
  // drawing back into view, at once under reduced motion, so the page does
  // not scroll through the steps while the presses come.
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/learn/26')
  await page.locator('#gateBtn').click()
  await page.locator('#predict [data-choice="leaves"]').click()
  await page.locator('[data-comfort="listen"]').dispatchEvent('click')
  await page.locator('[data-voice="lower"]').dispatchEvent('click')
  await expect(page.locator('[data-listen-play]')).toBeVisible()
  await openStep(page, '/learn/26', 2)
  await expect(page.locator('#qs [data-quiz-play="parts"]')).toBeEnabled()

  // Act: each press 150 ms after the one before, by script, so no press
  // scrolls a play off screen (which stops it after 600 ms on its own)
  const lit = await page.evaluate(async () => {
    const PLAYS = [
      '#heroPlay',
      '#words [data-word-play="part"]',
      '#stepsStage [data-toy-play="copy"]',
      '#qs [data-quiz-play="parts"]',
      '#freePlay [data-toy-play="thirds"]',
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
    '#words [data-word-play="part"]',
    '#stepsStage [data-toy-play="copy"]',
    '#qs [data-quiz-play="parts"]',
    '#freePlay [data-toy-play="thirds"]',
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
  await page.goto('/learn/26')

  // Act: the hero's tune and a choice, a word, Step 2's copy, the
  // sing-along, a free-play state, and an answer in each quiz
  await page.locator('#heroPlay').click()
  await page.locator('#predict [data-choice="leaves"]').click()
  await page.locator('[data-word-play="part"]').click()
  await openStep(page, '/learn/26', 2)
  await page
    .locator('#stepsStage [data-toy-play="copy"]')
    .dispatchEvent('click')
  await page.locator('#sing').scrollIntoViewIfNeeded()
  await page.locator('[data-comfort="sing"]').click()
  await page.locator('[data-voice="higher"]').click()
  await page.locator('[data-phones="off"]').click()
  await page.locator('[data-sing="along"]').click()
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
        !/^fyp-l26-(seed|quiz-v1|recall-seed|recall-v1)$/.test(k) &&
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
      // Arrange: sound on and the predict revealed, the two heard together
      // to their end, so every step shows all its controls
      test.setTimeout(120_000)
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.goto('/learn/26')
      await page.locator('#gateBtn').click()
      await page.locator('#predict [data-choice="leaves"]').click()
      await page.locator('.hero-plays [data-play="together"]').click()
      await expect(page.locator('#predict .reveal')).toBeVisible({
        timeout: 12_000,
      })
      const counts: Record<string, number> = {}

      // Act, Assert
      counts.hero = await expectTargets(page, '.hero-plays', 'The hero')
      counts.predict = await expectTargets(page, '#predict', 'The predict')
      await openStep(page, '/learn/26', 1)
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
        hero: 2,
        predict: 3,
        'step 1': 5,
        'step 2': 6,
        'step 3': 10,
        'step 4': 5,
        sing: 4,
        free: 7,
      })
    })
  })
}
