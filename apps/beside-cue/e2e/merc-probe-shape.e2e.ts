// ============================================================
// The squash test, held to a phone
// ============================================================
//
// maff's first device test found two things a desktop sweep had not: a
// stretched Merc slid off the bottom of the screen (the anchor had its
// sign backwards) and a flat one lost his face. This spec is the first
// of those as a contract: at both ends of the sweep, on a phone-shaped
// viewport, Merc's body is inside the frame and his feet have not moved.
//
// It drives /merc-probe.html, the dev page that poses him without a
// plan or a mic, through the hooks it hangs on `window` -- so it needs
// the dev server, which is what the Playwright config already boots.
//
// THE CONTRACT IS ON THE TORSO, AND THE FLAT END IS VERTICAL ONLY. The
// probe borrows the Hallway's chase camera, which frames him 0.4 m left
// of centre by design (`lookAt` is always `mercX + 0.4`), and at the
// flat end that puts the torso's left edge 4 px past a 390 px phone and
// a mitt 8 px past it. That is the Hallway's framing, not the shape:
// the Sorting Line gets its own camera in step 4c, and this tightens to
// every edge and the whole box the day the probe can use it. Until
// then the flat end asserts top and bottom -- the bob maff saw -- and
// attaches the rest as numbers.

import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

interface Rect {
  left: number
  right: number
  top: number
  bottom: number
}

interface ScreenBox extends Rect {
  torso: Rect
  viewport: { w: number; h: number }
  feetY: number
  feetPx: { x: number; y: number }
}

declare global {
  interface Window {
    __merc?: () => unknown
    __shape?: (t: number) => void
    __mercScreenBox?: () => ScreenBox | null
  }
}

const PHONE = { width: 390, height: 844 }

/** A margin the body may not cross. Zero would pass a torso touching the
 * edge; this insists on daylight. */
const EDGE = 8

/** Set MERC_SHOTS_DIR to also write each frame to disk, for a person to
 * look at; the attachments are for the report. */
const SHOTS_DIR = process.env.MERC_SHOTS_DIR

/** Let the chase camera and the mixer land: a few frames, not a timer
 * pretending to be one. */
const settle = async (page: Page): Promise<void> => {
  await page.evaluate(
    () =>
      new Promise<void>((done) => {
        let n = 0
        const step = (): void => {
          n += 1
          if (n >= 12) done()
          else requestAnimationFrame(step)
        }
        requestAnimationFrame(step)
      }),
  )
}

const open = async (page: Page, query: string): Promise<void> => {
  await page.setViewportSize(PHONE)
  await page.goto(`/merc-probe.html?${query}`)
  await expect
    .poll(() => page.evaluate(() => window.__merc?.() !== null), {
      timeout: 20_000,
    })
    .toBe(true)
  await settle(page)
}

const boxAt = async (page: Page, t: number): Promise<ScreenBox> => {
  await page.evaluate((value) => window.__shape?.(value), t)
  await settle(page)
  const box = await page.evaluate(() => window.__mercScreenBox?.() ?? null)
  if (box === null) throw new Error('the probe has no Merc to measure')
  return box
}

const vertical = (
  r: Rect,
  viewport: { w: number; h: number },
  label: string,
): void => {
  expect(r.top, `${label} top`).toBeGreaterThan(EDGE)
  expect(r.bottom, `${label} bottom`).toBeLessThan(viewport.h - EDGE)
}

const inside = (
  r: Rect,
  viewport: { w: number; h: number },
  label: string,
): void => {
  vertical(r, viewport, label)
  expect(r.left, `${label} left`).toBeGreaterThan(EDGE)
  expect(r.right, `${label} right`).toBeLessThan(viewport.w - EDGE)
}

test.describe('Merc on a phone, at both ends of his sweep', () => {
  test('keeps his body inside the frame from puddle to thread', async ({
    page,
  }, info) => {
    await open(page, 'clip=listen&shape=0.5')
    for (const t of [0, 0.25, 0.5, 1]) {
      const box = await boxAt(page, t)
      const shot = await page.screenshot(
        SHOTS_DIR === undefined
          ? undefined
          : { path: `${SHOTS_DIR}/merc-phone-t${t}.png` },
      )
      await info.attach(`merc-t${t}.png`, {
        body: shot,
        contentType: 'image/png',
      })
      await info.attach(`merc-t${t}-box.json`, {
        body: JSON.stringify(box, null, 2),
        contentType: 'application/json',
      })
      if (t === 0) {
        vertical(box.torso, box.viewport, `t=${t} torso`)
      } else {
        inside(box.torso, box.viewport, `t=${t} torso`)
      }
    }
  })

  // The anchor: whatever his shape, the bottom of his body is where the
  // rest shape left it. Checked in world units, where a millimetre is a
  // millimetre, and on the screen, where the player would see the bob.
  // `t=0.4` freezes the mixer at one moment, so the only thing that
  // changes between measurements is the shape -- a breathing clip would
  // otherwise read as a drifting anchor.
  test('keeps his feet where they were', async ({ page }) => {
    await open(page, 'clip=listen&t=0.4&shape=0.5')
    const rest = await boxAt(page, 0.5)
    for (const t of [0, 0.25, 0.75, 1]) {
      const box = await boxAt(page, t)
      expect(box.feetY, `t=${t} feet (world)`).toBeCloseTo(rest.feetY, 3)
      expect(
        Math.abs(box.feetPx.y - rest.feetPx.y),
        `t=${t} feet (px)`,
      ).toBeLessThan(1.5)
    }
  })
})
