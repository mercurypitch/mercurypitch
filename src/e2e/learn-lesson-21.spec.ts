// ============================================================
// Lesson 21 loads at /learn/21 as its own document, and boots
// ============================================================
//
// A Season 2 theory lesson, a draft until Lessons 6 and 15 are live and the
// vocal coach has looked at Sing it. Every build carries its document, and
// the e2e bundle shows drafts (`build:e2e` sets VITE_DRAFT_LESSONS=1); on
// mercurypitch.com the site worker answers its address with the 404 page
// until the admin console publishes it (src/lesson-gate.ts). Like every
// lesson it must load as itself, never as the 404 page or the studio's
// cached app shell, and its module must boot: at a phone's size and a
// desktop's, no AudioContext before the first tap, and nothing plays
// before a play button; and a visitor with the studio installed still gets
// the lesson, not the shell. It carries Season 2, so its masthead and its
// map are Season 2's, and it draws no staff for show (WEB-SPEC, Look).
// Then its own parts: the cold open's plays, staircases and reveal; each
// step's toy; the four words; Sing it's two runs and its guide; one sound
// at a time; no microphone, nothing sent away and only its own keys kept;
// and every target at least 44 px square at a phone's two widths.

import type { Locator, Page } from '@playwright/test'
import { expect, test } from './helpers/lesson-page'
import { expectTargets, openStep } from './helpers/lesson-qa'

