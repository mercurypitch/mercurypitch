// ============================================================
// The Map's side doors read as one set at every phone width
// ============================================================
// "And also" leads five doors: Challenges, Guitar, Piano, the Voice Mirror
// and Lessons. On a phone they were a wrapping flex row, which fills each
// line before it starts the next, so at 390 and 430 px the first four
// filled the line and Lessons sat on a line of its own, reading as an
// afterthought rather than one of the doors. The rule held here is the
// Map's: every door on one line where they fit, otherwise lines of
// near-equal length, never a door alone. Measured boxes, not class names,
// at the four phone widths people hold, and the desktop row as it was.

import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { FRESH_VISITOR_INIT } from './helpers/tone-wav'

const PHONES = [
  { width: 320, height: 568 },
  { width: 360, height: 780 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
] as const

/** The Map as #/map replays it, with its fonts in and its entrance played
 *  out, so sizes are final: the beat comes in scaled, and a door measured
 *  mid-entrance is a fraction of a pixel short of its 44. */
async function openMap(page: Page): Promise<void> {
  await page.addInitScript(FRESH_VISITOR_INIT)
  await page.goto('/')
  await page.evaluate(() => {
    ;(
      window as unknown as { __startOnboarding?: () => void }
    ).__startOnboarding?.()
  })
  await page.goto('/#/map')
  await expect(page.locator('[data-beat="map"]')).toBeVisible({
    timeout: 15000,
  })
  await page.evaluate(() => document.fonts.ready.then(() => undefined))
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => undefined)),
    ).then(() => undefined),
  )
}

interface DoorLayout {
  /** How many doors each line holds, top to bottom. */
  lines: number[]
  /** The width the doors ask for on a single line, margins included. */
  asked: number
  /** The width the row gives them. */
  room: number
  /** Every door's height, and whether it stays inside the row. */
  heights: number[]
  inside: boolean
  labelBottom: number
  labelLeft: number
  labelMiddle: number
  firstDoorTop: number
  firstDoorLeft: number
  firstDoorBottom: number
}

function measureDoors(page: Page): Promise<DoorLayout> {
  return page.locator('[data-side-doors]').evaluate((row) => {
    const doors = [...row.querySelectorAll<HTMLElement>('button')]
    const label = row.querySelector('span')
    if (label === null || doors.length === 0) throw new Error('no doors')
    const box = row.getBoundingClientRect()
    const tops: number[] = []
    const lines: number[] = []
    let asked = 0
    for (const door of doors) {
      const r = door.getBoundingClientRect()
      const style = getComputedStyle(door)
      asked +=
        r.width + parseFloat(style.marginLeft) + parseFloat(style.marginRight)
      const at = tops.findIndex((top) => Math.abs(top - r.top) < 2)
      if (at === -1) {
        tops.push(r.top)
        lines.push(1)
      } else {
        lines[at] += 1
      }
    }
    const order = tops.map((top, i) => ({ top, n: lines[i] }))
    order.sort((a, b) => a.top - b.top)
    const l = label.getBoundingClientRect()
    const first = doors[0].getBoundingClientRect()
    return {
      lines: order.map((line) => line.n),
      asked,
      room: row.clientWidth,
      heights: doors.map((door) => door.getBoundingClientRect().height),
      inside: doors.every((door) => {
        const r = door.getBoundingClientRect()
        return r.left >= box.left - 0.5 && r.right <= box.right + 0.5
      }),
      labelBottom: l.bottom,
      labelLeft: l.left,
      labelMiddle: l.top + l.height / 2,
      firstDoorTop: first.top,
      firstDoorLeft: first.left,
      firstDoorBottom: first.bottom,
    }
  })
}

test.describe("the Map's side doors on a phone", () => {
  test.use({ hasTouch: true, isMobile: true })

  for (const phone of PHONES) {
    test(`keep every door in a set at ${phone.width} px, never one alone`, async ({
      page,
    }) => {
      // Arrange
      await page.setViewportSize(phone)
      await openMap(page)

      // Act
      const layout = await measureDoors(page)

      // Assert
      expect(layout.lines.reduce((a, b) => a + b, 0)).toBe(5)
      if (layout.asked <= layout.room) {
        expect(layout.lines, 'five doors that fit share one line').toEqual([5])
      } else {
        expect(layout.lines).toHaveLength(2)
        expect(Math.min(...layout.lines)).toBeGreaterThanOrEqual(2)
        expect(Math.max(...layout.lines) - Math.min(...layout.lines)).toBe(1)
      }
      expect(layout.inside).toBe(true)
      for (const height of layout.heights)
        expect(height).toBeGreaterThanOrEqual(44)
      // The label keeps its own line above them.
      expect(layout.labelBottom).toBeLessThanOrEqual(layout.firstDoorTop)
    })
  }
})

test('keeps the desktop row as it was: the label leading the five doors on one line', async ({
  page,
}) => {
  // Arrange
  await page.setViewportSize({ width: 1440, height: 900 })
  await openMap(page)

  // Act
  const layout = await measureDoors(page)

  // Assert
  expect(layout.lines).toEqual([5])
  expect(layout.labelLeft).toBeLessThan(layout.firstDoorLeft)
  expect(layout.labelMiddle).toBeGreaterThan(layout.firstDoorTop)
  expect(layout.labelMiddle).toBeLessThan(layout.firstDoorBottom)
})
