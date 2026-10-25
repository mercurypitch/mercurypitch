// ============================================================
// Merc's showcase in a real browser
// ============================================================
//
// "Show me around" on the plan: Merc stands by each part of the real tab bar
// in turn, and then the plan's Start here opens. jsdom lays nothing out, so
// Showcase.test.tsx stands the walk by a tab bar placed by hand; this file
// holds it to the app's own bar, at a phone, a wide screen and a short phone
// (360x640, where the line has the least room above the rail):
//
// - Every stop showcaseStops gives for the menu as it stands is visited, in
//   order, with its line. A tap moves on, and the last stop ends the walk by
//   itself after STOP_MS to the millisecond. The walk then lands on Start
//   here: the Sing tab.
// - One Merc at a time. A MutationObserver counts Merc's canvases after every
//   change to the page, through the plan's Merc, the walk's and what follows,
//   and never sees two. Merc is drawn live, as on a phone with a GPU, or there
//   would be no canvas to count: headless Chrome 148 gives the app's probe
//   (gpu-gate.ts, which asks for a context without a performance caveat) no
//   WebGL2 at all unless SwiftShader is made its GPU, which the launch flags
//   below do, and the probe would then still read SwiftShader's name and keep
//   his still, so the page is told a GPU's name instead.
// - On a phone, the line never covers the rail: its box is read on every
//   frame of the walk, hops included. Once a stop has settled, neither Merc
//   nor his line covers what he stands by, and the line is inside the window.
//
// The page's clock is held still once the plan's Merc is live, so a stop never
// moves on by itself while it is measured: on SwiftShader, with other browsers
// busy, a hop was measured taking 2.3 s, and a stop lasts STOP_MS. The hops are
// CSS transitions, which run on the browser's own time and still finish; the
// watcher keeps the real requestAnimationFrame, taken before the clock is
// installed.
//
// The plan is seeded answered (helpers/plan-seed.ts), so `#/plan` opens the
// review of it, where Show me around is. Home is the tab under the plan, so
// landing on the Sing tab is the walk's doing.

import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import type { ShowcaseStop } from '@/features/tours/coach/showcase-stops'
import { showcaseStops, STOP_MS } from '@/features/tours/coach/showcase-stops'
import { answeredPlanSeed } from './helpers/plan-seed'

test.use({
  launchOptions: {
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  },
})

// One SwiftShader browser at a time: its frames are slow enough already.
test.describe.configure({ mode: 'default' })

const VIEWPORTS = [
  { width: 390, height: 844, phone: true },
  { width: 1440, height: 900, phone: false },
  { width: 360, height: 640, phone: true },
] as const

interface Rect {
  top: number
  left: number
  right: number
  bottom: number
}

/** What the walk showed at a stop, once Merc, his line and the ring stopped moving. */
interface Settled {
  stop: string | null
  line: string | null
  bubble: Rect | null
  merc: Rect | null
  standBy: Rect | null
}

/** What the page saw over the whole walk. */
interface Watched {
  /** The most canvases in the coach's root at once. */
  coach: number
  /** The most Merc canvases on the page at once, any host's. */
  mercs: number
  /** How far, at worst, the line reached into the rail, in px, and at which stop. */
  railOverlap: number
  railOverlapAt: string
  /** Frames on which the line and the rail were both up and read. */
  framesRead: number
}

interface Visit {
  version: string
  key: string
  value: string
}

const overlaps = (a: Rect, b: Rect): boolean =>
  a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom

/** A singer who has met First Light, is on Home, and answered the plan. */
function seedVisit(visit: Visit): void {
  ;(window as unknown as { E2E_TEST_MODE: boolean }).E2E_TEST_MODE = true
  localStorage.setItem('pitchperfect_welcome_version', visit.version)
  localStorage.setItem('pitchperfect_onboarding_done', '1')
  localStorage.setItem('pitchperfect_focus_mode', 'false')
  localStorage.setItem('pitchperfect_active_tab', 'home')
  localStorage.setItem(visit.key, visit.value)
}

