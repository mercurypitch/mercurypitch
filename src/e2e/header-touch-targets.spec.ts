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
// different on: Home, Practice with its stage, Guitar; and with the tour
// offer standing in it, on the five tabs where it does.

import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
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

// The tour offer can stand in this row too. On a phone's Sing, Path, Piano,
// Guitar and Analysis tabs the column has no room for it, and it is Merc
// alone between the wordmark and the controls (chip-place.ts). It stands
// clear of their presses, the invisible boxes included: it stood on the left
// 3 px of the mic's, which then took a press 41 px wide.
const OFFER_TABS = ['singing', 'path', 'piano', 'guitar', 'analysis'] as const

const version = (
  JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'),
  ) as { version: string }
).version

for (const tab of OFFER_TABS) {
  test(`keeps every phone header control its 44 px press with the tour offer in the header on /#/${tab}`, async ({
    page,
  }) => {
    // Arrange: a returning visitor whose offer for the tab is due
    await page.addInitScript(
      ([v, t]) => {
        ;(window as unknown as Record<string, unknown>).E2E_TEST_MODE = true
        localStorage.setItem('pitchperfect_welcome_version', v)
        localStorage.setItem('pitchperfect_onboarding_done', '1')
        localStorage.setItem('pitchperfect_focus_mode', 'false')
        localStorage.setItem('pitchperfect_survey_seen', '1')
        localStorage.setItem('pitchperfect_active_tab', t)
      },
      [version, tab],
    )
    await page.goto(`/#/${tab}`)
    const chip = page.getByTestId('tour-chip')
    await expect(chip).toHaveAttribute('data-place', 'bar', {
      timeout: 20_000,
    })
    // Placed again as the page settles (chip-float.ts): the same box twice
    // in a row, a beat apart.
    let previous = ''
    await expect
      .poll(
        async () => {
          const now = JSON.stringify(await chip.boundingBox())
          const same = now === previous
          previous = now
          return same
        },
        { intervals: [400] },
      )
      .toBe(true)
    const header = page.locator('header').first()
    const named = {
      menu: header.getByRole('button', { name: 'Menu', exact: true }),
      home: header.locator('#app-title'),
      voice: header.getByRole('button', { name: 'Turn voice control on (V)' }),
      support: header.getByRole('link', { name: 'Support MercuryPitch' }),
    }

    // Act
    const areas: Record<string, HitArea> = {}
    for (const [name, control] of Object.entries(named))
      areas[name] = await hitArea(control)
    const everyControl = await header.locator('button:visible, a:visible').all()
    const owns: boolean[] = []
    for (const control of everyControl)
      owns.push((await hitArea(control)).ownsItsBox)

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
    expect(owns.every(Boolean), 'every header control owns its box').toBe(true)
  })
}
