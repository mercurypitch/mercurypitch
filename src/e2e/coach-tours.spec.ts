// ============================================================
// Merc's tours, walked stop by stop under the walk's two rules
// ============================================================
//
// scripts/walk-tours.mjs walks the Guide's spotlight tours. Merc's run on the
// coach instead, so they are walked here, on a phone and a wide screen: the
// Sing tour from the Sing tab's first-visit chip, and Karaoke Night's from
// its page's own. At every stop:
//
// - the bubble is inside the window;
// - a stop that names a target on this screen finds it laid out, and the
//   coach rings it exactly when it fits (targetFits: at most 70% of the
//   window's height), around the target itself. Every target fits but the
//   ones named in OVERSIZE, which the coach stands clear of instead;
// - a consent bar put up beside the stop stays on top (barOnTop): each of
//   its buttons is what lies under its own middle.
//
// The walk moves on as a visitor who only reads would: Skip this step on a
// step that waits for the singer, Next on the others, Done at the end. The
// exception is Karaoke Night's first stop, which the walk does (Sing this
// song): its next stop's mic is drawn only once a song is on stage. Karaoke
// Night's wait through the song is quiet: nothing of the coach is drawn and
// it is not counted, so the walk checks that and plays the singer's part by
// the event the wait listens for (the score card closing). The rules are
// scripts/tour-rules.mjs's, which the Guide's walk applies too.
// Merc stays a still here (no GPU): this file reads layout, and
// showcase.spec.ts draws him live.
//
// Done leaves focus on the page's main heading the singer can see, named
// per tour and screen.
//
// Then the Sing tour's note: a tap on Play the note shows it playing (the
// button names it and is lit, Merc sings, a line says so), and once it has
// played a line says how to hear it, so a muted speaker still shows it. The
// line comes under the button, which does not move from where it was tapped.
//
// On a small phone (320x568, touch) the bubble is capped at 45dvh, and the
// Sing tour's words outgrow it: at the note stop once the note has played,
// at the last stop, and in Show me more. The words scroll there, their foot
// faded, and the buttons, the count and End tour stay whole inside the
// bubble and on top at their middles. Play the note stays whole in view
// with the words unscrolled: only its line goes under the fold.
//
// Last, the tab chip in a room that fills the window: on Piano at 1440x900
// the chip floats over the room's free corner (tour-chip-floats.spec.ts
// holds every tab to that), so its keyboard stays on screen, the content
// area does not scroll, and the chip covers no control.

import type { Locator, Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { barOnTop, probeConsentBar, targetFits, } from '../../scripts/tour-rules.mjs'
import { localKaraokeDemo } from './helpers/karaoke-demo'

// Route the demo's audio in the page itself, not behind a worker's back.
test.use({ serviceWorkers: 'block' })

const version = (
  JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'),
  ) as { version: string }
).version

const SCREENS = [
  { name: 'phone', width: 390, height: 844, phone: true },
  { name: 'wide', width: 1440, height: 900, phone: false },
] as const
type Screen = (typeof SCREENS)[number]

interface Stop {
  /** What the stop rings on this screen, as the tour names it; none stands free. */
  target?: string
  /** The walk does the step (taps the target) rather than skipping it. */
  doIt?: boolean
  /** A quiet wait: nothing drawn, not counted; the walk sends this event. */
  quiet?: string
}

interface Tour {
  name: string
  open: (page: Page) => Promise<void>
  /** The chip's line, which starts the tour. */
  chip: string
  stops: (screen: Screen) => readonly Stop[]
  /** The heading focus lands on once Done has closed the tour (start.ts). */
  focus: (screen: Screen) => string
}

const STAGE_LINE = '[data-stage-canvas], #canvas-container'

const SING: Tour = {
  name: 'sing',
  open: async (page) => {
    await page.addInitScript(() => {
      localStorage.setItem('pitchperfect_active_tab', 'singing')
    })
    await page.goto('/#/singing')
  },
  chip: 'Merc can show you around, 30 s',
  // src/features/practice/sing-tour.ts
  stops: (screen) => [
    {
      target: screen.phone
        ? '[data-tour="singing-transport"]'
        : '[data-tour="sing.mic"]',
    },
    { target: STAGE_LINE },
    { target: STAGE_LINE },
    {
      target: screen.phone
        ? '[data-tour="mobile-tabbar-more"]'
        : '[data-tab-group="you"]',
    },
  ],
  focus: () => 'MercuryPitch',
}

