// ============================================================
// Lesson 25 loads at /learn/25 as its own document, and boots
// ============================================================
//
// A Season 2 theory lesson, a draft until Lessons 10, 21 and 23 are live
// and the vocal coach has looked at its sung checkpoint and its sung drill.
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
// choice, each step's controls, the four words, Sing it, one sound at a
// time across all of them, no microphone, nothing sent away and only its
// own keys kept, and every target 44 px or more at a phone's two widths
// (WEB-SPEC, Tests).

import type { Locator, Page } from '@playwright/test'
import { expect, test } from './helpers/lesson-page'
import { expectTargets, openStep } from './helpers/lesson-qa'

// 60 characters at most (src/tests/lesson-pages.test.ts)
const TITLE = 'Harmonic and melodic minor, relative keys | MercuryPitch'

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

    test('a hard load of /learn/25 answers 200 with the lesson @smoke', async ({
      page,
    }) => {
      // Act
      const response = await page.goto('/learn/25')

      // Assert
      expect(response?.status()).toBe(200)
      await expect(page).toHaveTitle(TITLE)
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(
        'Why does a minor key often raise one note just before it comes home?',
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
      await page.goto('/learn/25')
      await expect(
        page.locator('.ex-seasons [data-season="2"]'),
      ).toHaveAttribute('aria-pressed', 'true')
      await expect(page.locator('#stepNow')).toHaveText('1')
      await expect(page.locator('#deckNextLabel')).toHaveText(
        'Next: What does the raised note do to the scale?',
      )

      // Act: the whole page read, top to bottom, with no tap
      for (const id of ['#predict', '#words', '#lesson', '#sing', '#wrap'])
        await page.locator(id).scrollIntoViewIfNeeded()

      // Assert
      expect(await heard(page)).toEqual({ contexts: 0, sources: 0 })
      await expect(page.locator('.lm-btn')).toBeVisible()
      // the Wrap's card names the lesson after this one, from Season 2
      await expect(page.locator('#wrap a.next-card .eyebrow')).toContainText(
        'Next lesson 26',
      )
      expect(errors).toEqual([])
    })

    test("nothing plays but the sound switch's own chime until a play button is pressed", async ({
      page,
    }) => {
      // Arrange: sound on from the gate, which confirms it with its two soft notes
      await watchSound(page)
      await page.goto('/learn/25')
      await page.locator('#gateBtn').click()
      await expect(page.locator('#soundSwitch')).toHaveAttribute(
        'aria-pressed',
        'true',
      )
      const after = await heard(page)

      // Act: a choice, the steps and the sections, none of them a play button
      await page.locator('#predict [data-choice="major"]').click()
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
      await page.goto('/learn/25')
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
  await page.goto('/learn/25')

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
  page.locator(`#toyMinor ${selector}`).filter({ visible: true })

/** Moves the deck on by its Next step button, to step `n`. */
async function nextStep(page: Page, n: number): Promise<void> {
  await page.getByRole('button', { name: 'Next step', exact: true }).click()
  await expect(page.locator('#stepNow')).toHaveText(String(n))
}

/** The hero's staircase at rest, as its label names it. */
const STAIRS_LABEL =
  "Lesson 10's minor staircase on A, do to do, with the house on do"

test('the cold open: the tune on the staircase, G sharp lifting te to ti the second time; the endings locked until a choice; each ending naming the chord before home as it sounds, drawn beside the stairs; and the reveal once both are heard (WEB-SPEC, Toys 2 and 3)', async ({
  page,
}) => {
  // Arrange
  test.setTimeout(60_000)
  await page.goto('/learn/25')
  await page.locator('#gateBtn').click()
  const said = page.locator('[data-hero-said]')
  const figure = page.locator('[data-hero-canvas]')
  const reveal = page.locator('#predict .reveal')
  const play = (k: 'tune' | 'end1' | 'end2'): Locator =>
    page.locator(`.hero-plays [data-play="${k}"]`)
  const locked = [
    await play('end1').isDisabled(),
    await play('end2').isDisabled(),
  ]

  // Act: the tune heard to its end, 17.0 s, then a choice and each ending
  await play('tune').click()
  await expect(said).toHaveText(
    'The tune, twice, each note lighting its stair.',
  )
  // G sharp 4 comes 15.5 s in, in the second time's last bar
  await expect(said).toHaveText('The second time, G sharp: te lifts to ti.', {
    timeout: 18_000,
  })
  await expect(play('tune')).not.toHaveClass(/\bis-on\b/, { timeout: 10_000 })
  const tuned = await figure.getAttribute('aria-label')
  await page.locator('#predict [data-choice="minor"]').click()
  await play('end1').click()
  await expect(said).toHaveText('E, G, B: 3 and 4 semitones, E minor.', {
    timeout: 4000,
  })
  const first = await figure.getAttribute('aria-label')
  const once = await reveal.isHidden()
  await expect(play('end1')).not.toHaveClass(/\bis-on\b/, { timeout: 6000 })
  await play('end2').click()
  await expect(said).toHaveText('E, G sharp, B: 4 and 3 semitones, E major.', {
    timeout: 4000,
  })

  // Assert: no chord drawn or named before the choice, then each ending's
  await expect(play('end2')).not.toHaveClass(/\bis-on\b/, { timeout: 6000 })
  expect(locked).toEqual([true, true])
  expect(tuned).toBe(STAIRS_LABEL)
  expect(first).toBe(
    `${STAIRS_LABEL}, and beside it the chord before home: E, G, B: 3 and 4 semitones, E minor.`,
  )
  expect(once).toBe(true)
  await expect(figure).toHaveAttribute(
    'aria-label',
    `${STAIRS_LABEL}, and beside it the chord before home: E, G sharp, B: 4 and 3 semitones, E major.`,
  )
  await expect(reveal).toBeVisible()
})

test("nothing answers the predict before the choice: no line above the quick check puts major beside the chord on so, the held controls wait, the choice opens them and the reveal Step 1's paragraph (WEB-SPEC, Tests 18)", async ({
  page,
}) => {
  // Arrange
  test.setTimeout(40_000)
  await page.goto('/learn/25')
  await page.locator('#gateBtn').click()
  const para = page.locator('[data-chord-para]')
  const held = [
    page.locator('#toyMinor [data-raise="te"]'),
    page.locator('#freePlay [data-raise="te"]'),
    page.locator('#freePlay [data-raise="le"]'),
    page.locator('#freePlay [data-minor-play="chord-home"]'),
  ]
  const disabled = (): Promise<boolean[]> =>
    Promise.all(held.map((b) => b.isDisabled()))

  // Act: every line a learner can read or hear above the quick check, the
  // predict's own two choices aside, then the choice and both endings
  const leaks = await page.evaluate(() => {
    const top =
      (document.querySelector('#quiz')?.getBoundingClientRect().top ?? 0) +
      window.scrollY
    const chord =
      /E, G(♯( sharp)?)? and B|the chord on so|the chord before home/i
    return [
      ...document.querySelectorAll<HTMLElement>(
        'p, li, h1, h2, h3, h4, button, figcaption, [aria-label]',
      ),
    ]
      .filter(
        (el) =>
          el.closest('#predict .choices') === null &&
          el.getBoundingClientRect().top + window.scrollY < top &&
          el.checkVisibility(),
      )
      .map((el) => `${el.innerText} ${el.getAttribute('aria-label') ?? ''}`)
      .filter((text) => /\bmajor\b/i.test(text) && chord.test(text))
  })
  const before = await disabled()
  const hidden = await para.isHidden()
  await page.locator('#predict [data-choice="major"]').click()
  const chosen = await disabled()
  const stillHidden = await para.isHidden()
  for (const k of ['end1', 'end2']) {
    const ending = page.locator(`.hero-plays [data-play="${k}"]`)
    await ending.click()
    await expect(ending).toHaveClass(/\bis-on\b/)
    await expect(ending).not.toHaveClass(/\bis-on\b/, { timeout: 8000 })
  }

  // Assert: FACTS 1a, 36
  expect(leaks).toEqual([])
  expect(before).toEqual([true, true, true, true])
  expect(hidden).toBe(true)
  expect(chosen).toEqual([false, false, false, false])
  expect(stillHidden).toBe(true)
  await expect(para).toBeVisible()
  await expect(page.locator('[data-held-line]')).toBeHidden()
})

test("each step's controls do what they say: Raise te turns the chord on so major, so, ti, do writes its sharp, le to ti is 3 semitones, melodic minor falls back coming down, and C minor's flats move into the signature (WEB-SPEC, Toys 1)", async ({
  page,
}) => {
  // Arrange: every move lands at once, and the choice is in
  test.setTimeout(60_000)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/learn/25')
  await page.locator('#gateBtn').click()
  await page.locator('#predict [data-choice="major"]').click()
  await openStep(page, '/learn/25', 1)
  const said = page.locator('#toyMinor [data-beads-said]')
  const staff = page.locator('#toyMinor [data-staff-svg]')
  const te = showing(page, '[data-raise="te"]')

  // Act, Assert: Step 1, te raised and lowered, then so, ti, do written
  await te.click()
  await expect(said).toHaveText(
    'Te raised to ti: G sharp 3. E, G sharp, B: 4 and 3 semitones, E major.',
  )
  await te.click()
  await expect(te).toHaveAttribute('aria-pressed', 'false')
  await page.locator('[data-step-play="so-ti-do"]').click()
  await expect(page.locator('[data-step-play="so-ti-do"]')).not.toHaveClass(
    /\bis-on\b/,
    { timeout: 6000 },
  )
  await expect(staff.locator('.st-head')).toHaveCount(3)
  await expect(staff.locator('.st-sign:not(.st-keysign)')).toHaveCount(1)

  // Step 2: le to te, then le to ti, each size said as it plays
  await nextStep(page, 2)
  await page.locator('[data-step-play="le-pairs"]').click()
  await expect(said).toHaveText('Le to ti, F to G sharp: 3 semitones.', {
    timeout: 6000,
  })

  // Step 3: Raise le, then the scale up and down
  await nextStep(page, 3)
  await showing(page, '[data-raise="le"]').click()
  await expect(showing(page, '[data-raise="le"]')).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await showing(page, '[data-minor-play="scale"]').click()
  await expect(said).toHaveText(
    'Coming down, la and ti fall back to le and te.',
    { timeout: 10_000 },
  )

  // Step 4: C minor's flats, each with its own sign, then in the signature
  await nextStep(page, 4)
  await page.locator('[data-step-play="c-minor"]').click()
  await expect(page.locator('#toyMinor [data-staff-said]')).toHaveText(
    'Key signature: three flats, B flat, E flat and A flat',
    { timeout: 10_000 },
  )
  await expect(staff.locator('.st-keysign')).toHaveCount(3)
})

test('the four words each play on their own staircase and say their scale once heard (WEB-SPEC, Toys 4)', async ({
  page,
}) => {
  // Arrange
  test.setTimeout(60_000)
  await page.goto('/learn/25#words')
  await page.locator('#gateBtn').click()
  const said = page.locator('[data-words-said]')
  const play = (w: string): Locator => page.locator(`[data-word-play="${w}"]`)

  // Act, Assert: each lit as it plays, and said once heard to its end
  for (const [w, line] of [
    [
      'natural',
      'A natural minor, do to do: A, B, C, D, E, F, G, A. Steps of 2, 1, 2, 2, 1, 2 and 2 semitones.',
    ],
    [
      'harmonic',
      'A harmonic minor, do to do: A, B, C, D, E, F, G sharp, A. Steps of 2, 1, 2, 2, 1, 3 and 1 semitones.',
    ],
    [
      'melodic',
      'A melodic minor, going up, do to do: A, B, C, D, E, F sharp, G sharp, A. Steps of 2, 1, 2, 2, 2, 2 and 1 semitones. Coming down, la and ti fall back to le and te.',
    ],
    [
      'relative',
      'C major, do on C. A minor on the same white keys: do moves from C down to A, which was la.',
    ],
  ] as const) {
    await play(w).click()
    await expect(play(w)).toHaveClass(/\bis-on\b/)
    await expect(said).toHaveText(line, { timeout: 10_000 })
    await expect(play(w)).not.toHaveClass(/\bis-on\b/)
  }
})

test("Sing it: the voice before anything plays, so, te, do and so, ti, do on the learner's staff, the guide once Merc's notes are heard, How did that feel? after its sweep, and this page's line after Easy, with no microphone asked (WEB-SPEC, Toys 5)", async ({
  page,
}) => {
  // Arrange
  test.setTimeout(60_000)
  const asks = await spyOnMicrophone(page)
  await page.goto('/learn/25')
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
  await expect(staff.locator('.st-home')).toHaveCount(2)
  await expect(staff.locator('.st-sign')).toHaveCount(1)
  await expect(start).toHaveAttribute('aria-disabled', 'true')

  // Merc's notes heard to their end, 9.4 s, open the guide
  await notes.click()
  await expect(staff.locator('.st-head.is-blue')).toHaveCount(1)
  await expect(start).toHaveAttribute('aria-disabled', 'false', {
    timeout: 14_000,
  })

  // the guide: a count-in, a 9.4 s sweep, then the question
  await start.click()
  await expect(staff.locator('.st-sweep')).toHaveCount(1, { timeout: 3000 })
  await expect(page.locator('[data-panel="feel"]')).toBeVisible({
    timeout: 14_000,
  })
  await page.locator('[data-feel="easy"]').click()
  await expect(page.locator('#singStatus')).toHaveText(
    'So, te, do, then so, ti, do: you just raised the seventh.',
  )
  expect(await asks()).toBe(0)
})

test("one sound at a time: the tune, a word, an ending, a step's play, the quick check's scale, Merc's notes and free play each stop what played before (WEB-SPEC, Tests)", async ({
  page,
}) => {
  // Arrange: sound on, a choice made and a voice chosen, every play drawn;
  // Sing it answered where it stands, so no section scrolls away and stops
  // a press by Lesson 3's rule for leaving (kit/leave.ts)
  await page.goto('/learn/25')
  await page.locator('#gateBtn').click()
  await page.locator('#predict [data-choice="major"]').click()
  await page.locator('[data-comfort="listen"]').dispatchEvent('click')
  await page.locator('[data-voice="lower"]').dispatchEvent('click')
  await expect(page.locator('#qs [data-quiz-play="scale"]')).toBeAttached()

  // Act: each press 150 ms after the one before, by script, so no press
  // scrolls a play off screen (which stops it after 600 ms on its own); a
  // hero play waits for the one before it to stop, so another sound comes
  // between two of them
  const lit = await page.evaluate(async () => {
    const TUNE = '#heroPlay'
    const END = '.hero-plays [data-play="end1"]'
    const WORD = '#words [data-word-play="natural"]'
    const STEP = '[data-step-play="so-te-do"]'
    const QUIZ = '#qs [data-quiz-play="scale"]'
    const NOTES = '[data-notes-play]'
    const FREE = '#freePlay [data-minor-play="so-te-do"]'
    const all = [TUNE, END, WORD, STEP, QUIZ, NOTES, FREE]
    const on = (sel: string): boolean =>
      document.querySelector(sel)?.classList.contains('is-on') ?? false
    const press = async (sel: string) => {
      document.querySelector<HTMLElement>(sel)?.click()
      await new Promise((r) => window.setTimeout(r, 150))
      return all.filter(on).join(' ')
    }
    return [
      await press(TUNE),
      await press(WORD),
      await press(END),
      await press(STEP),
      await press(QUIZ),
      await press(NOTES),
      await press(FREE),
      await press(TUNE),
    ]
  })

  // Assert: only the newest is lit, every time
  expect(lit).toEqual([
    '#heroPlay',
    '#words [data-word-play="natural"]',
    '.hero-plays [data-play="end1"]',
    '[data-step-play="so-te-do"]',
    '#qs [data-quiz-play="scale"]',
    '[data-notes-play]',
    '#freePlay [data-minor-play="so-te-do"]',
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
  await page.goto('/learn/25')

  // Act: the hero's tune and a choice, a word, Step 1's play, Merc's notes,
  // a free-play play, and an answer in each quiz
  await page.locator('#heroPlay').click()
  await page.locator('#predict [data-choice="major"]').click()
  await page.locator('[data-word-play="harmonic"]').click()
  await openStep(page, '/learn/25', 1)
  await page.locator('[data-step-play="so-ti-do"]').click()
  await page.locator('#sing').scrollIntoViewIfNeeded()
  await page.locator('[data-comfort="sing"]').click()
  await page.locator('[data-voice="higher"]').click()
  await page.locator('[data-notes-play]').click()
  await page.locator('#freePlay [data-minor-play="so-ti-do"]').click()
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
        !/^fyp-l25-(seed|quiz-v1|recall-seed|recall-v1)$/.test(k) &&
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
      await page.goto('/learn/25')
      await page.locator('#predict [data-choice="major"]').click()
      const counts: Record<string, number> = {}

      // Act, Assert
      counts.hero = await expectTargets(page, '.hero-plays', 'The hero')
      await openStep(page, '/learn/25', 1)
      for (let n = 1; n <= 4; n++) {
        if (n > 1) await nextStep(page, n)
        counts[`step ${String(n)}`] = await expectTargets(
          page,
          '#toyMinor',
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
        'step 1': 4,
        'step 2': 3,
        'step 3': 5,
        'step 4': 3,
        sing: 5,
        free: 15,
      })
    })
  })
}
