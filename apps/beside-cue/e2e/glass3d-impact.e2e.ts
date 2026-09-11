// ============================================================
// The break, played: the picture, the canvas and the hand
// ============================================================
//
// Slice 5b put §7.1's timeline under every break. Its order and its
// durations are the unit tests' to pin (runtime/impact.test.ts, down to a
// 30 fps clock played against a 60 fps one). This is what they cannot
// see: that a real stage hands the timeline on. On a DPR 3 phone the
// first frame after the crack is held still and shaken, the canvas drops
// from the running cap of 1.5 to 1.0 and comes back when the burst is
// over, and the hand gets one heavy tap and three light ones, in that
// order, through the web haptics port -- `navigator.vibrate`, recorded
// here in place of a motor.
//
// 5c's half: under prefers-reduced-motion (P6) the same break keeps its
// taps and loses its motion, and the Sorting Line taps on a drop (P5).
//
// The Cabinet is broken through its DEV hook, which runs the same break
// the voice does: headless has no microphone. The page runs on
// Playwright's clock, held once the stage is up, so "the first frame
// after the crack" is one 16 ms step on any machine.

import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 })

interface Hit {
  since: number
  shardSeconds: number
  timeScale: number
  shake: { yaw: number; pitch: number; roll: number }
  burst: boolean
}

interface Probe {
  widths: number[]
  felt: unknown[]
  hit: Hit | null
}

/** What reaches `navigator.vibrate`, kept in place of a motor. The web
 * port calls it when it exists. */
const recordTaps = (page: Page): Promise<void> =>
  page.addInitScript(() => {
    const felt: unknown[] = []
    ;(window as unknown as { __felt: unknown[] }).__felt = felt
    Object.defineProperty(navigator, 'vibrate', {
      configurable: true,
      value: (pattern: number | number[]) => {
        felt.push(pattern)
        return true
      },
    })
  })

/** A world from the games list, up to its first frame. */
const openWorld = async (
  page: Page,
  card: RegExp,
  hook: string,
): Promise<void> => {
  await page.goto('/?devSeed')
  await page.getByRole('button', { name: /B-side games/ }).click()
  await page.getByRole('button', { name: card }).click()
  await expect
    .poll(
      () =>
        page.evaluate((name) => {
          const fn = (window as unknown as Record<string, unknown>)[name] as
            | (() => { perf: { load: { first?: number } } })
            | undefined
          return fn?.().perf.load.first ?? 0
        }, hook),
      { timeout: 25_000 },
    )
    .toBeGreaterThan(0)
}

/** The Cabinet on a held clock, with every width its canvas is given
 * from here on recorded once each. Returns the canvas's CSS width. */
const cabinetHeld = async (page: Page): Promise<number> => {
  await recordTaps(page)
  await page.clock.install()
  await openWorld(page, /The Cabinet/, '__w3')
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 100)
  return page.evaluate(() => {
    const canvas =
      document.querySelector<HTMLCanvasElement>('.stage3d__canvas')!
    const widths: number[] = []
    ;(window as unknown as { __widths: number[] }).__widths = widths
    new MutationObserver(() => {
      if (widths[widths.length - 1] !== canvas.width) widths.push(canvas.width)
    }).observe(canvas, { attributes: true, attributeFilter: ['width'] })
    return canvas.getBoundingClientRect().width
  })
}

const breakCabinet = (page: Page): Promise<void> =>
  page.evaluate(() =>
    (
      (window as unknown as Record<string, unknown>).__w3 as () => {
        break: (acc?: number) => void
      }
    )().break(1),
  )

const probe = (page: Page): Promise<Probe> =>
  page.evaluate(() => {
    const w = window as unknown as {
      __widths: number[]
      __felt: unknown[]
      __w3: () => { hit: Hit | null }
    }
    return { widths: [...w.__widths], felt: [...w.__felt], hit: w.__w3().hit }
  })

const shaken = (hit: Hit): number =>
  Math.abs(hit.shake.yaw) + Math.abs(hit.shake.pitch) + Math.abs(hit.shake.roll)

test('a break holds, shakes, drops the pixel ratio for its burst and taps the hand in order', async ({
  page,
}) => {
  test.setTimeout(120_000)
  const css = await cabinetHeld(page)
  expect(
    await page.evaluate(
      () =>
        document.querySelector<HTMLCanvasElement>('.stage3d__canvas')!.width,
    ),
  ).toBe(Math.floor(css * 1.5))

  await breakCabinet(page)
  await page.clock.runFor(16)
  const crack = await probe(page)
  // The first frame after the crack: held still, shaken, and soft.
  expect(crack.hit!.since).toBeLessThan(0.05)
  expect(crack.hit!.timeScale).toBe(0)
  expect(shaken(crack.hit!)).toBeGreaterThan(0)
  expect(crack.widths).toEqual([Math.floor(css)])

  // Back when the burst is over: two scripted steps, never a controller
  // hunting over frames.
  await page.clock.runFor(1_250)
  expect((await probe(page)).widths).toEqual([
    Math.floor(css),
    Math.floor(css * 1.5),
  ])
  // One heavy tap and three light ones: the web port's 35 ms and 10 ms.
  await expect
    .poll(async () => (await probe(page)).felt, { timeout: 5_000 })
    .toEqual([35, 10, 10, 10])
})

test('under reduced motion the break keeps its taps and loses its motion', async ({
  page,
}) => {
  test.setTimeout(120_000)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const css = await cabinetHeld(page)

  await breakCabinet(page)
  await page.clock.runFor(16)
  const crack = await probe(page)
  // No hitstop, no shake, and the shards on a clock twice the wall's.
  expect(crack.hit!.timeScale).toBe(1)
  expect(shaken(crack.hit!)).toBe(0)
  expect(crack.hit!.shardSeconds).toBeCloseTo(crack.hit!.since * 2, 9)

  // The pixel ratio never moves.
  await page.clock.runFor(1_250)
  expect((await probe(page)).widths).toEqual([])
  expect(
    await page.evaluate(
      () =>
        document.querySelector<HTMLCanvasElement>('.stage3d__canvas')!.width,
    ),
  ).toBe(Math.floor(css * 1.5))
  // The taps are not motion, and stay.
  await expect
    .poll(async () => (await probe(page)).felt, { timeout: 5_000 })
    .toEqual([35, 10, 10, 10])
})

test('the Sorting Line taps the hand when he drops through a grate', async ({
  page,
}) => {
  test.setTimeout(60_000)
  await recordTaps(page)
  await openWorld(page, /The Sorting Line/, '__w3l')
  await page.evaluate(() =>
    (
      (window as unknown as Record<string, unknown>).__w3l as () => {
        drop: () => void
      }
    )().drop(),
  )
  // A medium tap: the web port's 20 ms.
  await expect
    .poll(
      () =>
        page.evaluate(
          () => (window as unknown as { __felt: unknown[] }).__felt,
        ),
      { timeout: 5_000 },
    )
    .toEqual([20])
})