const KARAOKE: Tour = {
  name: 'karaoke-night',
  open: async (page) => {
    await localKaraokeDemo(page)
    await page.goto('/karaoke-night')
  },
  chip: 'Sing the demo with Merc',
  // src/features/karaoke-night/karaoke-tour.ts
  stops: (screen) => [
    { target: '[data-tour="karaoke.demo"]', doIt: true },
    {
      target: screen.phone
        ? '[data-tour="karaoke.mic"]'
        : '[data-tour="mixer.mic"]',
    },
    // The song: nothing on screen until its score card has closed.
    { quiet: 'score-closed' },
    // The phone stage covers the page by then: the stop rings its Back.
    {
      target: screen.phone
        ? '[data-tour="karaoke.stage-back"]'
        : '[data-tour="karaoke.own-song"]',
    },
  ],
  // The song on stage, with its artist: the phone stage's own heading (not
  // the rail card's "Goodbye to Spring" under the stage), or the mixer's.
  focus: () => 'Goodbye to Spring · Josh Woodward',
}

/**
 * Stops whose target is taller than 70% of the window, as `tour:stop:screen`
 * (stops count from 1). The coach rings none of them and stands its bubble
 * clear; each is a target to point at something smaller.
 */
const OVERSIZE = new Set([
  // The Sing stage's canvas: 704 px of 900 on a wide screen.
  'sing:2:wide',
  'sing:3:wide',
])

interface Box {
  x: number
  y: number
  width: number
  height: number
}

const inside = (inner: Box, outer: Box, slack = 1): boolean =>
  inner.x >= outer.x - slack &&
  inner.y >= outer.y - slack &&
  inner.x + inner.width <= outer.x + outer.width + slack &&
  inner.y + inner.height <= outer.y + outer.height + slack

/** The box once it has stopped moving: two reads in a row agree. */
async function settledBox(locator: Locator): Promise<Box | null> {
  let previous = ''
  await expect
    .poll(
      async () => {
        const now = JSON.stringify(await locator.boundingBox())
        const same = now === previous
        previous = now
        return same
      },
      { intervals: [150] },
    )
    .toBe(true)
  return locator.boundingBox()
}

/** The target as the coach finds it: the first match laid out, outside anything inert. */
async function targetBox(page: Page, selector: string): Promise<Box | null> {
  return page.evaluate((list) => {
    for (const el of document.querySelectorAll(list)) {
      if (el.closest('[inert]') !== null) continue
      const box = el.getBoundingClientRect()
      if (box.width > 0 && box.height > 0) {
        return { x: box.x, y: box.y, width: box.width, height: box.height }
      }
    }
    return null
  }, selector)
}

async function seedFirstVisit(page: Page): Promise<void> {
  await page.addInitScript((v) => {
    ;(window as Window & { E2E_TEST_MODE?: boolean }).E2E_TEST_MODE = true
    localStorage.setItem('pitchperfect_welcome_version', v)
    localStorage.setItem('pitchperfect_onboarding_done', '1')
    localStorage.setItem('pitchperfect_focus_mode', 'false')
    localStorage.setItem('pitchperfect_survey_seen', '1')
  }, version)
}

