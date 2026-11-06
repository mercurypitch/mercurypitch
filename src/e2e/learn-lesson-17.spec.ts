// ============================================================
// Lesson 17 loads at /learn/17 as its own document, and boots
// ============================================================
//
// A Season 2 page, a draft until Lesson 8's page is live and the vocal coach
// has looked at the sung part. Every build carries its document, and the e2e
// bundle shows drafts (`build:e2e` sets VITE_DRAFT_LESSONS=1); on
// mercurypitch.com the site worker answers its address with the 404 page
// until the admin console publishes it (src/lesson-gate.ts). Like every
// lesson it must load as itself, never as the 404 page or the studio's cached
// app shell, and its module must boot: at a phone's size and a desktop's, no
// AudioContext before the first tap, and nothing plays before a play button;
// and a visitor with the studio installed still gets the lesson, not the
// shell. It carries Season 2, so its masthead and its map are Season 2's, and
// it draws no staff for show (WEB-SPEC, Look). Then the page end to end
// (WEB-SPEC, Tests, end-to-end 1 and 3): the hero holds no number before its
// first play, its two plays write four quarter notes and read "1 s" and
// "0.5 s", and the reveal waits for the faster play heard to its end; each
// step's controls do what Toys 1 says; the take, tapped by Space on a
// schedule from Start's own click, reads its every-note line; the page never
// asks for the microphone, sends nothing away and keeps only its own keys;
// and at 390 and 344 px every target is 44 px square or more, none overlaps
// another, and nothing scrolls sideways.

import type { Locator, Page } from '@playwright/test'
import { expect, test } from './helpers/lesson-page'
import { expectTargets, openStep } from './helpers/lesson-qa'

