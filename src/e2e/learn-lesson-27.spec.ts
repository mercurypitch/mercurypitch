// ============================================================
// Lesson 27 loads at /learn/27 as its own document, and boots
// ============================================================
//
// A Season 2 theory lesson, a draft until Lessons 12 and 23 are live and
// the vocal coach has looked at its sung checkpoint and its sung drill.
// Every build carries its document, and the e2e bundle shows drafts
// (`build:e2e` sets VITE_DRAFT_LESSONS=1); on mercurypitch.com the site
// worker answers its address with the 404 page until the admin console
// publishes it (src/lesson-gate.ts). Like every lesson it must load as
// itself, never as the 404 page or the studio's cached app shell, and its
// module must boot: at a phone's size and a desktop's, no AudioContext
// before the first tap, and nothing plays before a play button; and a
// visitor with the studio installed still gets the lesson, not the shell.
// It carries Season 2, so its masthead and its map are Season 2's, and it
// draws no staff for show (WEB-SPEC, Look). Then the page's parts in a real
// browser: the cold open and its predict, nothing answering it before the
// choice, each step's controls and Step 4's own predict, the three words,
// Sing it, one sound at a time across all of them, no microphone, nothing
// sent away and only its own keys kept, and every target 44 px or more at
// a phone's two widths (WEB-SPEC, Tests).

import type { Locator, Page } from '@playwright/test'
import { expect, test } from './helpers/lesson-page'
import { expectTargets, liveSaid, openStep, watchLive, } from './helpers/lesson-qa'