for (const tour of [SING, KARAOKE]) {
  for (const screen of SCREENS) {
    test(`${tour.name}: every stop of Merc's tour keeps the walk's rules, at ${screen.width}x${screen.height} @smoke`, async ({
      page,
    }) => {
      test.setTimeout(90_000)
      const errors: string[] = []
      page.on('pageerror', (error) => errors.push(error.message))
      await page.setViewportSize({ width: screen.width, height: screen.height })
      await seedFirstVisit(page)
      await tour.open(page)

      // A first visit: the chip offers the tour.
      const chip = page.getByTestId('tour-chip')
      await expect(chip).toBeVisible({ timeout: 20_000 })
      await chip.getByRole('button', { name: tour.chip }).click()

      const bubble = page.getByTestId('coach-bubble')
      const ring = page.getByTestId('coach-ring')
      const stops = tour.stops(screen)
      const counted = stops.filter((stop) => stop.quiet === undefined).length
      let n = 0
      for (const stop of stops) {
        if (stop.quiet !== undefined) {
          const at = `${tour.name}:quiet after ${n}:${screen.name}`
          await expect(bubble, `${at}: a bubble`).toHaveCount(0)
          await expect(ring, `${at}: a ring`).toHaveCount(0)
          await expect(
            page.getByTestId('coach-layer').locator('*'),
            `${at}: something drawn`,
          ).toHaveCount(0)
          await page.evaluate((detail) => {
            window.dispatchEvent(new CustomEvent('mp:coach', { detail }))
          }, stop.quiet)
          continue
        }
        n += 1
        const at = `${tour.name}:${n}:${screen.name}`
        await expect(bubble).toContainText(`${n} of ${counted}`, {
          timeout: 15_000,
        })
        // Where the bubble stands for this stop, once it has got there.
        const shown = await settledBox(bubble)
        expect(shown, `${at}: no bubble`).not.toBeNull()
        if (shown !== null) {
          const frame = {
            x: 0,
            y: 0,
            width: screen.width,
            height: screen.height,
          }
          expect(
            inside(shown, frame),
            `${at}: bubble ${JSON.stringify(shown)}`,
          ).toBe(true)
        }

        if (stop.target === undefined) {
          await expect(ring, `${at}: a free stop rings nothing`).toHaveCount(0)
        } else {
          const target = await targetBox(page, stop.target)
          expect(target, `${at}: ${stop.target} is not laid out`).not.toBeNull()
          if (target !== null) {
            const fits = targetFits(target, screen)
            const why = `${at}: target ${Math.round(target.height)} px of ${screen.height}`
            expect(fits || OVERSIZE.has(at), `${why}, over 70%`).toBe(true)
            expect(
              fits && OVERSIZE.has(at),
              `${why} fits now: drop it from OVERSIZE`,
            ).toBe(false)
            if (fits) {
              await expect(ring, why).toBeVisible()
              // The ring follows its target (the coach looks again every
              // 300 ms), so it is read until it holds it.
              await expect
                .poll(
                  async () => {
                    const held = await ring.boundingBox()
                    const now = await targetBox(page, stop.target ?? '')
                    return held !== null && now !== null && inside(now, held)
                  },
                  { message: `${why}: the ring misses it` },
                )
                .toBe(true)
            } else {
              await expect(ring, `${why}: rung anyway`).toHaveCount(0)
            }
          }
        }

        // A consent bar stays on top of whatever the stop puts up.
        expect(
          barOnTop(await page.evaluate(probeConsentBar)),
          `${at}: the bar is covered`,
        ).toBe(true)

        if (stop.doIt === true && stop.target !== undefined) {
          await page.locator(stop.target).first().click()
          continue
        }
        await bubble
          .getByRole('button', { name: /^(Skip this step|Next|Done)$/ })
          .click()
      }

      // Done leaves nothing behind, and the chip does not come back.
      await expect(page.locator('#coach-root')).toHaveCount(0)
      await expect(chip).toHaveCount(0)
      // Focus comes back to the page: the chip that had it has gone, so to
      // the page's main heading the singer can see (start.ts), on top at its
      // own middle.
      await expect
        .poll(() =>
          page.evaluate(() => {
            const el = document.activeElement
            if (!(el instanceof HTMLElement)) return null
            if (!el.matches('h1, h2, h3, [role="heading"]')) return null
            const r = el.getBoundingClientRect()
            const top = document.elementFromPoint(
              r.left + r.width / 2,
              r.top + r.height / 2,
            )
            return {
              text: (el.textContent ?? '').replace(/\s+/g, ' ').trim(),
              onTop: top !== null && el.contains(top),
            }
          }),
        )
        .toEqual({ text: tour.focus(screen), onTop: true })
      expect(errors).toEqual([])
    })
  }
}

