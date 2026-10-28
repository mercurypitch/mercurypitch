// ============================================================
// Lesson 12 loads at /learn/12 as its own document, and boots
// ============================================================
//
// A draft until Lesson 10's page is live and the vocal coach has looked at
// the sung checkpoint. Every build carries its document, and the e2e bundle
// shows drafts (`build:e2e` sets VITE_DRAFT_LESSONS=1); on mercurypitch.com
// the site worker answers its address with the 404 page until the admin
// console publishes it (src/lesson-gate.ts). Like every lesson it must load
// as itself, never as the 404 page or the studio's cached app shell, and
// its module must boot. Then WEB-SPEC's first end-to-end check (Tests, End
// to end 1), at a phone's size and a desktop's: no AudioContext before the
// first tap, and nothing plays before a play button; and its fourteenth: a
// visitor with the studio installed still gets the lesson, not the shell.
// Its fourth, the ring of rooms, step by step as each step is wired: Step
// 2's key switch relabels the chips to G major's, vii° reading F♯ A C, and
// C puts them back. With it, the stage by keyboard: Tab meets the ring's
// slider, the step's own controls, then the chips from I to vii°, in the
// order they stand on screen; a chip plays by keyboard and the summary
// counts its room; the key switch toggles `aria-pressed` and says the key
// once in the polite line; and at 390 x 844 every target is at least 44
// px square with none overlapping. Each toy's own checks join it as that
// toy is wired.

import type { Locator, Page } from '@playwright/test'
import { expect, test } from './helpers/lesson-page'
import { expectTargets, liveSaid, openStep, tabsWithin, watchLive, } from './helpers/lesson-qa'

// 60 characters at most (src/tests/lesson-pages.test.ts)
const TITLE = 'The four-chord song: how chords work | MercuryPitch'

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

// WEB-SPEC, End to end 1, at a phone's size and a desktop's
for (const viewport of [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
]) {
  test.describe(`the page at ${viewport.width} x ${viewport.height}`, () => {
    test.use({ viewport })

    test('a hard load of /learn/12 answers 200 with the lesson @smoke', async ({
      page,
    }) => {
      // Act
      const response = await page.goto('/learn/12')

      // Assert
      expect(response?.status()).toBe(200)
      await expect(page).toHaveTitle(TITLE)
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(
        'How can two songs share the same four chords and still sound different?',
      )
      await expect(page.locator('#root')).toHaveCount(0)
      // a written lesson: no film, so no Watch section
      await expect(page.locator('#watch')).toHaveCount(0)
    })

    test('the page boots with no AudioContext until the first tap, the deck and the map drawn @smoke', async ({
      page,
    }) => {
      // Arrange
      const errors: string[] = []
      page.on('pageerror', (e) => errors.push(e.message))
      await watchSound(page)
      // the page booted: the map drawn, and the deck on Step 1 (read before the
      // scroll, which the steps follow)
      await page.goto('/learn/12')
      await expect(page.locator('#exList .ex-row')).toHaveCount(15)
      await expect(page.locator('#stepNow')).toHaveText('1')
      await expect(page.locator('#deckNextLabel')).toHaveText(
        'Next: How do Roman numerals name them?',
      )

      // Act: the whole page read, top to bottom, with no tap
      for (const id of ['#predict', '#words', '#lesson', '#sing', '#wrap'])
        await page.locator(id).scrollIntoViewIfNeeded()

      // Assert
      expect(await heard(page)).toEqual({ contexts: 0, sources: 0 })
      await expect(page.locator('.lm-btn')).toBeVisible()
      // the Wrap's card names the lesson after this one, from the season
      await expect(page.locator('#wrap a.next-card .eyebrow')).toContainText(
        'Next lesson 13',
      )
      expect(errors).toEqual([])
    })

    test("nothing plays but the sound switch's own chime until a play button is pressed", async ({
      page,
    }) => {
      // Arrange: sound on from the gate, which confirms it with its two soft notes
      await watchSound(page)
      await page.goto('/learn/12')
      await page.locator('#gateBtn').click()
      await expect(page.locator('#soundSwitch')).toHaveAttribute(
        'aria-pressed',
        'true',
      )
      const after = await heard(page)

      // Act: a choice, the steps and the sections, none of them a play button
      await page.locator('#predict [data-choice="most"]').click()
      await page.getByRole('button', { name: 'Next step', exact: true }).click()
      await expect(page.locator('#stepNow')).toHaveText('2')
      for (const id of ['#words', '#sing', '#wrap', '#explorer'])
        await page.locator(id).scrollIntoViewIfNeeded()

      // Assert
      expect(after.contexts).toBe(1)
      expect(await heard(page)).toEqual(after)
    })
  })
}

// WEB-SPEC, End to end 14, as Lesson 3's spec checks its own
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
  await page.goto('/learn/12')

  // Assert
  await expect(page).toHaveTitle(TITLE)
  await expect(page.locator('#root')).toHaveCount(0)
})

/** The steps' ring of rooms. */
const TOY = '#toyRooms'
/** The ring's slider, as Tab meets it first. */
const SLIDER = 'The ring of rooms: pick a note, C4 to B4'

/** The seven chips' two lines, I to vii°: their top line and their notes. */
const chipLines = (page: Page): Promise<string[][]> =>
  page
    .locator(`${TOY} [data-chord-strip] button`)
    .evaluateAll((chips) =>
      chips.map((c) =>
        ['top', 'notes'].map(
          (part) =>
            c.querySelector(`[data-chip-${part}]`)?.textContent?.trim() ?? '',
        ),
      ),
    )