// 60 characters at most (src/tests/lesson-pages.test.ts)
const TITLE = 'Seventh chords and chord inversions | MercuryPitch'

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

    test('a hard load of /learn/27 answers 200 with the lesson @smoke', async ({
      page,
    }) => {
      // Act
      const response = await page.goto('/learn/27')

      // Assert
      expect(response?.status()).toBe(200)
      await expect(page).toHaveTitle(TITLE)
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(
        'Add one note to the V chord and it pulls towards home. Which note, and why?',
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
      await page.goto('/learn/27')
      await expect(
        page.locator('.ex-seasons [data-season="2"]'),
      ).toHaveAttribute('aria-pressed', 'true')
      await expect(page.locator('#stepNow')).toHaveText('1')
      await expect(page.locator('#deckNextLabel')).toHaveText(
        'Next: Does an extra note just make a chord richer?',
      )

      // Act: the whole page read, top to bottom, with no tap
      for (const id of ['#predict', '#words', '#lesson', '#sing', '#wrap'])
        await page.locator(id).scrollIntoViewIfNeeded()

      // Assert
      expect(await heard(page)).toEqual({ contexts: 0, sources: 0 })
      await expect(page.locator('.lm-btn')).toBeVisible()
      // the Wrap's card names the lesson after this one, from Season 2
      await expect(page.locator('#wrap a.next-card .eyebrow')).toContainText(
        'Next lesson 28',
      )
      expect(errors).toEqual([])
    })

    test("nothing plays but the sound switch's own chime until a play button is pressed", async ({
      page,
    }) => {
      // Arrange: sound on from the gate, which confirms it with its two soft notes
      await watchSound(page)
      await page.goto('/learn/27')
      await page.locator('#gateBtn').click()
      await expect(page.locator('#soundSwitch')).toHaveAttribute(
        'aria-pressed',
        'true',
      )
      const after = await heard(page)

      // Act: a choice, the steps and the sections, none of them a play button
      await page.locator('#predict [data-choice="f"]').click()
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
      await page.goto('/learn/27')
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
  await page.goto('/learn/27')

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

/** The steps' toy's control `selector` finds in the row its step shows. */
const showing = (page: Page, selector: string): Locator =>
  page.locator(`#toyRing ${selector}`).filter({ visible: true })

/** Moves the deck on by its Next step button, to step `n`. */
async function nextStep(page: Page, n: number): Promise<void> {
  await page.getByRole('button', { name: 'Next step', exact: true }).click()
  await expect(page.locator('#stepNow')).toHaveText(String(n))
}

/** Presses a play and waits for it to be heard to its end: lit, then not. */
async function hear(play: Locator, timeout = 8000): Promise<void> {
  await play.click()
  await expect(play).toHaveClass(/\bis-on\b/)
  await expect(play).not.toHaveClass(/\bis-on\b/, { timeout })
}

/** The hero's ring at rest, as its label names it. */
const RING_LABEL =
  "Lesson 12's ring of rooms: V's room lit, G, B and D, and I's room faint, C, E and G"

test("the cold open: V, then I, free from the start; the answering plays locked until a choice, each saying its four notes as they sound and no chord's name; the reveal once both are heard; then F's play names V7 (WEB-SPEC, Toys 2 and 3)", async ({
  page,
}) => {
  // Arrange
  test.setTimeout(60_000)
  await watchLive(page)
  await page.goto('/learn/27')
  await page.locator('#gateBtn').click()
  const figure = page.locator('#heroRing canvas')
  const reveal = page.locator('#predict .reveal')
  const play = (k: 'vi' | 'f' | 'fsharp'): Locator =>
    page.locator(`.hero-plays [data-play="${k}"]`)
  const ring = async (): Promise<string[]> =>
    (await liveSaid(page))
      .filter((s) => s.where === 'heroRing')
      .map((s) => s.text)
  const locked = [
    await play('f').isDisabled(),
    await play('fsharp').isDisabled(),
  ]

  // Act: V, then I, heard; a choice; each answering play heard, then F's again
  await hear(play('vi'))
  const free = await ring()
  const rest = await figure.getAttribute('aria-label')
  await page.locator('#predict [data-choice="fsharp"]').click()
  await hear(play('f'))
  const once = await reveal.isHidden()
  await hear(play('fsharp'))
  await expect(reveal).toBeVisible()
  await hear(play('f'))

  // Assert: the four notes said as letters, no chord named, until the reveal
  expect(locked).toEqual([true, true])
  expect(free).toEqual(['V, G major: G, B and D', 'I, C major: C, E and G'])
  expect(rest).toBe(RING_LABEL)
  expect(once).toBe(true)
  expect((await ring()).slice(2)).toEqual([
    'G, B, D and F',
    'I, C major: C, E and G',
    'G, B, D and F sharp',
    'I, C major: C, E and G',
    'V7: G, B, D and F',
    'I, C major: C, E and G',
  ])
  await expect(figure).toHaveAttribute('aria-label', RING_LABEL)
})

test("nothing answers the predict before the choice: no line above Sing it names V7 or V's four notes with F, on any step, the held controls wait, the choice opens them and Step 4's choices, and the reveal shows Step 1's paragraph on so and Steps 2 and 3's text (WEB-SPEC, Tests 3)", async ({
  page,
}) => {
  // Arrange
  test.setTimeout(40_000)
  await page.goto('/learn/27')
  await page.locator('#gateBtn').click()
  const held = [
    '#toyRing [data-part="1"] [data-chip="V"]',
    '#freePlay [data-chip="V"]',
    '#freePlay [data-ring-play="v-seventh"]',
    '#freePlay [data-ring-play="sevenths"]',
    '#freePlay [data-ring-play="dom-home"]',
    '#freePlay [data-ring-play="tritone"]',
    '#freePlay [data-ring-play="v7-home"]',
    '#predict4 [data-choice="still"]',
    '#predict4 [data-choice="eminor"]',
  ].map((sel) => page.locator(sel))
  const disabled = (): Promise<boolean[]> =>
    Promise.all(held.map((b) => b.isDisabled()))
  const texts = ['1', '2', '3'].map((n) => page.locator(`[data-held="${n}"]`))
  const hidden = (): Promise<boolean[]> =>
    Promise.all(texts.map((t) => t.isHidden()))

  /** Every line a learner can read above Sing it that answers the predict. */
  const answering = (): Promise<string[]> =>
    page.evaluate(() => {
      const top =
        (document.querySelector('#sing')?.getBoundingClientRect().top ?? 0) +
        window.scrollY
      // V7 by name, or V's four notes with F and not F sharp; Step 3's
      // heading names the dominant seventh, and none of its notes (FACTS 1a)
      const answer = /\bV7\b|G, B, D and F\b(?!♯| sharp)/
      return [
        ...document.querySelectorAll<HTMLElement>(
          'p, li, h1, h2, h3, h4, button, figcaption, [aria-label]',
        ),
      ]
        .filter(
          (el) =>
            el.getBoundingClientRect().top + window.scrollY < top &&
            el.checkVisibility(),
        )
        .map((el) => `${el.innerText} ${el.getAttribute('aria-label') ?? ''}`)
        .filter((text) => answer.test(text))
    })

  // Act: those lines with the toy on each step, each showing its own
  // controls, then the choice and both answering plays
  const leaks = await answering()
  for (const n of [2, 3, 4]) {
    await nextStep(page, n)
    leaks.push(...(await answering()))
  }
  const before = await disabled()
  const hiddenBefore = await hidden()
  await page.locator('#predict [data-choice="f"]').click()
  const chosen = await disabled()
  const hiddenChosen = await hidden()
  for (const k of ['fsharp', 'f'])
    await hear(page.locator(`.hero-plays [data-play="${k}"]`))

  // Assert: FACTS 1a, 39, 40
  expect(leaks).toEqual([])
  expect(before).toEqual(held.map(() => true))
  expect(hiddenBefore).toEqual([true, true, true])
  expect(chosen).toEqual(held.map(() => false))
  expect(hiddenChosen).toEqual([true, true, true])
  for (const t of texts) await expect(t).toBeVisible()
  await expect(
    page.locator('[data-held-line]').filter({ visible: true }),
  ).toHaveCount(0)
})

test("each step's controls do what they say: the seventh on I and on V, V7 going home, B to F across the ring closing to C and E, and Step 4's choice, its two plays and Turn over naming each position (WEB-SPEC, Toys 1 and 3)", async ({
  page,
}) => {
  // Arrange: every move lands at once, the choice made and both its plays heard
  test.setTimeout(90_000)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/learn/27')
  await page.locator('#gateBtn').click()
  await page.locator('#predict [data-choice="f"]').click()
  for (const k of ['f', 'fsharp'])
    await hear(page.locator(`.hero-plays [data-play="${k}"]`))
  await openStep(page, '/learn/27', 1)
  const readout = page.locator('#toyRing [data-ring-readout]')
  const said = page.locator('#toyRing [data-ring-said]')
  const figure = page.locator('#toyRing [data-ring-canvas]')
  const staff = page.locator('#toyRing [data-staff-svg]')

  // Act, Assert: Step 1, the seventh on I, then V, marked as the lit chord
  await showing(page, '[data-seventh]').click()
  await expect(readout).toHaveText('Root to seventh: 11 semitones')
  await showing(page, '[data-chip="V"]').click()
  await expect(readout).toHaveText('Root to seventh: 10 semitones')
  await expect(figure).toHaveAttribute(
    'aria-label',
    /V7: G, B, D and F\. Root to seventh: 10 semitones/,
  )
  await expect(showing(page, '[data-chip="V"]')).toHaveClass(/\bis-lit\b/)
  await expect(staff.locator('.st-head')).toHaveCount(4)
  await hear(page.locator('[data-step-play="v-seventh"]'))
  await expect(said).toHaveText('V7: G, B, D and F')

  // Step 2: the dominant seventh going home
  await nextStep(page, 2)
  await hear(page.locator('[data-step-play="dom-home"]'))
  await expect(said).toHaveText('I, C major: C, E and G')

  // Step 3: B to F across the ring, then the pair closing to C and E
  await nextStep(page, 3)
  await expect(readout).toHaveText('B to F: 6 semitones')
  await hear(page.locator('[data-step-play="tritone"]'))
  await expect(said).toHaveText('C and E')

  // Step 4: its own choice, its two plays heard, then Turn over names each position
  await nextStep(page, 4)
  await page.locator('#predict4 [data-choice="still"]').click()
  for (const k of ['turn', 'eminor'])
    await hear(page.locator(`#predict4 [data-play="${k}"]`))
  await expect(page.locator('[data-reveal4]')).toBeVisible()
  await expect(readout).toHaveText('Root position')
  const turn = showing(page, '[data-turn]')
  await hear(turn)
  await expect(readout).toHaveText('First inversion')
  await expect(said).toHaveText(
    'C major, first inversion, E in the bass: E, G and C',
  )
  await hear(showing(page, '[data-chip="V7"]'))
  for (let k = 0; k < 3; k++) await hear(turn)
  await expect(readout).toHaveText('Third inversion')
  await expect(said).toHaveText(
    'V7, third inversion, F in the bass: F, G, B and D',
  )
})

test('the three words each play on their own staff and say what they played once heard (WEB-SPEC, Toys 4)', async ({
  page,
}) => {
  // Arrange
  test.setTimeout(40_000)
  await page.goto('/learn/27#words')
  await page.locator('#gateBtn').click()
  const said = page.locator('[data-words-said]')
  const play = (w: string): Locator => page.locator(`[data-word-play="${w}"]`)

  // Act, Assert: each lit as it plays, and said once heard to its end
  for (const [w, line, heads] of [
    ['seventh', 'C, E, G and B, one by one, then together.', 4],
    ['major', 'C up to B.', 2],
    ['minor', 'C up to B flat.', 2],
  ] as const) {
    await hear(play(w))
    await expect(said).toHaveText(line)
    await expect(page.locator(`[data-word-fig="${w}"] .st-head`)).toHaveCount(
      heads,
    )
  }
})

test("Sing it: the voice before anything plays, so, ti, re, fa, then mi, then do in G on the learner's staff, the guide once Merc's notes are heard, How did that feel? after its sweep, and this page's line after Easy, with no microphone asked (WEB-SPEC, Toys 5)", async ({
  page,
}) => {
  // Arrange
  test.setTimeout(60_000)
  const asks = await spyOnMicrophone(page)
  await page.goto('/learn/27')
  await page.locator('#gateBtn').click()
  await page.locator('#sing').scrollIntoViewIfNeeded()
  const notes = page.locator('[data-notes-play]')
  const start = page.locator('[data-guide-start]')
  const staff = page.locator('#singStaff')

  // Act, Assert: the comfort check, then the voice, before any play shows
  await page.locator('[data-comfort="sing"]').click()
  await expect(notes).toBeHidden()
  await page.locator('[data-voice="lower"]').click()
  await expect(staff.locator('.st-head')).toHaveCount(6)
  await expect(staff.locator('.st-home')).toHaveCount(1)
  await expect(staff.locator('.st-sign')).toHaveCount(1)
  await expect(staff.locator('.st-ledger')).toHaveCount(1)
  await expect(start).toHaveAttribute('aria-disabled', 'true')

  // Merc's notes heard to their end, 7.8 s, open the guide
  await notes.click()
  await expect(staff.locator('.st-head.is-blue')).toHaveCount(1)
  await expect(start).toHaveAttribute('aria-disabled', 'false', {
    timeout: 12_000,
  })

  // the guide: a count-in, a 7.8 s sweep, then the question
  await start.click()
  await expect(staff.locator('.st-sweep')).toHaveCount(1, { timeout: 3000 })
  await expect(page.locator('[data-panel="feel"]')).toBeVisible({
    timeout: 12_000,
  })
  await page.locator('[data-feel="easy"]').click()
  await expect(page.locator('#singStatus')).toHaveText(
    'So, ti, re, fa, then mi, then do: the dominant seventh, going home.',
  )
  expect(await asks()).toBe(0)
})

test("one sound at a time: V then I, a word, an answering play, a step's play, the quick check's chord, Merc's notes and free play each stop what played before (WEB-SPEC, Tests)", async ({
  page,
}) => {
  // Arrange: sound on, a choice made and a voice chosen, every play drawn;
  // Sing it answered where it stands, so no section scrolls away and stops
  // a press by Lesson 3's rule for leaving (kit/leave.ts)
  await page.goto('/learn/27')
  await page.locator('#gateBtn').click()
  await page.locator('#predict [data-choice="f"]').click()
  await page.locator('[data-comfort="listen"]').dispatchEvent('click')
  await page.locator('[data-voice="lower"]').dispatchEvent('click')
  await expect(page.locator('#qs [data-quiz-play="chord"]')).toBeAttached()

  // Act: each press 150 ms after the one before, by script, so no press
  // scrolls a play off screen (which stops it after 600 ms on its own); a
  // hero play waits for the one before it to stop, so another sound comes
  // between two of them
  const lit = await page.evaluate(async () => {
    const HERO = '#heroPlay'
    const END = '.hero-plays [data-play="f"]'
    const WORD = '#words [data-word-play="seventh"]'
    const STEP = '[data-step-play="i-seventh"]'
    const QUIZ = '#qs [data-quiz-play="chord"]'
    const NOTES = '[data-notes-play]'
    const FREE = '#freePlay [data-ring-play="i-seventh"]'
    const all = [HERO, END, WORD, STEP, QUIZ, NOTES, FREE]
    const on = (sel: string): boolean =>
      document.querySelector(sel)?.classList.contains('is-on') ?? false
    const press = async (sel: string) => {
      document.querySelector<HTMLElement>(sel)?.click()
      await new Promise((r) => window.setTimeout(r, 150))
      return all.filter(on).join(' ')
    }
    return [
      await press(HERO),
      await press(WORD),
      await press(END),
      await press(STEP),
      await press(QUIZ),
      await press(NOTES),
      await press(FREE),
      await press(HERO),
    ]
  })

  // Assert: only the newest is lit, every time
  expect(lit).toEqual([
    '#heroPlay',
    '#words [data-word-play="seventh"]',
    '.hero-plays [data-play="f"]',
    '[data-step-play="i-seventh"]',
    '#qs [data-quiz-play="chord"]',
    '[data-notes-play]',
    '#freePlay [data-ring-play="i-seventh"]',
    '#heroPlay',
  ])
})

test('the page asks for no microphone, sends nothing away and keeps only its own keys, through the cold open, a word, the steps, Sing it, free play and the quizzes', async ({
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
  await page.goto('/learn/27')

  // Act: the hero's V, then I, and a choice, a word, Step 1's play, Merc's
  // notes, a free-play play, and an answer in each quiz
  await page.locator('#heroPlay').click()
  await page.locator('#predict [data-choice="fsharp"]').click()
  await page.locator('[data-word-play="major"]').click()
  await openStep(page, '/learn/27', 1)
  await page.locator('[data-step-play="i-seventh"]').click()
  await page.locator('#sing').scrollIntoViewIfNeeded()
  await page.locator('[data-comfort="sing"]').click()
  await page.locator('[data-voice="higher"]').click()
  await page.locator('[data-notes-play]').click()
  await page.locator('#freePlay [data-ring-play="i-seventh"]').click()
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
        !/^fyp-l27-(seed|quiz-v1|recall-seed|recall-v1)$/.test(k) &&
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

    test("every target of the hero, Steps 1 to 4, Step 4's predict, Sing it and free play is at least 44 px square, none overlapping another, and nothing scrolls sideways (WEB-SPEC, Edge cases)", async ({
      page,
    }) => {
      // Arrange: both choices in, so every step shows all its controls
      test.setTimeout(90_000)
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.goto('/learn/27')
      await page.locator('#predict [data-choice="f"]').click()
      const counts: Record<string, number> = {}

      // Act, Assert
      counts.hero = await expectTargets(page, '.hero-plays', 'The hero')
      await openStep(page, '/learn/27', 1)
      for (let n = 1; n <= 4; n++) {
        if (n > 1) await nextStep(page, n)
        if (n === 4)
          await page.locator('#predict4 [data-choice="still"]').click()
        counts[`step ${String(n)}`] = await expectTargets(
          page,
          '#toyRing',
          `Step ${String(n)}`,
        )
      }
      counts.predict4 = await expectTargets(
        page,
        '#predict4',
        "Step 4's predict",
      )
      await page.locator('#sing').scrollIntoViewIfNeeded()
      await page.locator('[data-comfort="sing"]').click()
      await page.locator('[data-voice="lower"]').click()
      counts.sing = await expectTargets(page, '#singCard', 'Sing it')
      counts.free = await expectTargets(page, '#freePlay', 'Free play')
      expect(counts).toEqual({
        hero: 3,
        'step 1': 6,
        'step 2': 3,
        'step 3': 3,
        'step 4': 6,
        predict4: 4,
        sing: 5,
        free: 13,
      })
    })
  })
}
