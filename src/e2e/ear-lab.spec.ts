import { expect, test } from '@playwright/test'

import { dismissOverlays, openNavTab } from './helpers/ui'

// The Ear Lab's one smoke path: the tab opens on the bench, Hairline
// starts from the strip, a practice run arms its pads, Stop lands on the
// end plate with a way back. Everything the room lends the drills — the
// engine, the stage, the sticky console — has to hold for this to pass.
test.describe('Ear Lab', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      ;(window as any).E2E_TEST_MODE = true
    })
    await page.goto('/')
    await page.waitForSelector('#app-tabs', { timeout: 10000 })
    await dismissOverlays(page)
  })

  test('opens the bench, runs Hairline and stops on the end plate @smoke', async ({
    page,
  }) => {
    await openNavTab(page, 'tab-ear-lab')
    const bench = page.locator('#ear-lab-panel')
    await expect(bench).toBeVisible()
    await expect(page.locator('[data-tour="ear.column"]')).toBeVisible()

    await page
      .locator('[data-tour="ear.drills"] button', { hasText: 'Hairline' })
      .first()
      .click()
    const stage = page.getByTestId('ear-stage')
    await expect(stage).toBeVisible()

    await page.getByText('Practice run').click()
    await expect(
      page.locator('[data-testid="ear-stage-pads"] button:not([disabled])', {
        hasText: 'The first',
      }),
    ).toBeVisible({ timeout: 10000 })

    await page.getByLabel('Stop').click()
    const plate = page.getByTestId('ear-stage-plate')
    await expect(plate).toBeVisible()
    await page.getByText('Back to the bench').click()
    await expect(bench).toBeVisible()
  })
})
