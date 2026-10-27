// ============================================================
// The small "i", "?" and a toast's buttons take a full press
// ============================================================
// Three marks were drawn, and took a press, smaller than the 24 px a target
// may be: InfoPopover's "i" (a 20 px ring), the Jam page's "?" beside its
// title (20 px) and a toast's dismiss (22 px). Each takes at least 24 px
// each way now, and 44 px under a finger, while its glyph keeps its size
// and its ring its own. The "i" and the "?" get an invisible box centred on
// the ring; the dismiss grows into the toast's padding, because the phone's
// toast stack scrolls and a box past the toast's edge would be cut off by
// it. The toast's action ("Enable mic" on the mic offer), 23.7 px tall,
// takes the same presses from a box centred on it, inside the toast and
// beside the dismiss's. None of them may take a neighbour's press.
// Measured by hit-testing (helpers/hit-area.ts).

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

// A toast slides 16 px in from the right as it enters on a desktop, and
// rises 10 px on a phone (Notifications.module.css). Until it stops it
// reaches past its stack, and a press hit-tested at one moment sits a few
// pixels from the toast's box read at the next. A CI run measured one
// mid-slide, so the toasts are measured at rest.
const toastsAtRest = (region: Locator): Promise<unknown> =>
  region.evaluate((element) =>
    Promise.all(
      element.getAnimations({ subtree: true }).map((a) => a.finished),
    ),
  )

// A toast with an action beside its dismiss: practice that starts with the
// mic off is offered the mic, once (usePlaybackMicNudge). The reload makes
// it a returning visit, with First Light spent.
async function micOffer(page: Page): Promise<Locator> {
  await open(page, '/#/singing')
  await page.reload()
  await page
    .getByRole('main')
    .getByRole('button', { name: 'Play', exact: true })
    .click()
  const region = page.getByRole('region', { name: 'Notifications' })
  const action = region.getByRole('button', { name: 'Enable mic' })
  await expect(action).toBeVisible()
  await toastsAtRest(region)
  return action
}

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
      // Arrange: the mic offer, with its action beside the dismiss.
      const action = await micOffer(page)
      const dismiss = action
        .locator('xpath=ancestor::div[1]')
        .getByRole('button', { name: 'Dismiss notification' })
      await expect(dismiss).toBeVisible()

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

// The toast's action, beside its dismiss, on the phones the toast is
// narrowest on as well: at 320 px its message wraps onto seven lines, two
// more than at 390 px.
const TOAST_VIEWPORTS = [
  ...VIEWPORTS,
  {
    name: '320 px phone',
    use: {
      viewport: { width: 320, height: 640 },
      hasTouch: true,
      isMobile: true,
    },
    least: 44,
  },
] as const

for (const vp of TOAST_VIEWPORTS) {
  test.describe(`on a ${vp.name}`, () => {
    test.use(vp.use)

    test(`a toast's action takes a ${vp.least} px press beside the dismiss's`, async ({
      page,
    }) => {
      // Arrange: the mic offer, as above.
      const action = await micOffer(page)
      const toast = action.locator('xpath=ancestor::div[1]')
      const dismiss = toast.getByRole('button', {
        name: 'Dismiss notification',
      })

      // Act
      const area = await hitArea(action)
      const dismissArea = await hitArea(dismiss)
      // Hit-testing works in whole pixels and already reads the 23.7 px
      // button as 24, so the box it takes its press from is read too.
      const pressBox = await action.evaluate((element) => {
        const box = getComputedStyle(element, '::before')
        return [parseFloat(box.width), parseFloat(box.height)]
      })
      const t = await toast.evaluate((element) => {
        const r = element.getBoundingClientRect()
        return [r.left, r.top, r.right, r.bottom]
      })

      // Assert
      expect(area.hit[0]).toBeGreaterThanOrEqual(vp.least)
      expect(area.hit[1]).toBeGreaterThanOrEqual(vp.least)
      expect(area.box[1]).toBeCloseTo(23.66, 1)
      expect(pressBox[0]).toBeGreaterThanOrEqual(vp.least)
      expect(pressBox[1]).toBeGreaterThanOrEqual(vp.least)
      expect(area.ownsItsBox).toBe(true)
      expect(dismissArea.hit[1]).toBeGreaterThanOrEqual(vp.least)
      expect(sharePress(area.rect, dismissArea.rect)).toBe(false)
      // Inside the toast, give or take the pixel a hit-test rounds to: the
      // phone's stack scrolls, and would cut off a press past its edge.
      expect(area.rect[0]).toBeGreaterThanOrEqual(t[0] - 1)
      expect(area.rect[1]).toBeGreaterThanOrEqual(t[1] - 1)
      expect(area.rect[2]).toBeLessThanOrEqual(t[2] + 1)
      expect(area.rect[3]).toBeLessThanOrEqual(t[3] + 1)
    })
  })
}
