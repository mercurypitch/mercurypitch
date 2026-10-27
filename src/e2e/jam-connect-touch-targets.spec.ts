// ============================================================
// Jam's connect form takes a full press under a finger
// ============================================================
// At 390 px the display name field drew 39 px tall, the room code field
// and both buttons 38, and each took a press in exactly that box. Under a
// coarse pointer each takes one at least 44 px each way now, and draws as
// before; on a desktop each takes at least 24. A field cannot carry a box
// of its own, so its <label> carries it: a press on the label is a press
// on the field, which is also why the field labels need no press of their
// own. No press takes a neighbour's, and the form keeps its spacing.
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
  await page.addInitScript(() => {
    ;(window as unknown as Record<string, unknown>).E2E_TEST_MODE = true
  })
  await page.goto('/#/jam')
  await dismissOverlays(page)
  await page.evaluate(() => document.fonts.ready)
}

/** The space between the bottom of `upper` and the top of `lower`. */
async function gapBetween(upper: Locator, lower: Locator): Promise<number> {
  const bottom = await upper.evaluate((e) => e.getBoundingClientRect().bottom)
  const top = await lower.evaluate((e) => e.getBoundingClientRect().top)
  return Math.round((top - bottom) * 10) / 10
}

/** Whether any of `area`'s press is shared with a nearby control's. */
async function sharesWithNeighbour(control: Locator, area: HitArea) {
  const neighbours = await neighbourAreas(control)
  return neighbours.some((other) => sharePress(area.rect, other.rect))
}

const FIELDS = [
  { id: 'jam-display-name', label: 'Display Name', height: 39 },
  { id: 'jam-room-id', label: 'Room code', height: 38 },
] as const

for (const vp of VIEWPORTS) {
  test.describe(`on a ${vp.name}`, () => {
    test.use(vp.use)

    for (const field of FIELDS) {
      test(`the ${field.label} field, with its label, takes a ${vp.least} px press`, async ({
        page,
      }) => {
        // Arrange
        await open(page)
        const input = page.locator(`#${field.id}`)
        await expect(input).toBeVisible()
        const label = page.locator(`label[for="${field.id}"]`)

        // Act
        await bringToMiddle(input)
        const area = await hitArea(input)
        const shares = await sharesWithNeighbour(input, area)
        const labels = await label.evaluate(
          (element) => (element as HTMLLabelElement).control?.id,
        )
        const gap = await gapBetween(label, input)
        const middle = await input.evaluate((element) => {
          const r = element.getBoundingClientRect()
          return r.top + r.height / 2
        })

        // Assert
        expect(labels).toBe(field.id)
        expect(area.hit[0]).toBeGreaterThanOrEqual(vp.least)
        expect(area.hit[1]).toBeGreaterThanOrEqual(vp.least)
        expect(area.box[1]).toBe(field.height)
        expect(area.ownsItsBox).toBe(true)
        // Above the field the label takes its press; below, the press
        // reaches 22 px from the field's middle (12 on a desktop), give or
        // take the pixel a hit-test rounds to.
        expect(area.rect[3] - middle).toBeGreaterThanOrEqual(vp.least / 2 - 1)
        expect(shares).toBe(false)
        expect(gap).toBe(6)
      })
    }

    test(`Create Room and Join Room take a ${vp.least} px press`, async ({
      page,
    }) => {
      // Arrange
      await open(page)
      const buttons = [
        page.getByRole('button', { name: 'Create Room' }),
        page.getByRole('button', { name: 'Join Room' }),
      ]
      for (const button of buttons) await expect(button).toBeVisible()
      const fieldsAbove = FIELDS.map((f) => page.locator(`#${f.id}`))

      // Act
      const areas: HitArea[] = []
      const shared: boolean[] = []
      for (const button of buttons) {
        await bringToMiddle(button)
        const area = await hitArea(button)
        areas.push(area)
        shared.push(await sharesWithNeighbour(button, area))
      }
      const gaps = [
        await gapBetween(fieldsAbove[0], buttons[0]),
        await gapBetween(fieldsAbove[1], buttons[1]),
      ]

      // Assert
      for (const area of areas) {
        expect(area.hit[0]).toBeGreaterThanOrEqual(vp.least)
        expect(area.hit[1]).toBeGreaterThanOrEqual(vp.least)
        expect(area.box[1]).toBe(38)
        expect(area.ownsItsBox).toBe(true)
      }
      expect(shared).toEqual([false, false])
      // Each sits 14 px under the field above it, as before.
      expect(gaps).toEqual([14, 14])
    })
  })
}
