// ============================================================
// The Top Shelf, climbed without a voice
// ============================================================
//
// Step 6b (docs/games/top-shelf.md §8) is done when room 1 is climbed in
// the browser by hook, and by voice on the phone. This is the first
// half: the real stage, loop and sim, entered from the Games list, with
// the voice replaced by `__w3s().sing(midi)` -- the Line's `sing(t)`
// seam -- because a headless browser has nobody to hum. Every note
// below still goes through the Line's slide tracker as a sung one does,
// the 150 ms hold and all, so what fires a leap here fires it on the
// phone.

import type { Page, TestInfo } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { MITT_SPAN, SHELF_1, topsOf } from '../src/games/glass3d/levels/shelf'

interface ShelfState {
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

interface ShelfHook extends ShelfState {
  move(m: number): void
  warpTo(x: number): void
  sing(midi: number | null): void
  clear(): void
}

declare global {
  interface Window {
    __w3s?: () => ShelfHook
  }
}

const PHONE = { width: 390, height: 844 }
const HALF = MITT_SPAN / 2
/** Poll fast: a leap is in the air for under a second. */
const FAST = { intervals: [16], timeout: 10_000 }

/** Set SHELF_SHOTS_DIR to also write the frames to disk, for a person
 * to look at; the attachments are for the report. */
const SHOTS_DIR = process.env.SHELF_SHOTS_DIR

const enter = async (page: Page): Promise<void> => {
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

const read = (page: Page): Promise<ShelfState> =>
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

const sing = (page: Page, midi: number | null): Promise<void> =>
  page.evaluate((m) => window.__w3s!().sing(m), midi)

const move = (page: Page, m: number): Promise<void> =>
  page.evaluate((v) => window.__w3s!().move(v), m)

/** Hold a note until the slide tracker has made it the reference. */
const holdNote = async (page: Page, midi: number): Promise<void> => {
  await sing(page, midi)
  await expect.poll(async () => (await read(page)).reference, FAST).toBe(midi)
}

/** Walk him until the wall stops him: his mitt against the riser. */
const walkToRiser = async (page: Page, riserX: number): Promise<void> => {
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
const leapThenHold = (page: Page, midi: number, inAir: number) =>
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
const landed = async (page: Page, n: number): Promise<ShelfState> => {
  await expect
    .poll(async () => {
      const s = await read(page)
      return s.leaps >= n && s.grounded
    }, FAST)
    .toBe(true)
  return read(page)
}

const shoot = async (page: Page, info: TestInfo, name: string) => {
  const shot = await page.screenshot(
    SHOTS_DIR === undefined ? undefined : { path: `${SHOTS_DIR}/${name}.png` },
  )
  await info.attach(`${name}.png`, { body: shot, contentType: 'image/png' })
}

const RISER = SHELF_1.shelves[1]!.from
const LIP = topsOf(SHELF_1)[1]!

test.describe('the Top Shelf, room 1', () => {
  test('a note, a fifth above it, and he is on the shelf and out', async ({
    page,
  }, info) => {
    test.setTimeout(60_000)
    await enter(page)
    expect(await read(page)).toMatchObject({
      phase: 'climbing',
      room: SHELF_1.id,
      shelf: 0,
      reference: null,
    })

    // Any note will do: the first one only becomes the reference.
    await holdNote(page, 57)
    expect(await read(page)).toMatchObject({ y: 0, shelf: 0, leaps: 0 })

    // Walking never climbs: the riser holds him by his mitt.
    await walkToRiser(page, RISER)
    await move(page, 1)
    await page.waitForTimeout(400)
    await move(page, 0)
    const pinned = await read(page)
    expect(pinned.x).toBeCloseTo(RISER - HALF, 3)
    expect(pinned.y).toBe(0)
    await shoot(page, info, 'shelf-1-at-the-riser')

    // A fifth above it: 0.7 m, exactly the rise.
    await sing(page, 64)
    const up = await landed(page, 1)
    expect(up.shelf).toBe(1)
    expect(up.y).toBeCloseTo(LIP, 6)
    expect(up.apex).toBeCloseTo(LIP, 3)
    expect(up.reference).toBe(64)
    await shoot(page, info, 'shelf-1-on-the-shelf')

    await move(page, 1)
    await expect
      .poll(async () => (await read(page)).phase, { timeout: 15_000 })
      .toBe('done')
    await expect(page.getByText('The Top Shelf, climbed.')).toBeVisible()
    await shoot(page, info, 'shelf-1-climbed')
  })

  test('down is free, a flat leap hops back, and a stop in the air leaps nowhere', async ({
    page,
  }) => {
    test.setTimeout(60_000)
    await enter(page)

    // Down only moves the reference (§3.3).
    await holdNote(page, 60)
    await holdNote(page, 52)
    expect(await read(page)).toMatchObject({ y: 0, shelf: 0, leaps: 0 })

    // 0.7 of a semitone flat of the fifth: short of the catch, so the
    // riser holds him and he comes back down where he was (§3.5).
    await walkToRiser(page, RISER)
    await sing(page, 58.3)
    const hop = await landed(page, 1)
    expect(hop.shelf).toBe(0)
    expect(hop.y).toBe(0)
    expect(hop.apex).toBeCloseTo(0.63, 3)
    expect(hop.x).toBeCloseTo(RISER - HALF, 3)

    // Back down to a comfortable note, and a fifth from there; a note
    // settled on the way up moves the reference and never leaps (§3.6).
    await holdNote(page, 55)
    await leapThenHold(page, 62, 66)
    const up = await landed(page, 2)
    expect(up).toMatchObject({ shelf: 1, leaps: 2, reference: 66 })
    expect(up.y).toBeCloseTo(LIP, 6)
    expect(up.apex).toBeCloseTo(LIP, 3)
  })
})