// 60 characters at most (src/tests/lesson-pages.test.ts)
const TITLE = 'Note values: whole, half and quarter notes | MercuryPitch'

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

    test('a hard load of /learn/17 answers 200 with the lesson @smoke', async ({
      page,
    }) => {
      // Act
      const response = await page.goto('/learn/17')

      // Assert
      expect(response?.status()).toBe(200)
      await expect(page).toHaveTitle(TITLE)
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(
        'Why is a quarter note not a quarter of a second?',
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
      await page.goto('/learn/17')
      await expect(
        page.locator('.ex-seasons [data-season="2"]'),
      ).toHaveAttribute('aria-pressed', 'true')
      await expect(page.locator('#stepNow')).toHaveText('1')
      await expect(page.locator('#deckNextLabel')).toHaveText(
        'Next: So what sets how long a note lasts?',
      )

      // Act: the whole page read, top to bottom, with no tap
      for (const id of ['#predict', '#words', '#lesson', '#sing', '#wrap'])
        await page.locator(id).scrollIntoViewIfNeeded()

      // Assert
      expect(await heard(page)).toEqual({ contexts: 0, sources: 0 })
      await expect(page.locator('.lm-btn')).toBeVisible()
      // the Wrap's card names the lesson after this one, from Season 2
      await expect(page.locator('#wrap a.next-card .eyebrow')).toContainText(
        'Next lesson 18',
      )
      expect(errors).toEqual([])
    })

    test("nothing plays but the sound switch's own chime until a play button is pressed", async ({
      page,
    }) => {
      // Arrange: sound on from the gate, which confirms it with its two soft notes
      await watchSound(page)
      await page.goto('/learn/17')
      await page.locator('#gateBtn').click()
      await expect(page.locator('#soundSwitch')).toHaveAttribute(
        'aria-pressed',
        'true',
      )
      const after = await heard(page)

      // Act: a choice, the steps and the sections, none of them a play button
      await page.locator('#predict [data-choice="half"]').click()
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
      await page.goto('/learn/17')
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
  await page.goto('/learn/17')

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

test('the cold open: no number in the hero but its beat pads before a play, the 60 BPM bar written as four quarter notes reading "1 s", the 120 BPM bar reading "0.5 s", and the reveal only once that play is heard (WEB-SPEC, Toys 2 and 3)', async ({
  page,
}) => {
  // Arrange
  await page.goto('/learn/17')
  const hero = page.locator('#heroPads')
  const readings = hero.locator('.rb-read:not(.is-hidden)')
  const said = page.locator('[data-hero-said]')
  const reveal = page.locator('#predict .reveal')
  // every digit that shows, by where it sits: a reading, the metre, a bubble
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
  const before = {
    written: await hero.locator('.rb-sym:not(.is-hidden)').count(),
    said: await said.textContent(),
  }

  // Act: the 60 BPM play heard to its end, a choice, then the 120 BPM play
  const locked = await page.locator('#heroPlay120').isDisabled()
  await page.locator('#heroPlay60').click()
  await expect(readings).toHaveText(['1 s', '1 s', '1 s', '1 s'], {
    timeout: 10_000,
  })
  await expect(said).toHaveText(
    'Four quarter notes at 60 beats per minute: 1 second each.',
  )
  const slow = await reveal.isHidden()
  await page.locator('#predict [data-choice="half"]').click()
  await page.locator('#heroPlay120').click()
  const playing = await reveal.isHidden()
  await expect(readings).toHaveText(['0.5 s', '0.5 s', '0.5 s', '0.5 s'], {
    timeout: 10_000,
  })

  // Assert: Lesson 8's pads keep their beat numbers; nothing else holds a number
  expect(digits).toEqual([
    'rb-pad-n: 1',
    'rb-pad-n: 2',
    'rb-pad-n: 3',
    'rb-pad-n: 4',
  ])
  expect(before).toEqual({ written: 0, said: '' })
  expect([locked, slow, playing]).toEqual([true, true, true])
  await expect(hero.locator('.rb-sym:not(.is-hidden)')).toHaveCount(4)
  await expect(reveal).toBeVisible()
  await expect(reveal.locator('.mono')).toHaveText('You said: half a second')
  await expect(said).toHaveText(
    'Four quarter notes at 120 beats per minute: 0.5 seconds each.',
  )
})

test("each step's controls do what they say: Halve and Join on the chosen beat, Tempo and Play both, Count, a beat silenced from its pad and the rest strip's example, and Dot, Tie and Clef (WEB-SPEC, Toys 1)", async ({
  page,
}) => {
  // Arrange: every move lands at once, so a press meets the state it changed
  test.setTimeout(60_000)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await openStep(page, '/learn/17', 1)
  const said = page.locator('#toyRhythm [data-rb-said]')
  const fig = page.locator('#toyRhythm [data-rb]')
  const pad = (beat: number): Locator =>
    page.locator(`#toyRhythm .rb-padbtn[data-beat="${String(beat)}"]`)

  // Act, Assert: Step 1 halves the chosen beat and joins it back, then
  // joins beats 1 and 2, whose half note has no half to join
  await pad(1).click()
  await expect(pad(1)).toHaveAttribute('aria-pressed', 'true')
  await showing(page, '[data-rb-halve]').click()
  await expect(said).toHaveText('Beat 2 halved: two eighth notes')
  await showing(page, '[data-rb-join]').click()
  await expect(said).toHaveText('Beat 2 joined: a quarter note')
  await pad(0).click()
  await showing(page, '[data-rb-join]').click()
  await expect(said).toHaveText('Beats 1 and 2 joined: a half note')
  await expect(showing(page, '[data-rb-join]')).toHaveAttribute(
    'aria-disabled',
    'true',
  )
  await expect(page.locator('#rbHint')).toHaveText(
    'Join needs a half note in the other half of the bar too.',
  )

  // Step 2 plays at the slider's tempo, then plays both rows
  await nextStep(page, 2)
  const tempo = page.locator('#tempoBar')
  await tempo.fill('120')
  await expect(page.locator('label[for="tempoBar"]')).toHaveText(
    'Tempo 120 BPM',
  )
  await expect(tempo).toHaveAttribute('aria-valuetext', '120 beats per minute')
  await showing(page, '[data-rb-play]').click()
  await expect(page.locator('#toyRhythm .rb-read:not(.is-hidden)')).toHaveText(
    ['0.5 s', '0.5 s', '1 s'],
    { timeout: 10_000 },
  )
  await showing(page, '[data-rb-both]').click()
  await expect(fig).toHaveAttribute(
    'aria-label',
    /^Two rows on one time axis, on one line: /,
  )

  // Step 3 counts under its notes
  await nextStep(page, 3)
  const count = showing(page, '[data-rb-count]')
  await count.click()
  await showing(page, '[data-rb-play]').click()
  await expect(count).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('#toyRhythm .rb-count')).not.toHaveCount(0)

  // Step 4 silences a beat from its pad, and the rest strip plays an example
  await nextStep(page, 4)
  await pad(2).click()
  await expect(said).toHaveText('Beat 3 silent: a quarter rest')
  await expect(fig).toHaveAttribute(
    'aria-label',
    'One bar of 4/4: two quarter notes, a quarter rest and a quarter note, on one line',
  )
  await showing(page, '[data-rb-rest="2"]').click()
  await expect(fig).toHaveAttribute(
    'aria-label',
    'Two bars of 4/4: two quarter notes and a half rest, then a quarter note, on one line',
  )
  await expect(page.locator('#toyRhythm [data-rb-pads]')).toBeHidden()

  // Step 5 dots and ties its two bars, and Clef moves them to the treble
  await nextStep(page, 5)
  await expect(fig).toHaveAttribute('aria-label', /, on the bass staff$/)
  await showing(page, '[data-rb-dot]').click()
  await expect(said).toHaveText(
    'Dots added: a dotted half note, then a dotted quarter and an eighth',
  )
  await showing(page, '[data-rb-tie]').click()
  await expect(said).toHaveText('Tie added across the bar line')
  await showing(page, '[data-rb-clef="treble"]').click()
  await expect(said).toHaveText('The treble staff: every note on A4')
  await expect(fig).toHaveAttribute(
    'aria-label',
    /tied across the bar line, on the treble staff$/,
  )
  for (const b of ['[data-rb-dot]', '[data-rb-tie]', '[data-rb-clef="treble"]'])
    await expect(showing(page, b)).toHaveAttribute('aria-pressed', 'true')
})

test('the take, tapped by Space on every beat and then on each written note, reads "All 9 notes got a tap, and no tap fell between them." and never asks for the microphone (WEB-SPEC, Toys 7, part 1)', async ({
  page,
}) => {
  // Arrange: Space pressed on the pad on a schedule from Start's own click,
  // a 0.6 s lead, then beat by beat at 60 BPM: the bars of every beat
  // (beats 4 to 11), then the written bars' nine notes from beat 12, each
  // 100 ms late, a steady delay the lining-up takes out (FACTS 35, 36)
  test.setTimeout(60_000)
  const asks = await spyOnMicrophone(page)
  await page.goto('/learn/17#sing')
  const status = page.locator('#takeStatus')
  await expect(status).toHaveText("Press Start when you're ready to tap.")
  await page.locator('[data-take-start]').evaluate((start) => {
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
    start.addEventListener(
      'click',
      () => {
        const t0 = performance.now()
        const onsets = [0, 1, 2, 4, 4.5, 5, 6, 6.5, 7]
        const beats = [4, 5, 6, 7, 8, 9, 10, 11, ...onsets.map((o) => 12 + o)]
        for (const b of beats)
          window.setTimeout(
            press,
            t0 + 600 + b * 1000 + 100 - performance.now(),
          )
      },
      { once: true, capture: true },
    )
  })

  // Act
  await page.locator('[data-take-start]').click()

  // Assert: the take walks its parts, then says its line over nine gold ticks
  await expect(status).toHaveText('Counting in: one bar.')
  await expect(status).toHaveText('Tap every beat: bar 1 of 2', {
    timeout: 6_000,
  })
  await expect(status).toHaveText('Now the written bars: bar 1 of 2', {
    timeout: 10_000,
  })
  await expect(status).toHaveText(
    'All 9 notes got a tap, and no tap fell between them.',
    { timeout: 15_000 },
  )
  await expect(page.locator('[data-take-bars] .rb-tick.is-met')).toHaveCount(9)
  await expect(page.locator('[data-take-hear]')).toBeVisible()
  expect(await asks()).toBe(0)
})

test("the page asks for no microphone, sends nothing away and keeps only its own keys, through the cold open, a word, the steps, the take, Merc's bars and the guide, and the quizzes", async ({
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
  await page.goto('/learn/17')

  // Act: the hero's play, a word, Step 1's Play, a take started and
  // stopped, Merc's bars heard and the guide started, and an answer in each quiz
  await page.locator('#heroPlay60').click()
  await page.locator('[data-word-play="rest"]').click()
  await openStep(page, '/learn/17', 1)
  await showing(page, '[data-rb-play]').click()
  const start = page.locator('[data-take-start]')
  await start.click()
  await expect(page.locator('#takeStatus')).toHaveText('Counting in: one bar.')
  await start.click()
  await expect(page.locator('#takeStatus')).toHaveText(
    'Stopped. Press Start to tap again.',
  )
  await page.locator('[data-comfort="sing"]').click()
  await page.locator('[data-voice="lower"]').click()
  await page.locator('[data-line-play]').click()
  const guide = page.locator('[data-guide-start]')
  await expect(guide).toBeVisible({ timeout: 20_000 })
  await expect(guide).toBeEnabled({ timeout: 20_000 })
  await guide.click()
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
        !/^fyp-l17-(seed|quiz-v1|recall-seed|recall-v1)$/.test(k) &&
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

    test('every target of the hero, Steps 1 to 5, the checkpoint and free play is at least 44 px square, none overlapping another, and nothing scrolls sideways (WEB-SPEC, Tests, end-to-end 3)', async ({
      page,
    }) => {
      // Arrange
      test.setTimeout(90_000)
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.goto('/learn/17')
      const counts: Record<string, number> = {}

      // Act, Assert
      counts.hero = await expectTargets(page, '.l17-hero', 'The hero')
      await openStep(page, '/learn/17', 1)
      for (let n = 1; n <= 5; n++) {
        if (n > 1) await nextStep(page, n)
        counts[`step ${String(n)}`] = await expectTargets(
          page,
          '#toyRhythm',
          `Step ${String(n)}`,
        )
        await expect(page.locator('#stepNow')).toHaveText(String(n))
      }
      counts.checkpoint = await expectTargets(
        page,
        '#singCard',
        'The checkpoint',
      )
      counts.free = await expectTargets(page, '#freePlay', 'Free play')
      // the chip, the gate, two plays and two choices; each step's row, its
      // pads and its pitch-line switch; Start, the pad and the comfort
      // check; and free play's two figures with their controls
      expect(counts).toEqual({
        hero: 6,
        'step 1': 10,
        'step 2': 4,
        'step 3': 3,
        'step 4': 12,
        'step 5': 6,
        checkpoint: 4,
        free: 17,
      })
    })
  })
}
