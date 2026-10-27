// ============================================================
// "Show me more": Merc sings through the Sing tab, stop by stop
// ============================================================
//
// The Sing tour's last stop offers "Show me more" beside Done; it starts
// Merc's second tour (src/features/practice/sing-more-tour.ts), where he
// sings through the tab itself. On a phone and a wide screen:
//
// - each stop rings its control where that screen draws it, sets it as the
//   stop says (Repeat; Once with a half Spaced rest), and draws Merc's line
//   on the canvas, the green a singer's line is drawn in, while the bubble
//   stands off the control;
// - ending a stop mid-song (Done on the last, End tour, the tab left)
//   silences every sound source the page started, takes his line off the
//   canvas and puts the controls back as the singer had them, and nothing
//   is kept: no score card, no practice counted, no first-run mic offer
//   spent, nothing written to storage but the tours' own records;
// - no microphone is asked for from the tap on "Show me more" on (a spy on
//   getUserMedia, counted from that tap).
//
// The sources are counted from the page's own Web Audio calls: every source
// node started, less those that have ended. The guide notes, the metronome
// and Merc's voice all go through them.

import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

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

/** Where each screen draws the Sing tab's line. */
const canvasOf = (screen: Screen): string =>
  screen.phone ? '[data-stage-canvas] canvas' : '#canvas-container canvas'

/**
 * What the walk may write besides: the tours' own records (the guide funnel,
 * the tab's spent offer), the app's foreground clock, and the demo song's
 * lyrics, which the app seeds as it loads.
 */
const NOT_KEPT_BY_MERC =
  /^(guide\.funnel\.|pitchperfect_page_tour_offered_|pitchperfect_usage_ms$|mercurypitch\.demoLyricsSeed\.)/

async function seed(page: Page): Promise<void> {
  await page.addInitScript((v) => {
    const w = window as Window & {
      E2E_TEST_MODE?: boolean
      __gum?: number
      __sources?: Set<AudioScheduledSourceNode>
    }
    w.E2E_TEST_MODE = true
    localStorage.setItem('pitchperfect_welcome_version', v)
    localStorage.setItem('pitchperfect_onboarding_done', '1')
    localStorage.setItem('pitchperfect_focus_mode', 'false')
    localStorage.setItem('pitchperfect_survey_seen', '1')
    localStorage.setItem('pitchperfect_active_tab', 'singing')
    // Every getUserMedia call, from any part of the page.
    w.__gum = 0
    const media = navigator.mediaDevices as MediaDevices | undefined
    if (media?.getUserMedia !== undefined) {
      const ask = media.getUserMedia.bind(media)
      media.getUserMedia = async (constraints) => {
        w.__gum = (w.__gum ?? 0) + 1
        return ask(constraints)
      }
    }
    // Every Web Audio source the page starts, until it has ended.
    const sources = new Set<AudioScheduledSourceNode>()
    w.__sources = sources
    const start = AudioScheduledSourceNode.prototype.start
    AudioScheduledSourceNode.prototype.start = function (...args) {
      sources.add(this)
      this.addEventListener('ended', () => sources.delete(this))
      return start.apply(this, args)
    }
  }, version)
}

const gumCalls = (page: Page): Promise<number> =>
  page.evaluate(() => (window as Window & { __gum?: number }).__gum ?? 0)

const soundingSources = (page: Page): Promise<number> =>
  page.evaluate(
    () =>
      (window as Window & { __sources?: Set<unknown> }).__sources?.size ?? 0,
  )

/** How much of the canvas is drawn in a singer's line's green. */
async function lineInk(page: Page, screen: Screen): Promise<number> {
  return page.evaluate((selector) => {
    let most = 0
    for (const canvas of document.querySelectorAll<HTMLCanvasElement>(
      selector,
    )) {
      if (canvas.getBoundingClientRect().width === 0) continue
      const ctx = canvas.getContext('2d')
      if (ctx === null) continue
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
      let green = 0
      for (let i = 0; i < data.length; i += 4) {
        const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]]
        if (a > 100 && g > 120 && g - r > 50 && g - b > 40) green += 1
      }
      most = Math.max(most, green)
    }
    return most
  }, canvasOf(screen))
}

/**
 * The singer's controls as the screen shows them: the phone stage's play
 * mode; the wide bar's checked mode, its Spaced rest ('-' where the mode
 * shows none) and its Repeat cycles ('-' likewise).
 */
const controls = (page: Page, screen: Screen): Promise<string> =>
  page.evaluate((phone) => {
    if (phone) {
      return (
        document.querySelector('[data-tour="sing.mode"]')?.textContent ?? ''
      ).trim()
    }
    const mode =
      document.querySelector(
        '#btn-once[aria-checked="true"], #btn-repeat[aria-checked="true"]',
      )?.id ?? '-'
    const rest =
      document.querySelector<HTMLSelectElement>('#spaced-rest-mode')?.value ??
      '-'
    const cycles =
      document.querySelector<HTMLInputElement>('#cycles')?.value ?? '-'
    return `${mode} ${rest} ${cycles}`
  }, screen.phone)

