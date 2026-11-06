// ============================================================
// Lesson 19 loads at /learn/19 as its own document, and boots
// ============================================================
//
// A Season 2 page, a draft until Lesson 17's page is live. Every build
// carries its document, and the e2e bundle shows drafts (`build:e2e` sets
// VITE_DRAFT_LESSONS=1); on mercurypitch.com the site worker answers its
// address with the 404 page until the admin console publishes it
// (src/lesson-gate.ts). Like every lesson it must load as itself, never as
// the 404 page or the studio's cached app shell, and its module must boot: at
// a phone's size and a desktop's, no AudioContext before the first tap, and
// nothing plays before a play button; and a visitor with the studio
// installed still gets the lesson, not the shell. It carries Season 2, so
// its masthead and its map are Season 2's, and it draws no staff for show
// (WEB-SPEC, Look). Then the page end to end (WEB-SPEC, Tests, end-to-end):
// the hero holds no number but its six pads, its groupings wait for a
// choice and draw their arcs only once one plays, and the reveal waits for
// both heard to their end; each step's controls do what Toys 1 says; the
// four words each play and stay written; the take, tapped by Space on a
// schedule from Start's own click, reads its every-beat line; the page never
// asks for the microphone, sends nothing away and keeps only its own keys;
// and at 390 and 344 px every target is 44 px square or more, none overlaps
// another, each of the six pads is 44 px wide or more, nothing scrolls
// sideways, and the take card has a take card's padding and status box,
// though the page loads no voice sheet (kit/lesson-voice.css).

import type { Locator, Page } from '@playwright/test'
import { expect, test } from './helpers/lesson-page'
import { expectTargets, openStep } from './helpers/lesson-qa'