/**
 * Names a GPU to the app's probe, so Merc is drawn live, and watches the walk:
 * Merc's canvases after every change to the page, and the line's box against
 * the rail's on every frame. Added before the clock is installed, so the
 * requestAnimationFrame it keeps is the browser's own.
 */
function watchTheWalk(): void {
  const RENDERER = 0x1f01
  const UNMASKED_RENDERER = 0x9246
  const gl = WebGL2RenderingContext.prototype
  const realParameter = gl.getParameter
  gl.getParameter = function named(
    this: WebGL2RenderingContext,
    name: number,
  ): unknown {
    if (name === RENDERER || name === UNMASKED_RENDERER) return 'E2E test GPU'
    return realParameter.call(this, name) as unknown
  }

  const watched: Watched = {
    coach: 0,
    mercs: 0,
    railOverlap: 0,
    railOverlapAt: '',
    framesRead: 0,
  }
  ;(window as unknown as { __showcaseWatch: Watched }).__showcaseWatch = watched

  new MutationObserver(() => {
    const coach = document.querySelectorAll('#coach-root canvas').length
    const mercs = document.querySelectorAll('[data-presence] canvas').length
    watched.coach = Math.max(watched.coach, coach)
    watched.mercs = Math.max(watched.mercs, mercs)
  }).observe(document, { childList: true, subtree: true })

  const nextFrame = window.requestAnimationFrame.bind(window)
  const frame = (): void => {
    const bubble = document.querySelector('[data-testid="showcase-bubble"]')
    const rail = document.querySelector('nav[data-tour="mobile-tabbar"]')
    if (bubble !== null && rail !== null) {
      const b = bubble.getBoundingClientRect()
      const r = rail.getBoundingClientRect()
      const across = Math.min(b.right, r.right) - Math.max(b.left, r.left)
      const down = Math.min(b.bottom, r.bottom) - Math.max(b.top, r.top)
      if (across > 0 && down > watched.railOverlap) {
        watched.railOverlap = down
        watched.railOverlapAt =
          document
            .querySelector('[data-testid="showcase"]')
            ?.getAttribute('data-stop') ?? ''
      }
      watched.framesRead += 1
    }
    nextFrame(frame)
  }
  nextFrame(frame)
}

/**
 * The walk at the stop it shows, once no hop of Merc, his line or the ring is
 * running. His still's fade, as the live Merc steps in, moves nothing, so it
 * is not waited for.
 */
async function settled(
  page: Page,
  stops: readonly ShowcaseStop[],
): Promise<Settled> {
  return page.evaluate(async (all) => {
    const PLACES = ['transform', 'top', 'left', 'width', 'height']
    const layer = document.querySelector('[data-testid="showcase"]')
    const moving = (): Animation[] =>
      layer === null
        ? []
        : layer
            .getAnimations({ subtree: true })
            .filter(
              (a) =>
                a instanceof CSSTransition &&
                PLACES.includes(a.transitionProperty) &&
                a.playState !== 'finished',
            )
    for (let round = 0; round < 5 && moving().length > 0; round++) {
      await Promise.all(moving().map(async (a) => a.finished.catch(() => a)))
    }

    const rect = (el: Element | null): Rect | null => {
      if (el === null) return null
      const r = el.getBoundingClientRect()
      return { top: r.top, left: r.left, right: r.right, bottom: r.bottom }
    }
    const id = layer?.getAttribute('data-stop') ?? null
    const stop = all.find((s) => s.id === id)
    // What Merc stands by: what the stop opened, once open, else its target.
    const standBy =
      stop === undefined
        ? null
        : ((stop.opens === undefined
            ? null
            : document.querySelector(stop.opens)) ??
          document.querySelector(stop.target))
    return {
      stop: id,
      line:
        document.querySelector('[data-testid="showcase-line"]')?.textContent ??
        null,
      bubble: rect(document.querySelector('[data-testid="showcase-bubble"]')),
      merc: rect(document.querySelector('[data-testid="showcase-merc-box"]')),
      standBy: rect(standBy),
    }
  }, stops)
}

