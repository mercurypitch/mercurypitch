// ============================================================
// The phone header's controls take a full press under a finger
// ============================================================
// At 390 px the header row is 50 px tall and drew its controls smaller than
// a thumb: the menu 42x34, the "MercuryPitch" home button 20 px tall, the
// voice pill's mic 30x30 and the support heart 34x25, and each took a press
// in exactly that box. They take one at least 44 px each way now, from
// invisible boxes, without the header changing height or a box reaching
// into a neighbour's: every control still owns its own drawn box. Measured
// by hit-testing (helpers/hit-area.ts), on the pages the header looks
// different on: Home, Practice with its stage, Guitar.

import { expect, test } from '@playwright/test'
import { hitArea, sharePress } from './helpers/hit-area'
import type { HitArea } from './helpers/hit-area'
import { dismissOverlays } from './helpers/ui'

test.use({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
})

const PAGES = ['/#/home', '/#/singing', '/#/guitar'] as const

for (const path of PAGES) {
  test(`gives every control in the phone header a 44 px press on ${path}`, async ({
    page,
  }) => {
    // Arrange
    await page.addInitScript(() => {
      ;(window as unknown as Record<string, unknown>).E2E_TEST_MODE = true
    })
    await page.goto(path)
    await dismissOverlays(page)
    const header = page.locator('header').first()
    await expect(header).toBeVisible()
    const named = {
      menu: header.getByRole('button', { name: 'Menu', exact: true }),
      home: header.locator('#app-title'),
      voice: header.getByRole('button', { name: 'Turn voice control on (V)' }),
      support: header.getByRole('link', { name: 'Support MercuryPitch' }),
    }
    for (const control of Object.values(named))
      await expect(control).toBeVisible()

    // Act
    const areas: Record<string, HitArea> = {}
    for (const [name, control] of Object.entries(named))
      areas[name] = await hitArea(control)
    const everyControl = await header.locator('button:visible, a:visible').all()
    const all: HitArea[] = []
    for (const control of everyControl) all.push(await hitArea(control))
    const height = await header.evaluate(
      (element) => element.getBoundingClientRect().height,
    )

    // Assert
    for (const [name, area] of Object.entries(areas)) {
      expect(
        area.hit[0],
        `${name} takes a press 44 px wide`,
      ).toBeGreaterThanOrEqual(44)
      expect(
        area.hit[1],
        `${name} takes a press 44 px tall`,
      ).toBeGreaterThanOrEqual(44)
    }
    for (const area of all) expect(area.ownsItsBox).toBe(true)
    for (let i = 0; i < all.length; i++)
      for (let j = i + 1; j < all.length; j++)
        expect(sharePress(all[i].rect, all[j].rect)).toBe(false)
    expect(height).toBeLessThanOrEqual(50.5)
  })
}