/** Storage, less the tours' own records. */
const storage = (page: Page): Promise<Record<string, string>> =>
  page.evaluate((tourKeys) => {
    const out: Record<string, string> = {}
    const skip = new RegExp(tourKeys)
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key === null || skip.test(key)) continue
      out[key] = localStorage.getItem(key) ?? ''
    }
    return out
  }, NOT_KEPT_BY_MERC.source)

/** Opens the Sing tab, sets a Spaced rest of the singer's own, and walks the Sing tour to its last stop. */
async function toLastSingStop(page: Page, screen: Screen): Promise<void> {
  await page.setViewportSize({ width: screen.width, height: screen.height })
  await seed(page)
  await page.goto('/#/singing')
  if (!screen.phone) {
    await page.locator('#spaced-rest-mode').selectOption('fourth')
  }
  const chip = page.getByTestId('tour-chip')
  await expect(chip).toBeVisible({ timeout: 20_000 })
  await chip
    .getByRole('button', { name: 'Merc can show you around, 30 s' })
    .click()
  const bubble = page.getByTestId('coach-bubble')
  for (const [at, forward] of [
    ['1 of 4', 'Skip this step'],
    ['2 of 4', 'Skip this step'],
    ['3 of 4', 'Next'],
  ] as const) {
    await expect(bubble).toContainText(at, { timeout: 15_000 })
    await bubble.getByRole('button', { name: forward }).click()
  }
  await expect(bubble).toContainText('4 of 4')
}

interface Stop {
  title: string
  ring: string
  set: string
  said: string
}

const stopsFor = (screen: Screen): Stop[] =>
  screen.phone
    ? [
        {
          title: 'Repeat goes round again',
          ring: '[data-tour="sing.mode"]',
          set: 'Repeat',
          said: 'Round 1 of 2',
        },
      ]
    : [
        {
          title: 'Repeat goes round again',
          ring: '[data-tour="sing.repeat"]',
          set: 'btn-repeat - 2',
          said: 'Round 1 of 2',
        },
        {
          title: 'Spaced rest leaves a gap',
          ring: '[data-tour="sing.rest"]',
          set: 'btn-once half -',
          said: 'then rests',
        },
      ]

/** The stop on screen: its control ringed and set, the bubble off it, his line drawn. */
async function checkStop(
  page: Page,
  screen: Screen,
  stop: Stop,
  place: string,
): Promise<void> {
  const bubble = page.getByTestId('coach-bubble')
  const at = `${screen.name}: ${stop.title}`
  await expect(bubble, at).toContainText(place)
  await expect(bubble, at).toContainText(stop.title)
  await expect(page.getByTestId('coach-said'), at).toContainText(stop.said)
  await expect(bubble, at).toHaveAttribute('data-pose', 'sing')
  expect(await controls(page, screen), at).toBe(stop.set)
  const ring = page.getByTestId('coach-ring')
  await expect(ring, at).toHaveAttribute('data-running', '')
  await expect
    .poll(
      async () => {
        const held = await ring.boundingBox()
        const target = await page.locator(stop.ring).boundingBox()
        if (held === null || target === null) return false
        return (
          target.x >= held.x - 1 &&
          target.y >= held.y - 1 &&
          target.x + target.width <= held.x + held.width + 1 &&
          target.y + target.height <= held.y + held.height + 1
        )
      },
      { message: `${at}: the ring misses its control` },
    )
    .toBe(true)
  // the bubble stands off the control it rings
  const shown = await bubble.boundingBox()
  const control = await page.locator(stop.ring).boundingBox()
  expect(shown, at).not.toBeNull()
  expect(control, at).not.toBeNull()
  if (shown !== null && control !== null) {
    const apart =
      shown.x >= control.x + control.width ||
      control.x >= shown.x + shown.width ||
      shown.y >= control.y + control.height ||
      control.y >= shown.y + shown.height
    expect(apart, `${at}: the bubble covers its control`).toBe(true)
  }
  if (!screen.phone) {
    await expect(bubble, at).toHaveAttribute('data-place', 'corner')
    await expect(bubble, at).toHaveAttribute('data-corner', 'top-right')
  }
  await expect
    .poll(() => lineInk(page, screen), {
      message: `${at}: no line drawn`,
      timeout: 10_000,
    })
    .toBeGreaterThan(40)
  // Merc sings with the mic off: no hint asks the singer to turn it on
  expect(
    await page.locator('.mic-insight-hint').isVisible(),
    `${at}: a mic hint shows while Merc sings`,
  ).toBe(false)
}