test("the Sing tour's Play the note shows the note playing after a tap, at 1440x900", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await seedFirstVisit(page)
  await SING.open(page)
  const chip = page.getByTestId('tour-chip')
  await expect(chip).toBeVisible({ timeout: 20_000 })
  await chip.getByRole('button', { name: SING.chip }).click()
  const bubble = page.getByTestId('coach-bubble')
  await expect(bubble).toContainText('1 of 4')
  await bubble.getByRole('button', { name: 'Skip this step' }).click()
  await expect(bubble).toContainText('2 of 4')

  // Both labels stay in the button, so this finds it playing or at rest.
  const tone = bubble.locator('button').filter({ hasText: 'Play the note' })
  const tapped = await settledBox(tone)
  await tone.click()

  const line = bubble.getByTestId('coach-tone-line')
  await expect(
    bubble.getByRole('button', { name: 'Playing A3' }),
  ).toHaveAttribute('data-playing', '')
  await expect(bubble).toHaveAttribute('data-pose', 'sing')
  await expect(line).toHaveText('Playing A3 now.')
  // and back at rest once it has played, with how to hear it
  await expect(
    bubble.getByRole('button', { name: 'Play the note' }),
  ).not.toHaveAttribute('data-playing')
  await expect(bubble).toHaveAttribute('data-pose', 'listen')
  await expect(line).toContainText('Heard nothing?')
  // The line came under the button, which has not moved from the tap.
  const rest = await settledBox(tone)
  const under = await line.boundingBox()
  expect(Math.abs((rest?.y ?? 0) - (tapped?.y ?? Infinity))).toBeLessThan(1)
  expect(
    rest !== null && under !== null && under.y >= rest.y + rest.height,
  ).toBe(true)
})

/**
 * What keeps the bubble's controls from a finger: each named button, End
 * tour and the count, not whole inside the bubble, or not what lies under
 * its own middle. Empty when every one is in view and on top.
 */
async function controlsOutOfView(
  page: Page,
  names: readonly string[],
): Promise<string[]> {
  return page.evaluate((wanted) => {
    const bubble = document.querySelector('[data-testid="coach-bubble"]')
    if (bubble === null) return ['no bubble']
    const frame = bubble.getBoundingClientRect()
    const nameOf = (el: Element): string =>
      (el.getAttribute('aria-label') ?? el.textContent ?? '').trim()
    const count = [...bubble.querySelectorAll('span')].find((el) =>
      /^\d+ of \d+$/.test((el.textContent ?? '').trim()),
    )
    const found: [string, Element | undefined][] = [
      ...wanted.map((name): [string, Element | undefined] => [
        name,
        [...bubble.querySelectorAll('button')].find(
          (el) => nameOf(el) === name,
        ),
      ]),
      ['the count', count],
    ]
    const problems: string[] = []
    for (const [name, el] of found) {
      if (el === undefined) {
        problems.push(`${name}: not there`)
        continue
      }
      const r = el.getBoundingClientRect()
      if (
        r.top < frame.top - 0.5 ||
        r.bottom > frame.bottom + 0.5 ||
        r.left < frame.left - 0.5 ||
        r.right > frame.right + 0.5
      ) {
        problems.push(
          `${name}: ${Math.round(r.top)} to ${Math.round(r.bottom)}, the bubble ${Math.round(frame.top)} to ${Math.round(frame.bottom)}`,
        )
      }
      const under = document.elementFromPoint(
        r.left + r.width / 2,
        r.top + r.height / 2,
      )
      if (under === null || !el.contains(under)) {
        problems.push(`${name}: covered at its middle`)
      }
    }
    return problems
  }, names)
}

