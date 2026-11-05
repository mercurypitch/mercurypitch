// ============================================================
// Lesson 15 loads at /learn/15 as its own document, and boots
// ============================================================
//
// Season 2's first page, a draft until the vocal coach has looked at Sing
// it. Every build carries its document, and the e2e bundle shows drafts
// (`build:e2e` sets VITE_DRAFT_LESSONS=1); on mercurypitch.com the site
// worker answers its address with the 404 page until the admin console
// publishes it (src/lesson-gate.ts). Like every lesson it must load as
// itself, never as the 404 page or the studio's cached app shell, and its
// module must boot: at a phone's size and a desktop's, no AudioContext
// before the first tap, and nothing plays before a play button; and a
// visitor with the studio installed still gets the lesson, not the shell.
// It carries Season 2, so its masthead and its map are Season 2's, and it
// draws no staff for show (WEB-SPEC, Tests 16). The staff toy on the
// stage says each place it plays, and is big enough to tap on a phone: its
// places 13 px apart or more, and Step 5's keys 44 px wide (FACTS 71).

import type { Page } from '@playwright/test'
import { expect, test } from './helpers/lesson-page'

// 60 characters at most (src/tests/lesson-pages.test.ts)
const TITLE = 'How to read the staff: clefs and middle C | MercuryPitch'

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

    test('a hard load of /learn/15 answers 200 with the lesson @smoke', async ({
      page,
    }) => {
      // Act
      const response = await page.goto('/learn/15')

      // Assert
      expect(response?.status()).toBe(200)
      await expect(page).toHaveTitle(TITLE)
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(
        'A piano has 88 keys. How can five lines write down every one of them?',
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
      await page.goto('/learn/15')
      await expect(
        page.locator('.ex-seasons [data-season="2"]'),
      ).toHaveAttribute('aria-pressed', 'true')
      await expect(page.locator('#stepNow')).toHaveText('1')
      await expect(page.locator('#deckNextLabel')).toHaveText(
        'Next: Is every step up the staff the same size?',
      )

      // Act: the whole page read, top to bottom, with no tap
      for (const id of ['#predict', '#words', '#lesson', '#sing', '#wrap'])
        await page.locator(id).scrollIntoViewIfNeeded()

      // Assert
      expect(await heard(page)).toEqual({ contexts: 0, sources: 0 })
      await expect(page.locator('.lm-btn')).toBeVisible()
      // the Wrap's card names the lesson after this one, from Season 2
      await expect(page.locator('#wrap a.next-card .eyebrow')).toContainText(
        'Next lesson 16',
      )
      expect(errors).toEqual([])
    })

    test("nothing plays but the sound switch's own chime until a play button is pressed", async ({
      page,
    }) => {
      // Arrange: sound on from the gate, which confirms it with its two soft notes
      await watchSound(page)
      await page.goto('/learn/15')
      await page.locator('#gateBtn').click()
      await expect(page.locator('#soundSwitch')).toHaveAttribute(
        'aria-pressed',
        'true',
      )
      const after = await heard(page)

      // Act: a choice, the steps and the sections, none of them a play button
      await page.locator('#predict [data-choice="nine"]').click()
      await page.getByRole('button', { name: 'Next step', exact: true }).click()
      await expect(page.locator('#stepNow')).toHaveText('2')
      for (const id of ['#words', '#sing', '#wrap', '#explorer'])
        await page.locator(id).scrollIntoViewIfNeeded()

      // Assert
      expect(after.contexts).toBe(1)
      expect(await heard(page)).toEqual(after)
    })

    test('draws no staff for show: no background staff behind the page, and none on a section head (WEB-SPEC, Tests 16)', async ({
      page,
    }) => {
      // Act
      await page.goto('/learn/15')
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

test("a Season 1 page keeps its background staff and its section heads' staves", async ({
  page,
}) => {
  // Act
  await page.goto('/learn/12')
  const background = await page.evaluate(
    () => getComputedStyle(document.body).backgroundImage,
  )

  // Assert: Lesson 15's WEB-SPEC, Look: Season 1 pages keep both
  expect(background).toContain('repeating-linear-gradient')
  await expect(page.locator('.mv-staff').first()).toBeAttached()
})

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
  await page.goto('/learn/15')

  // Assert
  await expect(page).toHaveTitle(TITLE)
  await expect(page.locator('#root')).toHaveCount(0)
})

test('the climb on the five lines folds the pitch line into a staff, then the predict reveals', async ({
  page,
}) => {
  // Arrange: sound on; before a choice the hero draws the pitch line alone
  await page.goto('/learn/15')
  await page.locator('#gateBtn').click()
  const hero = page.locator('#heroStaff [data-hero-svg]')
  await expect(hero.locator('.st-lane')).toHaveCount(18)
  await expect(hero.locator('.st-line, .st-clef')).toHaveCount(0)

  // Act
  await page.locator('#predict [data-choice="nine"]').click()
  await page.locator('[data-play="lines"]').click()

  // Assert: the staff as the climb begins, the reveal once it ends (6.1 s)
  await expect(hero.locator('.st-line')).toHaveCount(5, { timeout: 3000 })
  await expect(hero.locator('.st-clef')).toHaveCount(1)
  await expect(page.locator('#predict .reveal')).toBeVisible({
    timeout: 10_000,
  })
  await expect(page.locator('#predict .reveal .mono')).toHaveText(
    'You said: nine',
  )
})

test.describe('the staff toy on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  /** The staff toy's polite line. */
  const said = (page: Page) => page.locator('#toyStaff [data-staff-said]')

  test('says each place as Step up climbs it, and a tap on a line plays that line', async ({
    page,
  }) => {
    // Arrange
    await page.goto('/learn/15')
    await page.locator('#gateBtn').click()
    const toy = page.locator('#toyStaff')
    await toy.scrollIntoViewIfNeeded()

    // Act
    await toy.getByRole('button', { name: 'Step up' }).click()
    await expect(said(page)).toHaveText('E4, the bottom line')
    await toy.getByRole('button', { name: 'Step up' }).click()
    await expect(said(page)).toHaveText('F4, the bottom space')
    // a tap on the second line, where the drawing put it
    const at = await toy.locator('[data-staff-svg]').evaluate((svg) => {
      const box = svg.getBoundingClientRect()
      const line = svg.querySelectorAll('.st-line')[1]
      return {
        x: box.left + box.width / 2,
        y: box.top + Number(line.getAttribute('y1')),
      }
    })
    await page.mouse.click(at.x, at.y)

    // Assert
    await expect(said(page)).toHaveText('G4, the second line')
  })

  test('draws its places 13 px apart or more, and Step 5 keys 44 px wide', async ({
    page,
  }) => {
    // Arrange
    await page.goto('/learn/15')
    const toy = page.locator('#toyStaff')
    await toy.scrollIntoViewIfNeeded()

    // Act
    const gap = await toy.locator('[data-staff-svg]').evaluate((svg) => {
      const ys = Array.from(svg.querySelectorAll('.st-line'), (l) =>
        Number(l.getAttribute('y1')),
      )
      return (ys[0] - ys[1]) / 2
    })
    await page.goto('/learn/15#step-5')
    await page.locator('#toyStaff').scrollIntoViewIfNeeded()
    await expect(
      page.locator('#toyStaff .st-key.is-white').first(),
    ).toBeAttached()
    const keys = await page
      .locator('#toyStaff .st-key.is-white')
      .evaluateAll((rects) => rects.map((r) => Number(r.getAttribute('width'))))

    // Assert: the strip's window, 7 or 8 white keys, each a 44 px target
    // less the hairline between keys
    expect(gap).toBeGreaterThanOrEqual(13)
    expect(keys.length).toBeGreaterThanOrEqual(7)
    for (const w of keys.filter((k) => k > 20))
      expect(w).toBeGreaterThanOrEqual(42.5)
  })
})

