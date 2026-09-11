// ============================================================
// The games list warms the next world, and asks for nothing
// ============================================================
//
// Slice 5d (P7): while the list is read, Merc's file is fetched and
// parsed and the pitch detector's worker is started -- after the list has
// been drawn, when the page is idle. The unit tests pin the scheduling
// (runtime/warm.test.ts) and both handovers (render/merc-warm.test.ts,
// the pitch engine's f0-detector-preload.test.ts). This is the whole of
// it in a browser: the list warms both with no microphone asked for and
// no audio context made, the Hallway takes both rather than starting its
// own, and `?cold` warms nothing.
//
// The microphone is Chromium's fake one, so the gate can be tapped.

import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

test.use({
  viewport: { width: 390, height: 844 },
  permissions: ['microphone'],
  launchOptions: {
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
    ],
  },
})

interface Warmth {
  gum: number
  /** When each AudioContext was made. */
  audioContexts: number[]
  workers: { url: string; at: number }[]
  /** The rAF of the frame the list was first drawn in. */
  listFrameAt: number | null
}

/** What the page does, recorded from before its first script runs. */
const recordWarmth = (page: Page): Promise<void> =>
  page.addInitScript(() => {
    const log: Warmth = {
      gum: 0,
      audioContexts: [],
      workers: [],
      listFrameAt: null,
    }
    ;(window as unknown as { __warmth: Warmth }).__warmth = log
    const media = navigator.mediaDevices
    if (media?.getUserMedia !== undefined) {
      const ask = media.getUserMedia.bind(media)
      media.getUserMedia = (constraints) => {
        log.gum += 1
        return ask(constraints)
      }
    }
    const Context = window.AudioContext
    window.AudioContext = class extends Context {
      constructor(...args: ConstructorParameters<typeof AudioContext>) {
        super(...args)
        log.audioContexts.push(performance.now())
      }
    }
    const Spawn = window.Worker
    window.Worker = class extends Spawn {
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options)
        log.workers.push({ url: String(url), at: performance.now() })
      }
    }
    new MutationObserver((_, observer) => {
      if (document.querySelector('.games-screen') === null) return
      observer.disconnect()
      requestAnimationFrame(() => {
        log.listFrameAt = performance.now()
      })
    }).observe(document, { childList: true, subtree: true })
  })

const warmth = (page: Page): Promise<Warmth> =>
  page.evaluate(() => (window as unknown as { __warmth: Warmth }).__warmth)

const mercFetches = (page: Page): Promise<number> =>
  page.evaluate(
    () =>
      performance
        .getEntriesByType('resource')
        .filter((r) => r.name.includes('merc.glb')).length,
  )

const hallwayLoad = (page: Page): Promise<Record<string, number> | null> =>
  page.evaluate(() => {
    const hook = (window as unknown as Record<string, unknown>).__w3h as
      | (() => { perf: { load: Record<string, number> } })
      | undefined
    return hook === undefined ? null : hook().perf.load
  })

test('the list warms Merc and the detector after its first frame, and the Hallway takes both', async ({
  page,
}) => {
  await recordWarmth(page)
  await page.goto('/?devSeed')
  await page.getByRole('button', { name: /B-side games/ }).click()

  await expect.poll(async () => (await warmth(page)).workers.length).toBe(1)
  await expect.poll(() => mercFetches(page)).toBe(1)
  const onList = await warmth(page)
  expect(onList.workers[0]!.url).toContain('f0-detector')
  // After the frame the list was first drawn in, never inside it.
  expect(onList.listFrameAt).not.toBeNull()
  expect(onList.workers[0]!.at).toBeGreaterThan(onList.listFrameAt!)
  // Nothing a player would be asked about, and no audio route taken. Home
  // has already made the app's one shared context by now (its audio
  // session plays through it), so what is checked is that the list and
  // its warm made none of their own.
  expect(onList.gum).toBe(0)
  expect(onList.audioContexts.filter((at) => at > onList.listFrameAt!)).toEqual(
    [],
  )

  await page.getByRole('button', { name: /The Hallway/ }).click()
  await expect
    .poll(async () => (await hallwayLoad(page))?.first, { timeout: 25_000 })
    .toBeGreaterThan(0)
  await page.getByRole('button', { name: 'Walk with him', exact: true }).click()
  await expect
    .poll(async () => (await hallwayLoad(page))?.mic, { timeout: 10_000 })
    .toBeGreaterThan(0)

  // The microphone was asked for at the gate, and the stage took the
  // warmed worker and Merc's warmed load: a second of neither.
  const inGame = await warmth(page)
  expect(inGame.gum).toBeGreaterThan(0)
  expect(inGame.workers).toHaveLength(1)
  expect(await mercFetches(page)).toBe(1)
})

test('?cold warms nothing', async ({ page }) => {
  await recordWarmth(page)
  await page.goto('/?devSeed&cold')
  await page.getByRole('button', { name: /B-side games/ }).click()
  await page.locator('.games-screen').waitFor()
  // Past the longest a warm waits for an idle moment (2 s), so one that
  // was going to run would have.
  await page.waitForTimeout(2_500)
  expect((await warmth(page)).workers).toHaveLength(0)
  expect(await mercFetches(page)).toBe(0)
})