/** Everything back as the singer had it, silent, and nothing kept. */
async function checkPutBack(
  page: Page,
  screen: Screen,
  before: { controls: string; storage: Record<string, string> },
): Promise<void> {
  await expect
    .poll(() => soundingSources(page), { message: 'a sound still plays' })
    .toBe(0)
  await expect
    .poll(() => lineInk(page, screen), { message: "Merc's line stayed" })
    .toBe(0)
  expect(await controls(page, screen)).toBe(before.controls)
  expect(await storage(page)).toEqual(before.storage)
  await expect(page.locator('#score-pct')).toHaveCount(0)
}

for (const screen of SCREENS) {
  test(`Show me more: Merc sings each stop through the Sing tab, and Done mid-song puts it all back, at ${screen.width}x${screen.height}`, async ({
    page,
  }) => {
    test.setTimeout(120_000)
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await toLastSingStop(page, screen)
    const bubble = page.getByTestId('coach-bubble')
    await expect(bubble.getByRole('button', { name: 'Done' })).toBeVisible()
    const before = {
      controls: await controls(page, screen),
      storage: await storage(page),
    }
    const asked = await gumCalls(page)

    await bubble.getByRole('button', { name: 'Show me more' }).click()

    const stops = stopsFor(screen)
    for (const [i, stop] of stops.entries()) {
      await checkStop(page, screen, stop, `${i + 1} of ${stops.length}`)
      if (i === 0) {
        // Repeat comes round again, and his notes are scored by no one: the
        // phone stage's live score never shows
        await expect(page.getByTestId('coach-said')).toContainText(
          'Round 2 of 2',
          { timeout: 15_000 },
        )
        if (screen.phone) {
          await expect(page.locator('[data-stage-canvas]')).not.toContainText(
            '%',
          )
        }
      }
      if (i < stops.length - 1) {
        await bubble.getByRole('button', { name: 'Next' }).click()
      }
    }
    // Done mid-song, on the last stop: the tour is over (a first visit has
    // no plan to hand over to)
    await bubble.getByRole('button', { name: 'Done' }).click()
    await expect(page.locator('#coach-root')).toHaveCount(0)

    await checkPutBack(page, screen, before)
    expect(await gumCalls(page)).toBe(asked)
    expect(errors).toEqual([])
  })

  test(`Show me more: End tour mid-song stops the sound and puts it all back, at ${screen.width}x${screen.height}`, async ({
    page,
  }) => {
    test.setTimeout(90_000)
    await toLastSingStop(page, screen)
    const before = {
      controls: await controls(page, screen),
      storage: await storage(page),
    }
    const asked = await gumCalls(page)
    const bubble = page.getByTestId('coach-bubble')
    await bubble.getByRole('button', { name: 'Show me more' }).click()
    await checkStop(page, screen, stopsFor(screen)[0], '1 of')
    await expect.poll(() => soundingSources(page)).toBeGreaterThan(0)

    await bubble.getByRole('button', { name: 'End tour' }).click()

    await expect(page.locator('#coach-root')).toHaveCount(0)
    await checkPutBack(page, screen, before)
    expect(await gumCalls(page)).toBe(asked)
  })
}

test('Show me more: leaving the Sing tab mid-song stops Merc and puts it all back, at 1440x900', async ({
  page,
}) => {
  test.setTimeout(90_000)
  const screen = SCREENS[1]
  await toLastSingStop(page, screen)
  const before = {
    controls: await controls(page, screen),
    storage: await storage(page),
  }
  const bubble = page.getByTestId('coach-bubble')
  await bubble.getByRole('button', { name: 'Show me more' }).click()
  await checkStop(page, screen, stopsFor(screen)[0], '1 of 2')

  await page.evaluate(() => {
    window.location.hash = '#/home'
  })
  await expect(page.locator('#coach-root')).toHaveCount(0)
  await page.evaluate(() => {
    window.location.hash = '#/singing'
  })
  await expect(page.locator('#canvas-container canvas').first()).toBeVisible()

  await checkPutBack(page, screen, before)
})

test('Show me more under reduced motion: the line still draws, the ring does not pulse, Merc holds still', async ({
  page,
}) => {
  test.setTimeout(90_000)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const screen = SCREENS[1]
  await toLastSingStop(page, screen)
  const bubble = page.getByTestId('coach-bubble')
  await bubble.getByRole('button', { name: 'Show me more' }).click()
  await checkStop(page, screen, stopsFor(screen)[0], '1 of 2')

  const pulse = await page
    .getByTestId('coach-ring')
    .evaluate((el) => getComputedStyle(el, '::after').animationName)
  expect(pulse).toBe('none')
  await expect(page.getByTestId('coach-merc')).toHaveAttribute(
    'data-presence',
    'still',
  )
})
