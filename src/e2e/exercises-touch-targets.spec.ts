// ============================================================
// The Exercises page's controls take a full press under a finger
// ============================================================
// At 390 px the difficulty pills drew 36 px tall, the "NEW" chip beside the
// title 30 and every card's Start 25, the page's main action, and each took
// a press in exactly that box. Under a coarse pointer each takes one at
// least 44 px each way now, from an invisible box, and draws as before; on
// a desktop each takes at least 24. The pills' row scrolls on a phone and
// would cut a box off, so it holds the boxes in its own padding while the
// frame around it, which the Exercises tour spotlights, keeps its size and
// place. No box takes a neighbour's press, the chip's stays out of the
// title's text, and Start's stays inside its card at every width the
// gallery has. Measured by hit-testing (helpers/hit-area.ts).

import type { Locator, Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { bringToMiddle, hitArea, neighbourAreas, sharePress, } from './helpers/hit-area'
import type { HitArea } from './helpers/hit-area'
import { dismissOverlays } from './helpers/ui'

const touch = (width: number, height: number) => ({
  viewport: { width, height },
  hasTouch: true,
  isMobile: true,
})

interface Size {
  name: string
  use: Parameters<typeof test.use>[0]
  least: number
  /** Where the pills and the chip are checked too: the pills' drawn height. */
  pill?: number
  /** The phone layout: the header stacks, and the pills' row scrolls. */
  phoneLayout?: boolean
}

const SIZES: Size[] = [
  { name: 'a 320 px phone', use: touch(320, 640), least: 44 },
  { name: 'a 360 px phone', use: touch(360, 780), least: 44 },
  {
    name: 'a 390 px phone',
    use: touch(390, 844),
    least: 44,
    pill: 36,
    phoneLayout: true,
  },
  { name: 'a 430 px phone', use: touch(430, 932), least: 44 },
  { name: 'a tablet', use: touch(820, 1180), least: 44, pill: 25 },
  {
    name: 'a desktop',
    use: { viewport: { width: 1440, height: 900 } },
    least: 24,
    pill: 25,
  },
]

async function open(page: Page): Promise<void> {
  await page.addInitScript(() => {
    ;(window as unknown as Record<string, unknown>).E2E_TEST_MODE = true
  })
  await page.goto('/#/exercises')
  await dismissOverlays(page)
  await page.evaluate(() => document.fonts.ready)
}

const rectOf = (target: Locator) =>
  target.evaluate((element) => {
    const r = element.getBoundingClientRect()
    return { top: r.top, right: r.right, bottom: r.bottom, left: r.left }
  })

/** Whether any of `area`'s press is shared with a nearby control's. */
async function sharesWithNeighbour(control: Locator, area: HitArea) {
  const neighbours = await neighbourAreas(control)
  return neighbours.some((other) => sharePress(area.rect, other.rect))
}

for (const size of SIZES) {
  test.describe(`on ${size.name}`, () => {
    test.use(size.use)

    test(`a card's Start takes a ${size.least} px press inside its card`, async ({
      page,
    }) => {
      // Arrange
      await open(page)
      const starts = page.getByRole('button', { name: 'Start', exact: true })
      await expect(starts.first()).toBeVisible()

      for (const start of [starts.nth(0), starts.nth(1)]) {
        await bringToMiddle(start)
        const card = start.locator('xpath=ancestor::div[1]')

        // Act
        const area = await hitArea(start)
        const inCard = await rectOf(card)
        const shares = await sharesWithNeighbour(start, area)

        // Assert
        expect(area.hit[0]).toBeGreaterThanOrEqual(size.least)
        expect(area.hit[1]).toBeGreaterThanOrEqual(size.least)
        expect(area.box[1]).toBe(25)
        expect(area.ownsItsBox).toBe(true)
        // Give or take the pixel the browser rounds a hit-test to.
        expect(area.rect[0]).toBeGreaterThanOrEqual(inCard.left - 1)
        expect(area.rect[1]).toBeGreaterThanOrEqual(inCard.top - 1)
        expect(area.rect[2]).toBeLessThanOrEqual(inCard.right + 1)
        expect(area.rect[3]).toBeLessThanOrEqual(inCard.bottom + 1)
        expect(shares).toBe(false)
      }
    })

    const pillHeight = size.pill
    if (pillHeight === undefined) return

    test(`the difficulty pills take a ${size.least} px press and stay ${pillHeight} px tall`, async ({
      page,
    }) => {
      // Arrange
      await open(page)
      const frame = page.getByRole('group', { name: 'Filter by difficulty' })
      const pills = frame.getByRole('button')
      await expect(pills).toHaveText(['All', 'Easy', 'Medium', 'Hard'])

      // Act
      const areas: HitArea[] = []
      for (const pill of await pills.all()) {
        await bringToMiddle(pill)
        areas.push(await hitArea(pill))
      }
      const shared: boolean[] = []
      for (const [i, pill] of (await pills.all()).entries())
        shared.push(await sharesWithNeighbour(pill, areas[i]))
      const layout = await frame.evaluate((element) => {
        const header = element.previousElementSibling as HTMLElement
        const next = element.nextElementSibling as HTMLElement
        const pill = element.querySelector('button') as HTMLElement
        const f = element.getBoundingClientRect()
        const tenth = (n: number) => Math.round(n * 10) / 10
        return {
          frame: tenth(f.height),
          pillTop: tenth(pill.getBoundingClientRect().top - f.top),
          above: tenth(f.top - header.getBoundingClientRect().bottom),
          below: tenth(next.getBoundingClientRect().top - f.bottom),
        }
      })

      // Assert
      for (const area of areas) {
        expect(area.hit[0]).toBeGreaterThanOrEqual(size.least)
        expect(area.hit[1]).toBeGreaterThanOrEqual(size.least)
        expect(area.box[1]).toBe(pillHeight)
        expect(area.ownsItsBox).toBe(true)
      }
      expect(shared).toEqual([false, false, false, false])
      // The frame the tour spotlights keeps its size, and nothing moved.
      expect(layout).toEqual({
        frame: size.phoneLayout ? pillHeight + 2 : pillHeight,
        pillTop: 0,
        above: 18,
        below: 14,
      })
    })

    test(`the "NEW" chip takes a ${size.least} px press beside the title`, async ({
      page,
    }) => {
      // Arrange
      await open(page)
      const chip = page.locator('.exercises-header').getByRole('button')
      await expect(chip).toBeVisible()
      const title = page.locator('.exercises-header-title')

      // Act
      await bringToMiddle(chip)
      const area = await hitArea(chip)
      const titleRect = await rectOf(title)
      const shares = await sharesWithNeighbour(chip, area)

      // Assert
      expect(area.hit[0]).toBeGreaterThanOrEqual(size.least)
      expect(area.hit[1]).toBeGreaterThanOrEqual(size.least)
      expect(Math.round(area.box[1])).toBe(30)
      expect(area.ownsItsBox).toBe(true)
      expect(shares).toBe(false)
      // Stacked under the title, the press starts below the title's text.
      if (size.phoneLayout)
        expect(area.rect[1]).toBeGreaterThanOrEqual(titleRect.bottom - 0.5)
    })
  })
}
