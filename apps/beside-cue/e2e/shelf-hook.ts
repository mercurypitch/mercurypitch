// ============================================================
// The Top Shelf's dev hook, as the e2e specs drive it
// ============================================================
//
// `window.__w3s()` is ShelfStage's DEV hook (docs/games/top-shelf.md
// §11). These are the moves the specs make through it, kept in one
// place so the stage spec and the mic spec climb the same way. The
// voice is `sing(midi)`, the Line's `sing(t)` seam, and every note it
// holds still goes through the Line's slide tracker as a sung one does,
// the 150 ms hold and all, so what fires a leap here fires it on the
// phone.

import type { Page, TestInfo } from '@playwright/test'
import { expect } from '@playwright/test'
import type { ShelfLevel } from '../src/games/glass3d/levels/shelf'
import { MITT_SPAN } from '../src/games/glass3d/levels/shelf'

export interface ShelfState {
  phase: string
  room: string
  x: number
  y: number
  grounded: boolean
  shelf: number
  reference: number | null
  leaps: number
  apex: number
}

export interface ScreenBox {
  left: number
  right: number
  top: number
  bottom: number
  viewport: { w: number; h: number }
  settled: boolean
}

interface ShelfHook extends ShelfState {
  move(m: number): void
  warpTo(x: number): void
  sing(midi: number | null): void
  clear(): void
  mercScreenBox(): ScreenBox | null
}

declare global {
  interface Window {
    __w3s?: () => ShelfHook
  }
}

export const PHONE = { width: 390, height: 844 }
export const HALF = MITT_SPAN / 2
/** Poll fast: a leap is in the air for under a second. */
export const FAST = { intervals: [16], timeout: 10_000 }
/** A margin his torso may not cross: daylight, not a touch. */
export const EDGE = 8
/** Any comfortable note: the rooms are intervals, the same for every
 * voice, and down is free, so every leap can be sung from here. */
export const BASE = 55

/** Set SHELF_SHOTS_DIR to also write the frames to disk, for a person
 * to look at; the attachments are for the report. */
const SHOTS_DIR = process.env.SHELF_SHOTS_DIR

export const enter = async (page: Page): Promise<void> => {
  await page.setViewportSize(PHONE)
  await page.goto('/?devSeed')
  await page.getByRole('button', { name: /B-side games/ }).click()
  await page.getByRole('button', { name: /The Top Shelf/ }).click()
  await expect
    .poll(() => page.evaluate(() => window.__w3s !== undefined), {
      timeout: 20_000,
    })
    .toBe(true)
}

export const read = (page: Page): Promise<ShelfState> =>
  page.evaluate(() => {
    const s = window.__w3s!()
    return {
      phase: s.phase,
      room: s.room,
      x: s.x,
      y: s.y,
      grounded: s.grounded,
      shelf: s.shelf,
      reference: s.reference,
      leaps: s.leaps,
      apex: s.apex,
    }
  })

export const sing = (page: Page, midi: number | null): Promise<void> =>
  page.evaluate((m) => window.__w3s!().sing(m), midi)

export const move = (page: Page, m: number): Promise<void> =>
  page.evaluate((v) => window.__w3s!().move(v), m)

/** Hold a note until the slide tracker has made it the reference. */
export const holdNote = async (page: Page, midi: number): Promise<void> => {
  await sing(page, midi)
  await expect.poll(async () => (await read(page)).reference, FAST).toBe(midi)
}

/** Walk him until the wall stops him: his mitt against the riser. */
export const walkToRiser = async (
  page: Page,
  riserX: number,
): Promise<void> => {
  await move(page, 1)
  await expect
    .poll(async () => (await read(page)).x, FAST)
    .toBeGreaterThan(riserX - HALF - 0.002)
  await move(page, 0)
}

/**
 * Sing `midi`, and the frame he leaves the ground, change to `inAir`:
 * a note that settles on the way up. Timed in the page a frame at a
 * time, because a leap that lands tops out on the shelf -- the catch
 * takes him at the apex -- and is in the air for under half a second.
 */
export const leapThenHold = (page: Page, midi: number, inAir: number) =>
  page.evaluate(
    ([m, a]) =>
      new Promise<void>((done) => {
        const before = window.__w3s!().leaps
        window.__w3s!().sing(m)
        const wait = (): void => {
          const s = window.__w3s!()
          if (s.leaps > before && !s.grounded) {
            s.sing(a)
            done()
          } else requestAnimationFrame(wait)
        }
        requestAnimationFrame(wait)
      }),
    [midi, inAir] as const,
  )

/** Wait for leap number `n` to have come down, wherever it came down. */
export const landed = async (page: Page, n: number): Promise<ShelfState> => {
  await expect
    .poll(async () => {
      const s = await read(page)
      return s.leaps >= n && s.grounded
    }, FAST)
    .toBe(true)
  return read(page)
}

/** Down to BASE, which is free; to riser `k`; and `semis` above BASE.
 * Returns where he came down. */
export const leapAt = async (
  page: Page,
  room: ShelfLevel,
  k: number,
  semis: number,
): Promise<ShelfState> => {
  const before = (await read(page)).leaps
  await holdNote(page, BASE)
  await walkToRiser(page, room.shelves[k]!.from)
  await sing(page, BASE + semis)
  return landed(page, before + 1)
}

/** Once the chase has come to rest on him, his torso is inside the
 * frame of a portrait phone (M3). */
export const framed = async (page: Page, label: string): Promise<void> => {
  await expect
    .poll(
      () =>
        page.evaluate(() => window.__w3s!().mercScreenBox()?.settled ?? false),
      { timeout: 15_000 },
    )
    .toBe(true)
  const box = await page.evaluate(() => window.__w3s!().mercScreenBox())
  if (box === null) throw new Error(`${label}: no Merc to measure`)
  expect(box.top, `${label}: torso top`).toBeGreaterThan(EDGE)
  expect(box.bottom, `${label}: torso bottom`).toBeLessThan(
    box.viewport.h - EDGE,
  )
  expect(box.left, `${label}: torso left`).toBeGreaterThan(EDGE)
  expect(box.right, `${label}: torso right`).toBeLessThan(box.viewport.w - EDGE)
}

export const shoot = async (
  page: Page,
  info: TestInfo,
  name: string,
): Promise<void> => {
  const shot = await page.screenshot(
    SHOTS_DIR === undefined ? undefined : { path: `${SHOTS_DIR}/${name}.png` },
  )
  await info.attach(`${name}.png`, { body: shot, contentType: 'image/png' })
}
