// ============================================================
// Settings' section tabs and Credits' links take a full press
// ============================================================
// At 390 px the section tabs drew 34 px tall, and on Credits the Product
// Hunt badge 38 and Ko-fi 29, and each took a press in exactly that box.
// Under a coarse pointer each takes one at least 44 px each way now, from
// an invisible box, and draws as before; on a desktop each takes at least
// 24. The tab strip scrolls sideways and the promo card clips, so the boxes
// are held inside their padding: the strip grows its own and gives it back
// in margin, and nothing below it moves. No box takes a neighbour's press.
// Measured by hit-testing (helpers/hit-area.ts).

import type { Locator, Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { bringToMiddle, hitArea, neighbourAreas, sharePress, } from './helpers/hit-area'
import type { HitArea } from './helpers/hit-area'
import { dismissOverlays } from './helpers/ui'

const VIEWPORTS = [
  {
    name: 'phone',
    use: {
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
    },
    least: 44,
  },
  {
    name: 'desktop',
    use: { viewport: { width: 1440, height: 900 } },
    least: 24,
  },
] as const

async function open(page: Page): Promise<void> {
  // This server only: the badge's image lives on Product Hunt's host.
  await page.route(
    (url) => url.hostname !== '127.0.0.1' && url.hostname !== 'localhost',
    (route) => route.abort(),
  )
  await page.addInitScript(() => {
    ;(window as unknown as Record<string, unknown>).E2E_TEST_MODE = true
  })
  await page.goto('/#/settings/credits')
  await dismissOverlays(page)
  await page.evaluate(() => document.fonts.ready)
}

const rectOf = (target: Locator) =>
  target.evaluate((element) => {
    const r = element.getBoundingClientRect()
    return { top: r.top, right: r.right, bottom: r.bottom, left: r.left }
  })

/** Whether the press lies inside `box`, give or take the pixel the browser
 *  rounds a hit-test to. */
const inside = (area: HitArea, box: Awaited<ReturnType<typeof rectOf>>) =>
  area.rect[0] >= box.left - 1 &&
  area.rect[1] >= box.top - 1 &&
  area.rect[2] <= box.right + 1 &&
  area.rect[3] <= box.bottom + 1

/** Whether any of `area`'s press is shared with a nearby control's. */
async function sharesWithNeighbour(control: Locator, area: HitArea) {
  const neighbours = await neighbourAreas(control)
  return neighbours.some((other) => sharePress(area.rect, other.rect))
}

for (const vp of VIEWPORTS) {
  test.describe(`on a ${vp.name}`, () => {
    test.use(vp.use)

    test(`every section tab takes a ${vp.least} px press inside the strip`, async ({
      page,
    }) => {
      // Arrange
      await open(page)
      const strip = page.getByRole('tablist')
      const tabs = strip.getByRole('tab')
      await expect(tabs).toHaveText([
        'General',
        'Practice',
        'Karaoke',
        'Display & Controls',
        'Sync',
        'Credits',
      ])

      // Act
      const areas: HitArea[] = []
      const shared: boolean[] = []
      const inStrip: boolean[] = []
      for (const tab of await tabs.all()) {
        await bringToMiddle(tab)
        const area = await hitArea(tab)
        areas.push(area)
        shared.push(await sharesWithNeighbour(tab, area))
        inStrip.push(inside(area, await rectOf(strip)))
      }
      const layout = await strip.evaluate((element) => {
        const title = element.previousElementSibling as HTMLElement
        const next = element.nextElementSibling as HTMLElement
        const tab = element.querySelector('[role="tab"]') as HTMLElement
        const t = tab.getBoundingClientRect()
        const tenth = (n: number) => Math.round(n * 10) / 10
        return {
          above: tenth(t.top - title.getBoundingClientRect().bottom),
          below: tenth(next.getBoundingClientRect().top - t.bottom),
        }
      })

      // Assert
      for (const area of areas) {
        expect(area.hit[0]).toBeGreaterThanOrEqual(vp.least)
        expect(area.hit[1]).toBeGreaterThanOrEqual(vp.least)
        expect(area.box[1]).toBe(34)
        expect(area.ownsItsBox).toBe(true)
      }
      expect(shared).toEqual(areas.map(() => false))
      expect(inStrip).toEqual(areas.map(() => true))
      // The tabs and the section under them are where they were.
      expect(layout).toEqual({ above: 20, below: 17 })
    })

    test(`the Product Hunt badge takes a ${vp.least} px press inside its card`, async ({
      page,
    }) => {
      // Arrange
      await open(page)
      const card = page.getByTestId('promo-code-card')
      const badge = card.getByRole('link', {
        name: 'MercuryPitch on Product Hunt',
      })
      await bringToMiddle(badge)
      await expect(badge).toBeVisible()

      // Act
      const area = await hitArea(badge)
      const inCard = inside(area, await rectOf(card))
      const shares = await sharesWithNeighbour(badge, area)

      // Assert
      expect(area.hit[0]).toBeGreaterThanOrEqual(vp.least)
      expect(area.hit[1]).toBeGreaterThanOrEqual(vp.least)
      expect(area.box).toEqual([180, 38])
      expect(area.ownsItsBox).toBe(true)
      expect(inCard).toBe(true)
      expect(shares).toBe(false)
    })

    test(`Ko-fi takes a ${vp.least} px press with its pill unchanged`, async ({
      page,
    }) => {
      // Arrange
      await open(page)
      const kofi = page.getByTestId('donate-kofi')
      await bringToMiddle(kofi)
      await expect(kofi).toBeVisible()

      // Act
      const area = await hitArea(kofi)
      const shares = await sharesWithNeighbour(kofi, area)

      // Assert
      expect(area.hit[0]).toBeGreaterThanOrEqual(vp.least)
      expect(area.hit[1]).toBeGreaterThanOrEqual(vp.least)
      expect(area.box[1]).toBe(29)
      expect(area.ownsItsBox).toBe(true)
      expect(shares).toBe(false)
    })
  })
}
