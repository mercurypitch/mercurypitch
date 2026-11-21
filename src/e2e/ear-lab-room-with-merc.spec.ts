// ============================================================
// The Ear Lab with Merc draws his Regulator Room, whatever room was stored
// ============================================================
//
// Merc's bench is the one Regulator Room and has no picker (#1460), but
// until 21 Nov 2026 the shell behind his screens still drew the room this
// browser had stored: a Glasshouse Bench picked before, or by the store
// app, whose Ear Lab has its picker. It showed where his screens leave the
// shell bare: a strip under the Ear Report and the bench's scroll gutter at
// a desk, and through a phone's glass tab bar. With a Glasshouse Bench
// stored, the shell draws the Regulator Room behind the bench, a drill room
// and the Ear Report, and under a phone's tab bar, and the Glasshouse Bench
// stays stored for the store app.

import { expect, test, type Page } from '@playwright/test'
import { dismissOverlays, openNavTab } from './helpers/ui'

const KEY = 'pitchperfect_ear_background'
const STORED = 'ear-glasshouse-bench'

/** Merc's bench, with a Glasshouse Bench stored before. */
async function openBench(page: Page): Promise<void> {
  await page.addInitScript(
    ([key, room]) => {
      ;(window as unknown as Record<string, unknown>).E2E_TEST_MODE = true
      localStorage.setItem(key, room)
    },
    [KEY, STORED] as const,
  )
  // Through the tab bar rather than /ear-lab: the built site has a real
  // dist/ear-lab/ directory of room art (ear-lab-bench-wide.spec.ts).
  await page.goto('/')
  await dismissOverlays(page)
  await openNavTab(page, 'tab-ear-lab')
  await expect(page.getByTestId('merc-station').first()).toBeVisible()
}

/** The shell's room and the picture on its plate: the Regulator Room, the stored room left as it was. */
async function expectRegulatorRoom(page: Page): Promise<void> {
  await expect(page.getByTestId('ear-room-shell')).toHaveAttribute(
    'data-room',
    'ear-regulator-room',
  )
  await expect(page.getByTestId('ear-room-art')).toHaveCSS(
    'background-image',
    /\/ear-lab\/regulator-room-(landscape|portrait)\.webp/,
  )
  expect(await page.evaluate((key) => localStorage.getItem(key), KEY)).toBe(
    STORED,
  )
}

test.describe('The Ear Lab with Merc at a desk, a Glasshouse Bench stored', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('draws the Regulator Room behind the bench and its scroll gutter', async ({
    page,
  }) => {
    await openBench(page)

    await expectRegulatorRoom(page)
  })

  test('draws the Regulator Room behind a drill room', async ({ page }) => {
    await openBench(page)
    await page
      .locator('[data-testid="merc-station"][data-faculty="resolution"]')
      .click()
    await page
      .getByTestId('merc-station-row')
      .filter({ hasText: 'Hairline' })
      .first()
      .click()
    await expect(page.getByTestId('ear-stage')).toHaveAttribute(
      'data-ear-drill',
      'hairline',
    )

    await expectRegulatorRoom(page)
  })

  test('draws the Regulator Room under the Ear Report @smoke', async ({
    page,
  }) => {
    await openBench(page)
    await page.getByTestId('merc-report').click()
    await expect(page.getByTestId('merc-report-screen')).toBeVisible()

    await expectRegulatorRoom(page)
  })
})

test.describe('The Ear Lab with Merc on a phone, a Glasshouse Bench stored', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  })

  test('draws the Regulator Room under the glass tab bar', async ({ page }) => {
    await openBench(page)
    const bar = page.getByRole('navigation', { name: 'Primary navigation' })
    await expect(bar).toBeVisible()
    // The plate lies under the whole bar, so the bar's glass shows it.
    const [barBox, plateBox] = await Promise.all([
      bar.boundingBox(),
      page.getByTestId('ear-room-art').boundingBox(),
    ])
    if (barBox === null || plateBox === null) {
      throw new Error('the tab bar or the room plate has no box')
    }
    expect(plateBox.y).toBeLessThanOrEqual(barBox.y)
    expect(plateBox.y + plateBox.height).toBeGreaterThanOrEqual(
      barBox.y + barBox.height,
    )

    await expectRegulatorRoom(page)
  })
})
