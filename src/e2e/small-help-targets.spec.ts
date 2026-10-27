// ============================================================
// The small "i", "?" and dismiss buttons take a full press
// ============================================================
// Three marks were drawn, and took a press, smaller than the 24 px a target
// may be: InfoPopover's "i" (a 20 px ring), the Jam page's "?" beside its
// title (20 px) and a toast's dismiss (22 px). Each takes at least 24 px
// each way now, and 44 px under a finger, while its glyph keeps its size
// and its ring its own. The "i" and the "?" get an invisible box centred on
// the ring; the dismiss grows into the toast's padding, because the phone's
// toast stack scrolls and a box past the toast's edge would be cut off by
// it. None of them may take a neighbour's press. Measured by hit-testing
// (helpers/hit-area.ts).

import type { Locator, Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { hitArea, neighbourAreas, sharePress } from './helpers/hit-area'
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

async function open(page: Page, path: string): Promise<void> {
  await page.addInitScript(() => {
    ;(window as unknown as Record<string, unknown>).E2E_TEST_MODE = true
  })
  await page.goto(path)
  await dismissOverlays(page)
}

const sizeOf = (target: Locator): Promise<[number, number]> =>
  target.evaluate((element) => {
    const r = element.getBoundingClientRect()
    return [r.width, r.height]
  })

for (const vp of VIEWPORTS) {
  test.describe(`on a ${vp.name}`, () => {
    test.use(vp.use)

    test(`the "i" takes a ${vp.least} px press with its glyph unchanged`, async ({
      page,
    }) => {
      // Arrange: Home's streak card carries InfoPopover's default trigger.
      await open(page, '/#/home')
      const trigger = page.getByRole('button', { name: 'How the streak works' })
      await expect(trigger).toBeVisible()

      // Act
      const area = await hitArea(trigger)
      const glyph = await sizeOf(trigger.locator('svg').first())
      const neighbours = await neighbourAreas(trigger)

      // Assert
      expect(area.hit[0]).toBeGreaterThanOrEqual(vp.least)
      expect(area.hit[1]).toBeGreaterThanOrEqual(vp.least)
      expect(area.box).toEqual([20, 20])
      expect(glyph).toEqual([12, 12])
      expect(area.ownsItsBox).toBe(true)
      for (const other of neighbours)
        expect(sharePress(area.rect, other.rect)).toBe(false)
    })

    test(`Jam's "?" takes a ${vp.least} px press with its glyph unchanged`, async ({
      page,
    }) => {
      // Arrange
      await open(page, '/#/jam')
      const about = page.getByRole('button', { name: 'What is a jam session?' })
      await expect(about).toBeVisible()

      // Act
      const area = await hitArea(about)
      const glyph = await about.evaluate(
        (element) => getComputedStyle(element).fontSize,
      )
      const neighbours = await neighbourAreas(about)

      // Assert
      expect(area.hit[0]).toBeGreaterThanOrEqual(vp.least)
      expect(area.hit[1]).toBeGreaterThanOrEqual(vp.least)
      expect(area.box).toEqual([20, 20])
      expect(glyph).toBe('11.52px')
      expect(area.ownsItsBox).toBe(true)
      for (const other of neighbours)
        expect(sharePress(area.rect, other.rect)).toBe(false)
    })

    test(`a toast's dismiss takes a ${vp.least} px press inside the toast`, async ({
      page,
    }) => {
      // Arrange: a returning visitor's first visit to a tab with a tour is
      // offered it in a toast, with an action button beside the dismiss.
      // The reload is that visit: on the first load First Light had the
      // screen, and nothing is offered under it.
      await open(page, '/#/exercises')
      await page.reload()
      const region = page.getByRole('region', { name: 'Notifications' })
      const dismiss = region
        .getByRole('button', { name: 'Dismiss notification' })
        .first()
      await expect(dismiss).toBeVisible()
      const action = region.getByRole('button', { name: 'Start tour' })
      await expect(action).toBeVisible()

      // Act
      const area = await hitArea(dismiss)
      const actionArea = await hitArea(action)
      const glyph = await sizeOf(dismiss.locator('svg'))
      const fits = await dismiss.evaluate((element) => {
        const toast = element.parentElement as HTMLElement
        const stack = toast.parentElement as HTMLElement
        const b = element.getBoundingClientRect()
        const t = toast.getBoundingClientRect()
        return {
          inside:
            b.left >= t.left &&
            b.right <= t.right &&
            b.top >= t.top &&
            b.bottom <= t.bottom,
          stackScrollsSideways: stack.scrollWidth > stack.clientWidth,
        }
      })

      // Assert
      expect(area.hit[0]).toBeGreaterThanOrEqual(vp.least)
      expect(area.hit[1]).toBeGreaterThanOrEqual(vp.least)
      expect(glyph).toEqual([12, 12])
      expect(area.ownsItsBox).toBe(true)
      expect(fits).toEqual({ inside: true, stackScrollsSideways: false })
      expect(sharePress(area.rect, actionArea.rect)).toBe(false)
    })
  })
}