test.describe('free play on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('picks the grand staff, shows its Lower keys and Higher keys, and says each place Step up plays', async ({
    page,
  }) => {
    // Arrange
    await page.goto('/learn/15')
    await page.locator('#gateBtn').click()
    const free = page.locator('#freePlay')
    await free.scrollIntoViewIfNeeded()
    await expect(free.getByRole('button', { name: 'Lower keys' })).toBeHidden()

    // Act
    await free.getByRole('button', { name: 'Grand staff' }).click()
    await free.getByRole('button', { name: 'Step up' }).click()

    // Assert: WEB-SPEC, Toys 1, state 7
    await expect(free.locator('[data-staff-svg]')).toHaveAttribute(
      'aria-label',
      /^Grand staff: /,
    )
    await expect(free.getByRole('button', { name: 'Lower keys' })).toBeVisible()
    await expect(
      free.getByRole('button', { name: 'Higher keys' }),
    ).toBeVisible()
    await expect(free.locator('[data-staff-said]')).toHaveText(
      'G2, the bottom line of the bass staff',
    )
    const keys = await free
      .locator('.st-key.is-white')
      .evaluateAll((rects) => rects.map((r) => Number(r.getAttribute('width'))))
    expect(keys.length).toBeGreaterThanOrEqual(7)
    for (const w of keys.filter((k) => k > 20))
      expect(w).toBeGreaterThanOrEqual(42.5)
  })
})

