// ============================================================
// The break, played: the canvas and the hand
// ============================================================
//
// Slice 5b put §7.1's timeline under every break. Its order and its
// durations are the unit tests' to pin (runtime/impact.test.ts, down to a
// 30 fps clock played against a 60 fps one). This is what they cannot
// see: that a real stage hands the timeline on. On a DPR 3 phone the
// canvas drops from the running cap of 1.5 to 1.0 at the crack and comes
// back when the burst is over, and the hand gets one heavy tap and three
// light ones, in that order, through the web haptics port --
// `navigator.vibrate`, recorded here in place of a motor.
//
// The Cabinet, broken through its DEV hook, which runs the same break the
// voice does: headless has no microphone.

import { expect, test } from '@playwright/test'

test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 })

interface Probe {
  widths: number[]
  felt: unknown[]
}

test('a break drops the pixel ratio for its burst and taps the hand in order', async ({
  page,
}) => {
  test.setTimeout(60_000)
  await page.addInitScript(() => {
    const felt: unknown[] = []
    ;(window as unknown as { __felt: unknown[] }).__felt = felt
    // In place of the motor: the web port calls this when it exists.
    Object.defineProperty(navigator, 'vibrate', {
      configurable: true,
      value: (pattern: number | number[]) => {
        felt.push(pattern)
        return true
      },
    })
  })
  await page.goto('/?devSeed')
  await page.getByRole('button', { name: /B-side games/ }).click()
  await page.getByRole('button', { name: /The Cabinet/ }).click()
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const fn = (window as unknown as Record<string, unknown>).__w3 as
            | (() => { perf: { load: { first?: number } } })
            | undefined
          return fn?.().perf.load.first ?? 0
        }),
      { timeout: 25_000 },
    )
    .toBeGreaterThan(0)

  // Every width the canvas is given from here on, once each.
  const css = await page.evaluate(() => {
    const canvas =
      document.querySelector<HTMLCanvasElement>('.stage3d__canvas')!
    const widths: number[] = []
    ;(window as unknown as { __widths: number[] }).__widths = widths
    new MutationObserver(() => {
      if (widths[widths.length - 1] !== canvas.width) widths.push(canvas.width)
    }).observe(canvas, { attributes: true, attributeFilter: ['width'] })
    return canvas.getBoundingClientRect().width
  })
  const running = await page.evaluate(
    () => document.querySelector<HTMLCanvasElement>('.stage3d__canvas')!.width,
  )
  expect(running).toBe(Math.floor(css * 1.5))

  await page.evaluate(() =>
    (
      (window as unknown as Record<string, unknown>).__w3 as () => {
        break: (acc?: number) => void
      }
    )().break(1),
  )

  const probe = (): Promise<Probe> =>
    page.evaluate(() => {
      const w = window as unknown as { __widths: number[]; __felt: unknown[] }
      return { widths: [...w.__widths], felt: [...w.__felt] }
    })
  // Down at the crack and back when the burst is over: two scripted
  // steps, never a controller hunting over frames.
  await expect
    .poll(async () => (await probe()).widths, { timeout: 15_000 })
    .toEqual([Math.floor(css), Math.floor(css * 1.5)])
  // One heavy tap and three light ones: the web port's 35 ms and 10 ms.
  await expect
    .poll(async () => (await probe()).felt, { timeout: 5_000 })
    .toEqual([35, 10, 10, 10])
})