// 60 characters at most (src/tests/lesson-pages.test.ts)
const TITLE = '6/8 time, triplets and syncopation explained | MercuryPitch'

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

    test('a hard load of /learn/19 answers 200 with the lesson @smoke', async ({
      page,
    }) => {
      // Act
      const response = await page.goto('/learn/19')

      // Assert
      expect(response?.status()).toBe(200)
      await expect(page).toHaveTitle(TITLE)
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(
        'Six notes in a bar, grouped two ways: why does one feel like two beats and the other like three?',
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
      await page.goto('/learn/19')
      await expect(
        page.locator('.ex-seasons [data-season="2"]'),
      ).toHaveAttribute('aria-pressed', 'true')
      await expect(page.locator('#stepNow')).toHaveText('1')
      await expect(page.locator('#deckNextLabel')).toHaveText(
        'Next: How do you count 6/8?',
      )

      // Act: the whole page read, top to bottom, with no tap
      for (const id of ['#predict', '#words', '#lesson', '#tap', '#wrap'])
        await page.locator(id).scrollIntoViewIfNeeded()

      // Assert
      expect(await heard(page)).toEqual({ contexts: 0, sources: 0 })
      await expect(page.locator('.lm-btn')).toBeVisible()
      // the Wrap's card names the lesson after this one, from Season 2
      await expect(page.locator('#wrap a.next-card .eyebrow')).toContainText(
        'Next lesson 20',
      )
      expect(errors).toEqual([])
    })

    test("nothing plays but the sound switch's own chime until a play button is pressed", async ({
      page,
    }) => {
      // Arrange: sound on from the gate, which confirms it with its two soft notes
      await watchSound(page)
      await page.goto('/learn/19')
      await page.locator('#gateBtn').click()
      await expect(page.locator('#soundSwitch')).toHaveAttribute(
        'aria-pressed',
        'true',
      )
      const after = await heard(page)

      // Act: a choice, the steps and the sections, none of them a play button
      await page.locator('#predict [data-choice="threes"]').click()
      await page.getByRole('button', { name: 'Next step', exact: true }).click()
      await expect(page.locator('#stepNow')).toHaveText('2')
      for (const id of ['#words', '#tap', '#wrap', '#explorer'])
        await page.locator(id).scrollIntoViewIfNeeded()

      // Assert
      expect(after.contexts).toBe(1)
      expect(await heard(page)).toEqual(after)
    })

    test('draws no staff for show: no background staff behind the page, and none on a section head (WEB-SPEC, Look)', async ({
      page,
    }) => {
      // Act
      await page.goto('/learn/19')
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
  await page.goto('/learn/19')

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
  page.locator(`#toyRhythm ${selector}`).filter({ visible: true })

/** Moves the deck on by its Next step button, to step `n`. */
async function nextStep(page: Page, n: number): Promise<void> {
  await page.getByRole('button', { name: 'Next step', exact: true }).click()
  await expect(page.locator('#stepNow')).toHaveText(String(n))
}

test('the cold open: no number in the hero but its six pads, the groupings locked until a choice, arcs only once a grouping plays, and the reveal once both are heard (WEB-SPEC, Toys 2 and 3)', async ({
  page,
}) => {
  // Arrange
  test.setTimeout(30_000)
  await page.goto('/learn/19')
  const hero = page.locator('#heroPads')
  const arcs = hero.locator('.rb-arc:not(.is-hidden)')
  const reveal = page.locator('#predict .reveal')
  const digits = await page.locator('#heroStage').evaluate((stage) => {
    const out: string[] = []
    const walk = document.createTreeWalker(stage, NodeFilter.SHOW_TEXT)
    for (let n = walk.nextNode(); n !== null; n = walk.nextNode()) {
      const p = n.parentElement
      const text = (n.textContent ?? '').trim()
      if (p === null || !/\d/.test(text) || p.closest('.sr') !== null) continue
      if (
        p.checkVisibility({ opacityProperty: true, visibilityProperty: true })
      )
        out.push(`${p.getAttribute('class') ?? p.tagName}: ${text}`)
    }
    return out
  })
  const locked = [
    await page.locator('#heroPlayThrees').isDisabled(),
    await page.locator('#heroPlayTwos').isDisabled(),
  ]

  // Act: Play six notes heard, a choice, then each grouping heard to its end
  await page.locator('#heroPlaySix').click()
  await expect(hero.locator('.rb-pad.is-now')).toHaveCount(1)
  await page.waitForTimeout(4300)
  const ungrouped = await arcs.count()
  await page.locator('#predict [data-choice="twos"]').click()
  await page.locator('#heroPlayThrees').click()
  await expect(arcs).toHaveCount(2, { timeout: 3000 })
  const once = await reveal.isHidden()
  await page.waitForTimeout(4800)
  await page.locator('#heroPlayTwos').click()
  await expect(arcs).toHaveCount(3, { timeout: 3000 })

  // Assert: Lesson 8's pads keep their numbers; nothing else holds one
  expect(digits).toEqual(
    ['1', '2', '3', '4', '5', '6'].map((d) => `rb-pad-n: ${d}`),
  )
  expect(locked).toEqual([true, true])
  expect([ungrouped, once]).toEqual([0, true])
  await expect(reveal).toBeVisible({ timeout: 8000 })
  await expect(page.locator('[data-fair-guess]')).toBeVisible()
})

test("each step's controls do what they say: 6/8 · 3/4 regrouping the six with nothing played, the tunes on the staff with Clef and the pitch line, the triplet and the moved note, and Count (WEB-SPEC, Toys 1, 5 and 6)", async ({
  page,
}) => {
  // Arrange: every move lands at once
  test.setTimeout(60_000)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await openStep(page, '/learn/19', 1)
  const said = page.locator('#toyRhythm [data-rb-said]')
  const fig = page.locator('#toyRhythm [data-rb]')
  const written = fig.locator('.rb-sym:not(.is-hidden)')

  // Act, Assert: Step 1 regroups and plays nothing until Play
  await showing(page, '[data-rb-metre="3-4"]').click()
  await expect(said).toHaveText('3/4: the six eighths in three groups of two')
  await expect(written).toHaveCount(0)
  await showing(page, '[data-rb-play]').click()
  await expect(written).toHaveCount(6, { timeout: 4000 })
  await expect(fig.locator('.rb-metre-digit')).toHaveText(['3', '4'])

  // Step 2: the 6/8 tune on the bass staff, heard to its end, then the treble
  await nextStep(page, 2)
  await expect(fig.locator('.rb-metre-digit').first()).toHaveText('6')
  await showing(page, '[data-rb-play]').click()
  await expect(written).toHaveCount(15, { timeout: 10_000 })
  await showing(page, '[data-rb-clef="treble"]').click()
  await expect(said).toHaveText('The treble staff: the tune from C4')
  await expect(written).toHaveCount(15)
  await showing(page, '[data-rb-lanes]').click()
  await expect(fig).toHaveAttribute('aria-label', /on the pitch line$/)
  await showing(page, '[data-rb-lanes]').click()

  // Step 3: beat 3 as a triplet, under its 3
  await nextStep(page, 3)
  await showing(page, '[data-rb-split="triplet"]').click()
  await expect(said).toHaveText(
    'Beat 3 as a triplet: three eighth notes in the time of two',
  )
  await showing(page, '[data-rb-play]').click()
  await expect(written).toHaveCount(7, { timeout: 6000 })
  await expect(fig.locator('.rb-tuplet')).toHaveCount(1)

  // Step 4: the note moved to "2 and", tied through beat 3, with Count
  await nextStep(page, 4)
  await showing(page, '[data-rb-move="on-2-and"]').click()
  await showing(page, '[data-rb-count]').click()
  await showing(page, '[data-rb-play]').click()
  await expect(written).toHaveCount(5, { timeout: 6000 })
  await expect(fig.locator('.rb-tie:not(.is-hidden)')).toHaveCount(1)
  await expect(fig.locator('.rb-count:not(.is-hidden)').first()).toHaveText('1')
})

test('the four words each play and stay written: the accent on its six pads, the other three on their line (WEB-SPEC, Toys 4)', async ({
  page,
}) => {
  // Arrange
  test.setTimeout(40_000)
  await page.goto('/learn/19#words')
  const said = page.locator('[data-words-said]')
  const fig = (w: string) => page.locator(`[data-word-fig="${w}"]`)

  // Act, Assert
  await page.locator('[data-word-play="accent"]').click()
  await expect(said).toHaveText(
    'Six closed hi-hats a third of a second apart, the first louder: 2 seconds.',
    { timeout: 5000 },
  )
  for (const [w, n] of [
    ['offbeat', 8],
    ['triplet', 5],
    ['syncopation', 5],
  ] as const) {
    await page.locator(`[data-word-play="${w}"]`).click()
    await expect(fig(w).locator('.rb-sym:not(.is-hidden)')).toHaveCount(n, {
      timeout: 6000,
    })
  }
  await expect(fig('accent').locator('.rb-sym')).toHaveCount(0)
  await expect(fig('triplet').locator('.rb-metre-digit')).toHaveText(['2', '4'])
})

test('the take, tapped by Space on every beat of the 6/8 tune both times through, reads "All 8 beats got a tap, and no tap fell between them." and never asks for the microphone (WEB-SPEC, Toys 7)', async ({
  page,
}) => {
  // Arrange: Space pressed on the pad on a schedule from Start's own click,
  // a 0.6 s lead, then beat by beat, a dotted quarter of 1 s: the first
  // time through with the click (beats 2 to 9), then the second on your own
  // (beats 10 to 17), each 100 ms late, a steady delay the lining-up takes
  // out (FACTS 35, 36)
  test.setTimeout(60_000)
  const asks = await spyOnMicrophone(page)
  await page.goto('/learn/19#tap')
  const status = page.locator('#takeStatus')
  const start = page.locator('[data-take-start="6-8"]')
  await expect(status).toHaveText(
    "Press a Start button when you're ready to tap.",
  )
  await start.evaluate((button) => {
    const pad = document.querySelector('[data-take-pad]')
    if (pad === null) return
    const press = (): void => {
      pad.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: ' ',
          bubbles: true,
          cancelable: true,
        }),
      )
      pad.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', bubbles: true }))
    }
    button.addEventListener(
      'click',
      () => {
        const t0 = performance.now()
        for (let b = 2; b <= 17; b++)
          window.setTimeout(
            press,
            t0 + 600 + b * 1000 + 100 - performance.now(),
          )
      },
      { once: true, capture: true },
    )
  })

  // Act
  await start.click()

  // Assert: the take walks its passes, then says its line over eight gold ticks
  await expect(status).toHaveText('Counting in: one bar.')
  await expect(status).toHaveText('Tap with the click: bar 1 of 4', {
    timeout: 5000,
  })
  await expect(status).toHaveText('Now on your own: bar 1 of 4', {
    timeout: 12_000,
  })
  await expect(status).toHaveText(
    'All 8 beats got a tap, and no tap fell between them.',
    { timeout: 15_000 },
  )
  await expect(page.locator('[data-take-strip] .rb-tick.is-met')).toHaveCount(8)
  await expect(start.locator('[data-label]')).toHaveText('Start: the 6/8 tune')
  expect(await asks()).toBe(0)
})