const version = (
  JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf8'),
  ) as { version: string }
).version

for (const vp of VIEWPORTS) {
  test(`Show me around stands Merc by every stop, then opens Start here, at ${vp.width}x${vp.height} @smoke`, async ({
    page,
  }) => {
    const plan = answeredPlanSeed()
    await page.setViewportSize({ width: vp.width, height: vp.height })
    await page.addInitScript(seedVisit, {
      version,
      key: plan.key,
      value: plan.value,
    })
    await page.addInitScript(watchTheWalk)
    await page.clock.install()
    await page.goto('/#/plan')

    // The plan's Merc is drawn live before the walk starts: the live path is
    // on, and his shaders are compiled once, here, where no stop is timed.
    await expect(page.getByTestId('plan-merc')).toHaveAttribute(
      'data-presence',
      'live',
      { timeout: 20_000 },
    )
    const now = await page.evaluate(() => Date.now())
    await page.clock.pauseAt(now + 100)
    await page.getByRole('button', { name: 'Show me around' }).click()

    // The menu as a first visit has it: every room, the full app.
    const stops = showcaseStops({
      phone: vp.phone,
      scope: 'all',
      mode: 'advanced',
    })
    const walk = page.getByTestId('showcase')
    await expect(walk).toHaveAttribute('data-stop', stops[0].id, {
      timeout: 15_000,
    })
    for (const [i, stop] of stops.entries()) {
      const seen = await settled(page, stops)
      expect(seen.stop).toBe(stop.id)
      expect(seen.line).toBe(stop.line)
      const { bubble, merc, standBy } = seen
      if (bubble === null || merc === null || standBy === null) {
        throw new Error(`stop ${stop.id}: nothing to measure`)
      }
      const at = JSON.stringify(seen)
      expect(overlaps(bubble, standBy), `the line covers it: ${at}`).toBe(false)
      expect(overlaps(merc, standBy), `Merc covers it: ${at}`).toBe(false)
      expect(bubble.top).toBeGreaterThanOrEqual(0)
      expect(bubble.left).toBeGreaterThanOrEqual(0)
      expect(bubble.right).toBeLessThanOrEqual(vp.width)
      expect(bubble.bottom).toBeLessThanOrEqual(vp.height)
      if (i < stops.length - 1) {
        await page.mouse.click(vp.width / 2, vp.height / 2)
      }
    }

    // The last stop ends the walk by itself, after STOP_MS.
    await page.clock.runFor(STOP_MS - 1)
    await expect(walk).toHaveAttribute('data-stop', stops.at(-1)?.id ?? '')
    await page.clock.runFor(1)
    await expect(walk).toHaveCount(0)
    await page.clock.resume()
    await expect(page.locator('#coach-root')).toHaveCount(0)
    // More's sheet, which the walk opened on a phone, is closed again.
    await expect(page.getByTestId('sheet-panel')).toHaveCount(0)
    await expect(page.locator('#tab-singing')).toHaveAttribute(
      'aria-current',
      'page',
    )

    const watched = await page.evaluate(
      () => (window as unknown as { __showcaseWatch: Watched }).__showcaseWatch,
    )
    // Merc was drawn live, so the count below counted something.
    expect(watched.coach).toBe(1)
    expect(watched.mercs).toBeLessThanOrEqual(1)
    if (vp.phone) {
      expect(watched.framesRead).toBeGreaterThan(0)
      expect(
        watched.railOverlap,
        `the line reached into the rail at ${watched.railOverlapAt}`,
      ).toBe(0)
    }
  })
}