// 60 characters at most (src/tests/lesson-pages.test.ts)
const TITLE = 'Key signatures and the circle of fifths | MercuryPitch'

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

    test('a hard load of /learn/21 answers 200 with the lesson @smoke', async ({
      page,
    }) => {
      // Act
      const response = await page.goto('/learn/21')

      // Assert
      expect(response?.status()).toBe(200)
      await expect(page).toHaveTitle(TITLE)
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(
        'G major needs one sharp and D major two. Why does each key a fifth up keep its sharps and add one?',
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
      await page.goto('/learn/21')
      await expect(
        page.locator('.ex-seasons [data-season="2"]'),
      ).toHaveAttribute('aria-pressed', 'true')
      await expect(page.locator('#stepNow')).toHaveText('1')
      await expect(page.locator('#deckNextLabel')).toHaveText(
        'Next: Why does each key a fifth up add a sharp?',
      )

      // Act: the whole page read, top to bottom, with no tap
      for (const id of ['#predict', '#words', '#lesson', '#sing', '#wrap'])
        await page.locator(id).scrollIntoViewIfNeeded()

      // Assert
      expect(await heard(page)).toEqual({ contexts: 0, sources: 0 })
      await expect(page.locator('.lm-btn')).toBeVisible()
      // the Wrap's card names the lesson after this one, from Season 2
      await expect(page.locator('#wrap a.next-card .eyebrow')).toContainText(
        'Next lesson 22',
      )
      expect(errors).toEqual([])
    })

    test("nothing plays but the sound switch's own chime until a play button is pressed", async ({
      page,
    }) => {
      // Arrange: sound on from the gate, which confirms it with its two soft notes
      await watchSound(page)
      await page.goto('/learn/21')
      await page.locator('#gateBtn').click()
      await expect(page.locator('#soundSwitch')).toHaveAttribute(
        'aria-pressed',
        'true',
      )
      const after = await heard(page)

      // Act: a choice, the steps and the sections, none of them a play button
      await page.locator('#predict [data-choice="g-sharp"]').click()
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
      await page.goto('/learn/21')
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
  await page.goto('/learn/21')

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

test('the cold open: D major lit on the ring at first paint, the A major plays locked until a choice, each drawing its small staircase as it sounds, and the reveal once both are heard (WEB-SPEC, Toys 3 and 5)', async ({
  page,
}) => {
  // Arrange
  test.setTimeout(40_000)
  await page.goto('/learn/21')
  await page.locator('#gateBtn').click()
  const ring = page.locator('#heroRing')
  const reveal = page.locator('#predict .reveal')
  const play = (k: string) => page.locator(`.hero-plays [data-play="${k}"]`)
  const stairs = (k: string) => page.locator(`[data-mini-stairs="${k}"] rect`)
  const locked = [
    await play('with-d-sharp').isDisabled(),
    await play('with-g-sharp').isDisabled(),
  ]
  const atRest = [
    await ring.locator('.ci-bead.is-lit').count(),
    await ring.locator('.ci-bead.is-key').count(),
    await ring.locator('.ci-thread').count(),
  ]

  // Act: D major heard, a choice, then each A major heard to its end
  await hearOut(play('d-major'))
  const afterD = await reveal.isHidden()
  await page.locator('#predict [data-choice="g-sharp"]').click()
  await hearOut(play('with-d-sharp'))
  const once = await reveal.isHidden()
  await hearOut(play('with-g-sharp'))

  // Assert: FACTS 33, 36 and 37
  expect(locked).toEqual([true, true])
  expect(atRest).toEqual([5, 2, 0])
  expect(afterD).toBe(true)
  expect(once).toBe(true)
  await expect(stairs('with-d-sharp')).toHaveCount(8)
  await expect(stairs('with-g-sharp')).toHaveCount(8)
  await expect(
    page.locator('[data-mini-stairs="with-g-sharp"] rect.is-semi'),
  ).toHaveCount(2)
  await expect(ring.locator('.ci-thread')).toHaveCount(1)
  await expect(reveal).toBeVisible({ timeout: 4000 })
})

test("each step's toy does what it says: the sharp joins G major's signature, the house adds a sharp a fifth, F major is spelled both ways, a tap finds do, and the walk's gap shows only on Pure (WEB-SPEC, Toys 1 to 4)", async ({
  page,
}) => {
  // Arrange: every move lands at once, and the choice is in
  test.setTimeout(90_000)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/learn/21')
  await page.locator('#gateBtn').click()
  await page.locator('#predict [data-choice="g-sharp"]').click()
  await openStep(page, '/learn/21', 1)

  // Step 1: G major from G2, its sharp joining the signature as it ends;
  // the white keys from G, plain, with none
  const stairs = page.locator('#toyStairs')
  await hearOut(stairs.locator('[data-stairs-play]'))
  await expect(stairs.locator('.st-keysign')).toHaveCount(1)
  await stairs.locator('[data-white-keys]').click()
  await hearOut(stairs.locator('[data-stairs-play]'))
  await expect(stairs.locator('.st-keysign')).toHaveCount(0)

  // Step 2: C round to G, then to D, a sharp joining at each
  await nextStep(page, 2)
  const circle = page.locator('#toyCircle')
  await circle.locator('[data-circle-step="1"]').click()
  await expect(circle.locator('.st-keysign')).toHaveCount(1, { timeout: 6000 })
  await circle.locator('[data-circle-step="1"]').click()
  await expect(circle.locator('.st-keysign')).toHaveCount(2, { timeout: 6000 })
  await expect(circle.locator('[data-staff-said]')).toHaveText(
    'Key signature: two sharps, F sharp and C sharp',
  )

  // Step 3: F major with A sharp, under no signature, two notes ringed;
  // then with B flat, under one flat
  await nextStep(page, 3)
  await circle.locator('[data-spelling="sharp"]').click()
  await expect(circle.locator('.st-outline')).toHaveCount(2, { timeout: 6000 })
  await expect(circle.locator('.st-keysign')).toHaveCount(0)
  await circle.locator('[data-spelling="flat"]').click()
  await expect(circle.locator('.st-keysign')).toHaveCount(1, { timeout: 6000 })

  // Step 4: a tap on the bass staff's bottom line, G2, finds G major's do
  await nextStep(page, 4)
  const find = page.locator('#toyFind')
  const svg = await find.locator('[data-staff-svg]').boundingBox()
  const bottom = await find
    .locator('[data-staff-svg] .st-line')
    .evaluateAll((ls) =>
      Math.max(...ls.map((l) => l.getBoundingClientRect().bottom)),
    )
  if (svg === null) throw new Error('no staff in Find do')
  await page.mouse.click(svg.x + svg.width * 0.6, bottom - 1)
  await expect(find.locator('[data-find-line]')).toContainText('Do is G.')
  await expect(find.locator('[data-find-next]')).toBeVisible()

  // Step 5: the walk on Pure runs past C by its gap, labelled; on Equal it closes
  await nextStep(page, 5)
  const walk = page.locator('#toyWalk')
  await walk.locator('[data-tuning="pure"]').click()
  await hearOut(walk.locator('[data-walk-play]'), 12_000)
  await expect(walk.locator('.ci-gap')).toHaveCount(1)
  await expect(walk.locator('.ci-gap-label')).toHaveText('23.46 cents')
  await walk.locator('[data-tuning="equal"]').click()
  await hearOut(walk.locator('[data-walk-play]'), 12_000)
  await expect(walk.locator('.ci-gap')).toHaveCount(0)
  await expect(walk.locator('.ci-thread')).toHaveCount(1)
})

test('the four words each play, their figures lit as they sound and kept as their plays leave them (WEB-SPEC, Toys 6)', async ({
  page,
}) => {
  // Arrange
  test.setTimeout(40_000)
  await page.goto('/learn/21#words')
  await page.locator('#gateBtn').click()
  const fig = (w: string) => page.locator(`[data-word-fig="${w}"]`)
  const play = (w: string) => page.locator(`[data-word-play="${w}"]`)
  const threadBefore = await fig('key').locator('.ci-thread').count()

  // Act, Assert: Key threads its ring round G major
  await hearOut(play('key'))
  expect(threadBefore).toBe(0)
  await expect(fig('key').locator('.ci-thread')).toHaveCount(1)

  // Key signature: one sharp, the last note written, no sign of its own
  await hearOut(play('signature'))
  await expect(fig('signature').locator('.st-keysign')).toHaveCount(1)
  await expect(fig('signature').locator('.st-head')).toHaveCount(1)
  await expect(
    fig('signature').locator('.st-sign:not(.st-keysign)'),
  ).toHaveCount(0)

  // Circle of fifths: four beads named, no sharp, the house beside them
  await hearOut(play('circle'))
  await expect(fig('circle').locator('text')).toHaveText(['C', 'G', 'D', 'A'])
  await expect(fig('circle').locator('.ci-home')).toHaveCount(1)

  // Equal temperament: thirteen tiles, dark once it ends
  await hearOut(play('equal'))
  await expect(fig('equal').locator('.et-tile')).toHaveCount(13)
  await expect(fig('equal').locator('.et-tile.is-lit')).toHaveCount(0)
})

test("Sing it: the voice before anything plays, Merc's two runs with the staff turning to G between them, the guide once they are heard, How did that feel? after its sweeps, and this page's line after Easy, with no microphone asked (WEB-SPEC, Toys 7)", async ({
  page,
}) => {
  // Arrange
  test.setTimeout(90_000)
  const asks = await spyOnMicrophone(page)
  await page.goto('/learn/21')
  await page.locator('#gateBtn').click()
  await page.locator('#sing').scrollIntoViewIfNeeded()
  const notes = page.locator('[data-notes-play]')
  const start = page.locator('[data-guide-start]')
  const staff = page.locator('#singStaff')

  // Act, Assert: the comfort check, then the voice, before any play shows
  await page.locator('[data-comfort="sing"]').click()
  await expect(notes).toBeHidden()
  await page.locator('[data-voice="lower"]').click()
  await expect(staff.locator('.st-head')).toHaveCount(4)
  await expect(staff.locator('.st-home')).toHaveCount(1)
  await expect(staff.locator('.st-keysign')).toHaveCount(0)
  await expect(start).toHaveAttribute('aria-disabled', 'true')

  // Merc's notes, 12.8 s: the run in C, the staff turning to G, the run in G
  await notes.click()
  await expect(staff.locator('.st-head.is-amber')).toHaveCount(1)
  await expect(staff.locator('.st-keysign')).toHaveCount(1, { timeout: 8000 })
  await expect(start).toHaveAttribute('aria-disabled', 'false', {
    timeout: 12_000,
  })
  await expect(staff.locator('.st-keysign')).toHaveCount(0)

  // the guide, 13.8 s: a count-in, the sweeps, then the question
  await start.click()
  await expect(staff.locator('.st-sweep')).toHaveCount(1, { timeout: 3000 })
  await expect(page.locator('[data-panel="feel"]')).toBeVisible({
    timeout: 18_000,
  })
  await page.locator('[data-feel="easy"]').click()
  await expect(page.locator('#singStatus')).toHaveText(
    'So, la, ti, do, in two keys: the same syllables on a new do.',
  )
  expect(await asks()).toBe(0)
})

test("one sound at a time: the recall's three notes stop the hero's play, a word stops them, Merc's notes stop a word, and a free-play move stops any of them (WEB-SPEC, Tests)", async ({
  page,
}) => {
  // Arrange: sound on, a choice made and a voice chosen, every play drawn;
  // Sing it answered where it stands, so no section scrolls away and stops
  // a press by Lesson 3's rule for leaving (kit/leave.ts)
  await page.goto('/learn/21')
  await page.locator('#gateBtn').click()
  await page.locator('#predict [data-choice="g-sharp"]').click()
  await page.locator('[data-comfort="listen"]').dispatchEvent('click')
  await page.locator('[data-voice="lower"]').dispatchEvent('click')
  await expect(page.locator('#recall-qs [data-quiz-three]')).toBeAttached()

  // Act: each press 150 ms after the one before, by script, so no press
  // scrolls a play off screen (which stops it after 600 ms on its own)
  const lit = await page.evaluate(async () => {
    const HERO = '.hero-plays [data-play="d-major"]'
    const THREE = '#recall-qs [data-quiz-three]'
    const WORD = '#words [data-word-play="key"]'
    const NOTES = '[data-notes-play]'
    const MOVE = '#freePlay [data-circle-step="1"]'
    const on = (sel: string): boolean =>
      document.querySelector(sel)?.classList.contains('is-on') ?? false
    const press = async (sel: string) => {
      document.querySelector<HTMLElement>(sel)?.click()
      await new Promise((r) => window.setTimeout(r, 150))
      return [HERO, THREE, WORD, NOTES].filter(on).join(' ')
    }
    return [
      await press(HERO),
      await press(THREE),
      await press(HERO),
      await press(WORD),
      await press(NOTES),
      await press(MOVE),
      await press(THREE),
      await press(NOTES),
    ]
  })

  // Assert: only the newest is lit, every time, and a move lights nothing
  expect(lit).toEqual([
    '.hero-plays [data-play="d-major"]',
    '#recall-qs [data-quiz-three]',
    '.hero-plays [data-play="d-major"]',
    '#words [data-word-play="key"]',
    '[data-notes-play]',
    '',
    '#recall-qs [data-quiz-three]',
    '[data-notes-play]',
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
  await page.goto('/learn/21')

  // Act: the hero's play and a choice, a word, Step 1's play, Merc's
  // notes, a free-play move, and an answer in each quiz
  await page.locator('#heroPlay').click()
  await page.locator('#predict [data-choice="g-sharp"]').click()
  await page.locator('[data-word-play="circle"]').click()
  await openStep(page, '/learn/21', 1)
  await page.locator('#toyStairs [data-stairs-play]').click()
  await page.locator('#sing').scrollIntoViewIfNeeded()
  await page.locator('[data-comfort="sing"]').click()
  await page.locator('[data-voice="higher"]').click()
  await page.locator('[data-notes-play]').click()
  await page.locator('#freePlay [data-circle-step="1"]').click()
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
        !/^fyp-l21-(seed|quiz-v1|recall-seed|recall-v1)$/.test(k) &&
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
      await page.goto('/learn/21')
      await page.locator('#predict [data-choice="g-sharp"]').click()
      const toys = [
        '',
        '#toyStairs',
        '#toyCircle',
        '#toyCircle',
        '#toyFind',
        '#toyWalk',
      ]
      const counts: Record<string, number> = {}

      // Act, Assert
      counts.hero = await expectTargets(page, '.hero-plays', 'The hero')
      counts.words = await expectTargets(page, '#words', 'The words')
      await openStep(page, '/learn/21', 1)
      for (let n = 1; n <= 5; n++) {
        if (n > 1) await nextStep(page, n)
        // at 344 px eight stairs share 312 px, 39 px each, the page's one
        // target under 44 px, as on Lesson 4's staircase: Step 1's row of
        // controls still keeps 44 px
        const scope =
          n === 1 && width < 390 ? '#toyStairs .stairs-controls' : toys[n]
        counts[`step ${String(n)}`] = await expectTargets(
          page,
          scope,
          `Step ${String(n)}`,
        )
        // the masthead is 58 px: the stage fits the 786 px below it, as
        // Lesson 4's does
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
      // free play's circle lays its beads out as it first comes into view
      await page.locator('#freePlay [data-circle-viz]').scrollIntoViewIfNeeded()
      await expect(
        page.locator('#freePlay [data-circle-beads] button').first(),
      ).toHaveAttribute('style', /left/)
      counts.free = await expectTargets(page, '#freePlay', 'Free play')
      expect(counts).toEqual({
        hero: 3,
        words: 4,
        // the eight stairs and their row, or the row alone at 344 px
        'step 1': width < 390 ? 5 : 13,
        'step 2': 9,
        'step 3': 12,
        'step 4': 5,
        'step 5': 3,
        sing: 5,
        free: 12,
      })
    })
  })
}