test('the page asks for no microphone, sends nothing away and keeps only its own keys, through the cold open, a word, the steps, a take and the quizzes', async ({
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
  await page.goto('/learn/19')

  // Act: the hero's play, a word, Step 1's Play, a take started and stopped,
  // free play's six, and an answer in each quiz
  await page.locator('#heroPlaySix').click()
  await page.locator('[data-word-play="offbeat"]').click()
  await openStep(page, '/learn/19', 1)
  await showing(page, '[data-rb-play]').click()
  const start = page.locator('[data-take-start="3-4"]')
  await start.click()
  await expect(page.locator('#takeStatus')).toHaveText('Counting in: one bar.')
  await start.click()
  await expect(page.locator('#takeStatus')).toHaveText(
    'Stopped. Press a Start button to tap again.',
  )
  await page.locator('#freePlay > .controls [data-rb-play]').click()
  await page.locator('#recall-qs .q .opt').first().click()
  await page.locator('#qs .q .opt').first().click()
  for (const id of ['#words', '#lesson', '#tap', '#wrap', '#explorer'])
    await page.locator(id).scrollIntoViewIfNeeded()

  // Assert
  expect(await asks()).toBe(0)
  expect(away).toEqual([])
  const keys = await page.evaluate(() => Object.keys(localStorage).sort())
  expect(
    keys.filter(
      (k) =>
        !/^fyp-l19-(seed|quiz-v1|recall-seed|recall-v1)$/.test(k) &&
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

    test('every target of the hero, Steps 1 to 4, the take and free play is at least 44 px square, none overlapping another, each of the six pads 44 px wide or more as it shows, in the hero, Step 1, the accent and free play, and nothing scrolls sideways (WEB-SPEC, Edge cases; FACTS 70)', async ({
      page,
    }) => {
      // Arrange
      test.setTimeout(90_000)
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.goto('/learn/19')
      const counts: Record<string, number> = {}
      // each pad's width as it shows, to a tenth of a pixel, so a drawing
      // scaled to fit its box would show
      const padWidths = (scope: string) =>
        page
          .locator(`${scope} .rb-pad-box`)
          .evaluateAll((boxes) =>
            boxes.map(
              (b) => Math.round(b.getBoundingClientRect().width * 10) / 10,
            ),
          )

      // Act, Assert
      counts.hero = await expectTargets(page, '.l19-hero', 'The hero')
      const hero = await padWidths('#heroPads')
      await openStep(page, '/learn/19', 1)
      const step1 = await padWidths('#toyRhythm')
      for (let n = 1; n <= 4; n++) {
        if (n > 1) await nextStep(page, n)
        counts[`step ${String(n)}`] = await expectTargets(
          page,
          '#toyRhythm',
          `Step ${String(n)}`,
        )
      }
      counts.take = await expectTargets(page, '#tapCard', 'The take')
      counts.free = await expectTargets(page, '#freePlay', 'Free play')
      const accent = await padWidths('[data-word-fig="accent"]')
      const free = await padWidths('#freePlay [data-free-bar]')
      expect([hero, step1, accent, free].map((w) => w.length)).toEqual([
        6, 6, 6, 6,
      ])
      expect(
        Math.min(...hero, ...step1, ...accent, ...free),
      ).toBeGreaterThanOrEqual(44)
      expect(counts).toEqual({
        hero: 7,
        'step 1': 3,
        'step 2': 7,
        'step 3': 4,
        'step 4': 4,
        take: 3,
        free: 9,
      })
    })

    test("the take card keeps a take card's look: its words 16 px or more inside its edge and its status in a box with a 3 px edge, though the page loads no voice sheet", async ({
      page,
    }) => {
      // Arrange
      await page.goto('/learn/19#tap')

      // Act
      const take = await page.locator('#tapCard').evaluate((card) => {
        const head = card.querySelector('#takeHead')
        const status = card.querySelector('#takeStatus')
        return {
          inset:
            head === null
              ? 0
              : head.getBoundingClientRect().left -
                card.getBoundingClientRect().left,
          edge:
            status === null
              ? ''
              : window.getComputedStyle(status).borderLeftWidth,
        }
      })

      // Assert
      expect(take.inset).toBeGreaterThanOrEqual(16)
      expect(take.edge).toBe('3px')
    })
  })
}