test.describe('on a small phone', () => {
  test.use({
    viewport: { width: 320, height: 568 },
    isMobile: true,
    hasTouch: true,
  })

  test("the Sing tour's words scroll under its buttons, which stay whole and on top, at 320x568", async ({
    page,
  }) => {
    test.setTimeout(90_000)
    await seedFirstVisit(page)
    await SING.open(page)
    const chip = page.getByTestId('tour-chip')
    await expect(chip).toBeVisible({ timeout: 20_000 })
    await chip.getByRole('button', { name: SING.chip }).tap()
    const bubble = page.getByTestId('coach-bubble')
    const words = bubble.locator('[tabindex="-1"]').filter({
      has: page.locator('#coach-title'),
    })
    await expect(bubble).toContainText('1 of 4', { timeout: 15_000 })
    await bubble.getByRole('button', { name: 'Skip this step' }).tap()
    await expect(bubble).toContainText('2 of 4')

    // The note stop, once the note has played and the line on how to hear
    // it has pushed the words past the bubble's cap. The line comes under
    // Play the note, so the button stays where it was tapped, in view.
    const tone = bubble.locator('button').filter({ hasText: 'Play the note' })
    const tapped = await settledBox(tone)
    await tone.tap()
    await expect(bubble.getByTestId('coach-tone-line')).toContainText(
      'Heard nothing?',
      { timeout: 10_000 },
    )
    await expect
      .poll(() =>
        controlsOutOfView(page, ['End tour', 'Back', 'Skip this step']),
      )
      .toEqual([])
    expect(
      await words.evaluate((el) => el.scrollHeight > el.clientHeight),
      'the words fit: the case no longer tests a scroll',
    ).toBe(true)
    await expect(bubble).toHaveAttribute('data-more', '')
    const shown = await settledBox(tone)
    const held = await words.boundingBox()
    expect(
      held !== null && shown !== null && inside(shown, held),
      'Play the note is whole in view with the words unscrolled',
    ).toBe(true)
    expect(await words.evaluate((el) => el.scrollTop)).toBe(0)
    expect(Math.abs((shown?.y ?? 0) - (tapped?.y ?? Infinity))).toBeLessThan(1)

    await bubble.getByRole('button', { name: 'Skip this step' }).tap()
    await expect(bubble).toContainText('3 of 4')
    await bubble.getByRole('button', { name: 'Next' }).tap()
    await expect(bubble).toContainText('4 of 4')

    // The last stop, its lesson link and a second row of buttons.
    await expect
      .poll(() =>
        controlsOutOfView(page, ['End tour', 'Back', 'Show me more', 'Done']),
      )
      .toEqual([])

    await bubble.getByRole('button', { name: 'Show me more' }).tap()
    await expect(page.getByTestId('coach-said')).toContainText('Round 1 of 2', {
      timeout: 15_000,
    })
    await expect
      .poll(() => controlsOutOfView(page, ['End tour', 'Done']))
      .toEqual([])
  })
})

test('the tab chip floats clear of Piano and its keyboard, at 1440x900 @smoke', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await seedFirstVisit(page)
  await page.addInitScript(() => {
    localStorage.setItem('pitchperfect_active_tab', 'piano')
  })
  await page.goto('/#/piano')
  const chip = page.getByTestId('tour-chip')
  await expect(chip).toBeVisible({ timeout: 20_000 })
  const canvas = page.locator('#falling-notes-canvas')

  // The canvas follows its container: the room settles as it loads.
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const main = document.querySelector('main.main-content')
        return main === null ? null : main.scrollHeight - main.clientHeight
      }),
    )
    .toBe(0)
  const keys = await settledBox(canvas)
  expect(keys, 'the falling-notes canvas is laid out').not.toBeNull()
  if (keys !== null) {
    expect(keys.y + keys.height).toBeLessThanOrEqual(900)
  }
  // Nothing but the chip under the chip: it covers no control.
  const covered = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="tour-chip"]')
    if (el === null) return ['no chip']
    const r = el.getBoundingClientRect()
    const hits: string[] = []
    for (let x = r.left + 2; x < r.right; x += 12) {
      for (let y = r.top + 2; y < r.bottom; y += 8) {
        for (const under of document.elementsFromPoint(x, y)) {
          if (el.contains(under) || under.contains(el)) continue
          if (
            under.matches(
              'button, a[href], input, select, canvas, [role="button"], [role="slider"]',
            )
          ) {
            hits.push(under.getAttribute('aria-label') ?? under.tagName)
          }
        }
      }
    }
    return [...new Set(hits)]
  })
  expect(covered).toEqual([])
})