/** The key switch's button for `key`. */
const keyButton = (page: Page, key: 'C' | 'G'): Locator =>
  page.locator(`${TOY} [data-rooms-key] [data-key="${key}"]`)

/** The tops of the figure, the step's row and the chips, and the figure's and row's feet, px. */
const stageRows = (
  page: Page,
): Promise<{ figure: number[]; row: number[]; strip: number[] }> =>
  page.locator(TOY).evaluate((toy) => {
    const box = (sel: string): number[] => {
      const r = toy.querySelector(sel)?.getBoundingClientRect()
      return r === undefined ? [] : [r.top, r.bottom]
    }
    return {
      figure: box('[data-rooms-viz]'),
      row: box('.rooms-row'),
      strip: box('[data-chord-strip]'),
    }
  })

// WEB-SPEC, End to end 4, Step 2's half, at a phone's size and a desktop's
for (const viewport of [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
]) {
  test.describe(`the ring of rooms at ${viewport.width} x ${viewport.height}`, () => {
    test.use({ viewport })

    test('Step 2: G relabels the chips to G major, vii° reading F♯ A C, and C restores them', async ({
      page,
    }) => {
      // Arrange
      await openStep(page, '/learn/12', 2)
      const vii = page.locator(`${TOY} [data-chord-strip] [data-chip="6"]`)
      const before = await chipLines(page)

      // Act
      await keyButton(page, 'G').click()
      const inG = await chipLines(page)
      const nameInG = await vii.getAttribute('aria-label')
      // a press while the rooms still turn does nothing: C once they land
      await expect(async () => {
        await keyButton(page, 'C').click()
        await expect(keyButton(page, 'C')).toHaveAttribute(
          'aria-pressed',
          'true',
          { timeout: 100 },
        )
      }).toPass()

      // Assert
      expect(inG).toEqual([
        ['I', 'G B D'],
        ['ii', 'A C E'],
        ['iii', 'B D F♯'],
        ['IV', 'C E G'],
        ['V', 'D F♯ A'],
        ['vi', 'E G B'],
        ['vii°', 'F♯ A C'],
      ])
      expect(nameInG).toBe('Chord seven, F sharp diminished: F sharp, A, C')
      expect(await chipLines(page)).toEqual(before)
      expect(before[6]).toEqual(['vii°', 'B D F'])
      await expect(vii).toHaveAttribute(
        'aria-label',
        'Chord seven, B diminished: B, D, F',
      )
    })

    test("Step 1: Tab meets the ring's slider, then the chips from I to vii°, and a chip plays by keyboard", async ({
      page,
    }) => {
      // Arrange
      await openStep(page, '/learn/12', 1)

      // Act
      const met = await tabsWithin(page, `${TOY} [data-fig-label]`, TOY)
      await page.locator(`${TOY} [data-chip="3"]`).focus()
      await page.keyboard.press('Enter')

      // Assert
      expect(met).toEqual([
        SLIDER,
        'The chord on do: C, E, G',
        'The chord on re: D, F, A',
        'The chord on mi: E, G, B',
        'The chord on fa: F, A, C',
        'The chord on so: G, B, D',
        'The chord on la: A, C, E',
        'The chord on ti: B, D, F',
      ])
      await expect(page.locator(`${TOY} [data-rooms-summary]`)).toHaveText(
        "C major's seven chords, one lit: four.",
      )
    })

    test('Step 2: Tab meets the slider, the key switch, then the chips, in the order they stand; the switch toggles aria-pressed and says the key once', async ({
      page,
    }) => {
      // Arrange
      await watchLive(page)
      await openStep(page, '/learn/12', 2)
      const [c, g] = [keyButton(page, 'C'), keyButton(page, 'G')]

      // Act
      const met = await tabsWithin(page, `${TOY} [data-fig-label]`, TOY)
      const rows = await stageRows(page)
      await g.focus()
      await page.keyboard.press('Space')

      // Assert: the figure, its row, then the chips, top to bottom
      expect(met).toEqual([
        SLIDER,
        'C',
        'G',
        'Chord one, C major: C, E, G',
        'Chord two, D minor: D, F, A',
        'Chord three, E minor: E, G, B',
        'Chord four, F major: F, A, C',
        'Chord five, G major: G, B, D',
        'Chord six, A minor: A, C, E',
        'Chord seven, B diminished: B, D, F',
      ])
      expect(rows.row[0]).toBeGreaterThanOrEqual(rows.figure[1])
      expect(rows.strip[0]).toBeGreaterThanOrEqual(rows.row[1])
      await expect(g).toHaveAttribute('aria-pressed', 'true')
      await expect(c).toHaveAttribute('aria-pressed', 'false')
      await expect
        .poll(async () =>
          (await liveSaid(page))
            .map((x) => x.text)
            .filter((t) => t.includes('every chord turned')),
        )
        .toEqual(['G major: every chord turned round the ring.'])
    })
  })
}

// WEB-SPEC, End to end 4's targets, at 390 x 844
test.describe("the ring of rooms' targets at 390 x 844", () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('every target of Steps 1 and 2 is at least 44 px square, and none overlaps another, in C and in G', async ({
    page,
  }) => {
    // Arrange
    await openStep(page, '/learn/12', 1)

    // Act, Assert
    expect(await expectTargets(page, TOY, 'Step 1')).toBe(8)
    await page.getByRole('button', { name: 'Next step', exact: true }).click()
    await expect(page.locator('#stepNow')).toHaveText('2')
    expect(await expectTargets(page, TOY, 'Step 2')).toBe(10)
    await keyButton(page, 'G').click()
    expect(await expectTargets(page, TOY, 'Step 2 in G')).toBe(10)
  })
})
