// ============================================================
// The Top Shelf's scale, held to a phone
// ============================================================
//
// Step 6a (docs/games/top-shelf.md §8) stands the rooms up before a
// stage exists, so maff can judge the scale on his phone. This is the
// part of that judgement a machine can make: on a portrait phone, at
// every shelf of every room, Merc stands ON the shelf -- his torso's
// bottom on its top, on the screen, where a hover or a sink would show
// -- and the camera that follows his height keeps his torso in frame.
//
// It drives /shelf-probe.html, the dev page that stands him without a
// stage or a mic, through the hook it hangs on `window`, so it needs the
// dev server, which is what the Playwright config already boots.

import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { SHELVES } from '../src/games/glass3d/levels/shelf'

interface Rect {
  left: number
  right: number
  top: number
  bottom: number
}

interface ShelfBox {
  room: number
  shelf: number
  whole: Rect
  torso: Rect
  viewport: { w: number; h: number }
  feetY: number
  shelfTopY: number
  feetPx: { x: number; y: number }
  shelfTopPx: { x: number; y: number }
  settled: boolean
}

declare global {
  interface Window {
    __shelf?: {
      readonly room: number
      readonly shelf: number
      mercScreenBox(): ShelfBox
    }
  }
}

const PHONE = { width: 390, height: 844 }

/** A margin the torso may not cross: daylight, not a touch. */
const EDGE = 8

/** How far his torso's bottom may sit from the shelf's top, on screen.
 * A few pixels: the idle clip breathes. A hover or a sink the eye would
 * catch is several times this. */
const STAND_PX = 3

/** Set SHELF_SHOTS_DIR to also write each frame to disk, for a person to
 * look at; the attachments are for the report. */
const SHOTS_DIR = process.env.SHELF_SHOTS_DIR

const frames = async (page: Page, count: number): Promise<void> => {
  await page.evaluate(
    (n) =>
      new Promise<void>((done) => {
        let seen = 0
        const step = (): void => {
          seen += 1
          if (seen >= n) done()
          else requestAnimationFrame(step)
        }
        requestAnimationFrame(step)
      }),
    count,
  )
}

const open = async (page: Page, query: string): Promise<void> => {
  await page.setViewportSize(PHONE)
  await page.goto(`/shelf-probe.html?${query}`)
  await expect
    .poll(() => page.evaluate(() => window.__shelf !== undefined), {
      timeout: 20_000,
    })
    .toBe(true)
}

/** Once the chase camera has come to rest on him: a measurement taken
 * mid-glide would frame a moment, not the pose. */
const settledBox = async (page: Page): Promise<ShelfBox> => {
  await expect
    .poll(() => page.evaluate(() => window.__shelf?.mercScreenBox().settled), {
      timeout: 15_000,
    })
    .toBe(true)
  await frames(page, 3)
  const box = await page.evaluate(() => window.__shelf?.mercScreenBox())
  if (box === undefined) throw new Error('the probe has no Merc to measure')
  return box
}

const where = (page: Page) =>
  page.evaluate(() => ({
    room: window.__shelf?.room,
    shelf: window.__shelf?.shelf,
  }))

test.describe('the Top Shelf on a phone', () => {
  SHELVES.forEach((room, r) => {
    test(`stands him on every shelf of ${room.id}, inside the frame`, async ({
      page,
    }, info) => {
      test.setTimeout(90_000)
      await open(page, `room=${r + 1}&shelf=0`)
      for (let shelf = 0; shelf < room.shelves.length; shelf++) {
        if (shelf > 0) await page.keyboard.press(']')
        expect(await where(page)).toEqual({ room: r + 1, shelf })
        const box = await settledBox(page)
        const label = `${room.id} shelf ${shelf}`
        const shot = await page.screenshot(
          SHOTS_DIR === undefined
            ? undefined
            : { path: `${SHOTS_DIR}/${room.id}-shelf-${shelf}.png` },
        )
        await info.attach(`${room.id}-shelf-${shelf}.png`, {
          body: shot,
          contentType: 'image/png',
        })
        await info.attach(`${room.id}-shelf-${shelf}.json`, {
          body: JSON.stringify(box, null, 2),
          contentType: 'application/json',
        })

        expect(
          Math.abs(box.feetY - box.shelfTopY),
          `${label}: torso on the shelf (m)`,
        ).toBeLessThan(0.01)
        expect(
          Math.abs(box.feetPx.y - box.shelfTopPx.y),
          `${label}: torso on the shelf (px)`,
        ).toBeLessThan(STAND_PX)
        expect(box.torso.top, `${label}: torso top`).toBeGreaterThan(EDGE)
        expect(box.torso.bottom, `${label}: torso bottom`).toBeLessThan(
          box.viewport.h - EDGE,
        )
        expect(box.torso.left, `${label}: torso left`).toBeGreaterThan(EDGE)
        expect(box.torso.right, `${label}: torso right`).toBeLessThan(
          box.viewport.w - EDGE,
        )
      }
    })
  })

  test('takes its room and shelf from the URL, the keys and a thumb', async ({
    page,
  }) => {
    await open(page, 'room=3&shelf=2')
    expect(await where(page)).toEqual({ room: 3, shelf: 2 })
    // Room 1 has two shelves, so the shelf is kept where it can be.
    await page.getByRole('button', { name: 'Room 1' }).click()
    expect(await where(page)).toEqual({ room: 1, shelf: 1 })
    await page.getByRole('button', { name: 'Down' }).click()
    await page.getByRole('button', { name: 'Down' }).click()
    expect(await where(page)).toEqual({ room: 1, shelf: 0 })
    await page.getByRole('button', { name: 'Up' }).click()
    expect(await where(page)).toEqual({ room: 1, shelf: 1 })
    await page.keyboard.press('2')
    await page.keyboard.press('[')
    expect(await where(page)).toEqual({ room: 2, shelf: 0 })
    await expect(page).toHaveURL(/room=2&shelf=0/)
  })
})