for (const viewport of [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
]) {
  test(`the tease still draws its clef and five noteheads inside its box at ${String(viewport.width)} px, and no rule over its "?" (WEB-SPEC, Toys 8)`, async ({
    page,
  }) => {
    // Arrange
    await page.setViewportSize(viewport)
    await page.goto('/learn/15')
    const still = page.locator('.l15-tease svg[data-tease-staff]')
    await still.scrollIntoViewIfNeeded()

    // Act: an svg hides what it draws past its box, but the drawing's own
    // box still reaches past it, so a clipped clef shows here
    const inside = await still.evaluate((svg) => {
      const box = svg.getBoundingClientRect()
      const within = (el: Element): boolean => {
        const r = el.getBoundingClientRect()
        return (
          r.left >= box.left - 0.5 &&
          r.right <= box.right + 0.5 &&
          r.top >= box.top - 0.5 &&
          r.bottom <= box.bottom + 0.5
        )
      }
      return {
        clef: Array.from(svg.querySelectorAll('.st-clef'), within),
        heads: Array.from(svg.querySelectorAll('.st-head'), within),
      }
    })
    const rule = await page
      .locator('.l15-tease-q')
      .evaluate((q) => getComputedStyle(q).borderTopStyle)

    // Assert
    expect(inside).toEqual({ clef: [true], heads: Array(5).fill(true) })
    expect(rule).toBe('none')
  })
}

test('one sound at a time: the recall pair stops the climb, the climb stops the pair, and a word stops either (WEB-SPEC, Tests 15)', async ({
  page,
}) => {
  // Arrange: sound on, every play still on the page where it was drawn
  await page.goto('/learn/15')
  await page.locator('#gateBtn').click()
  await expect(page.locator('#recall-qs [data-quiz-pair]')).toBeAttached()

  // Act: each press 150 ms after the one before, by script, so no press
  // scrolls a play off screen (which stops it after 600 ms on its own)
  const lit = await page.evaluate(async () => {
    const CLIMB = '.hero-plays [data-play="climb"]'
    const PAIR = '#recall-qs [data-quiz-pair]'
    const WORD = '#words [data-word-play="staff"]'
    const on = (s: string): boolean =>
      document.querySelector(s)?.classList.contains('is-on') ?? false
    const press = async (s: string) => {
      document.querySelector<HTMLElement>(s)?.click()
      await new Promise((r) => window.setTimeout(r, 150))
      return { climb: on(CLIMB), pair: on(PAIR), word: on(WORD) }
    }
    return [
      await press(CLIMB),
      await press(PAIR),
      await press(CLIMB),
      await press(WORD),
      await press(PAIR),
      await press(WORD),
    ]
  })

  // Assert: only the newest is lit, every time
  expect(lit).toEqual([
    { climb: true, pair: false, word: false },
    { climb: false, pair: true, word: false },
    { climb: true, pair: false, word: false },
    { climb: false, pair: false, word: true },
    { climb: false, pair: true, word: false },
    { climb: false, pair: false, word: true },
  ])
})
