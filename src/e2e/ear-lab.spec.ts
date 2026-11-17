import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

import { dismissOverlays, openNavTab } from './helpers/ui'

// The Ear Lab's one smoke path, on Merc's bench (the web's face of the tab
// since Nov 2026): the tab opens on the bench, Hairline starts from its
// station's sheet, the room's practice run arms its pads, and Close mid-run
// asks before it ends the run and comes back to the bench. Everything the
// tab lends the drills — the engine, the room, its console — has to hold
// for this to pass.

/** Open a station's sheet on the bench and start one of its instruments. */
async function startFromStation(
  page: Page,
  faculty: string,
  instrument: string,
): Promise<void> {
  await page
    .locator(`[data-testid="merc-station"][data-faculty="${faculty}"]`)
    .click()
  await page
    .getByTestId('merc-station-row')
    .filter({ hasText: instrument })
    .first()
    .click()
}

test.describe('Ear Lab', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      ;(window as any).E2E_TEST_MODE = true
    })
    await page.goto('/')
    await page.waitForSelector('#app-tabs', { timeout: 10000 })
    await dismissOverlays(page)
  })

  test('opens the bench, runs Hairline and ends the run back on the bench @smoke', async ({
    page,
  }) => {
    await openNavTab(page, 'tab-ear-lab')
    const bench = page.getByTestId('merc-bench')
    await expect(bench).toBeVisible()
    await expect(page.locator('[data-tour="ear.index"]')).toBeVisible()

    await startFromStation(page, 'resolution', 'Hairline')
    const room = page.getByTestId('ear-stage')
    await expect(room).toHaveAttribute('data-ear-drill', 'hairline')
    await expect(page.getByTestId('merc-mode')).toContainText('practice run')

    await expect(
      page.locator('[data-testid="ear-stage-pads"] button:not([disabled])', {
        hasText: 'The first',
      }),
    ).toBeVisible({ timeout: 10000 })

    // Mid-run, Close asks first, and ending the run keeps nothing.
    await page.getByRole('button', { name: 'End the run' }).first().click()
    const exit = page.getByTestId('merc-exit')
    await expect(exit).toContainText('End the run?')
    await exit.getByRole('button', { name: 'End the run' }).click()

    await expect(room).toHaveCount(0)
    await expect(bench).toBeVisible()
  })

  test("shows Hairline's whole paragraph in the room's ? at a desk", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await openNavTab(page, 'tab-ear-lab')
    await startFromStation(page, 'resolution', 'Hairline')
    await page.getByTestId('merc-help-open').click()

    const help = page.getByTestId('merc-help')
    await expect(help).toBeVisible()
    const text = help.getByText(/^Two tones; pick the higher one\./)
    await expect(text).toContainText('there is no ceiling to park at.')
    // Nothing of it is cut: the sheet scrolls, the paragraph never clamps.
    const cut = await text.evaluate(
      (element) => element.scrollHeight > element.clientHeight + 1,
    )
    expect(cut, 'the paragraph is cut short').toBe(false)
    await expect(help.getByRole('button', { name: 'More' })).toHaveCount(0)
  })

  test("shows Hairline's whole paragraph in the room's ? on a phone", async ({
    page,
  }) => {
    // Where the old bench's card cut it to three lines behind More.
    await page.setViewportSize({ width: 390, height: 844 })
    await openNavTab(page, 'tab-ear-lab')
    await startFromStation(page, 'resolution', 'Hairline')
    await page.getByTestId('merc-help-open').click()

    const help = page.getByTestId('merc-help')
    const text = help.getByText(/^Two tones; pick the higher one\./)
    await text.scrollIntoViewIfNeeded()
    await expect(text).toBeInViewport()
    const cut = await text.evaluate(
      (element) => element.scrollHeight > element.clientHeight + 1,
    )
    expect(cut, 'the paragraph is cut short').toBe(false)

    // Close puts the room back as it was, mid-run.
    await help.getByRole('button', { name: 'Close' }).click()
    await expect(help).toHaveCount(0)
    await expect(page.getByTestId('ear-stage')).toHaveAttribute(
      'data-ear-drill',
      'hairline',
    )
  })

  test("opens the web's Ear rooms from the bench's row, and Back comes back to its card", async ({
    page,
  }) => {
    // The phone opens these through its shell. The web opens the three it
    // has in the frame its Exercises tab opens them in, over the Ear Lab
    // (exercise-rooms.spec.ts walks every room there).
    await page.setViewportSize({ width: 390, height: 844 })
    await openNavTab(page, 'tab-ear-lab')
    const row = page.getByTestId('ear-rooms-row')
    await expect(row).toBeVisible()
    const cards = row.getByTestId('ear-rooms-card')
    await expect(cards).toHaveCount(3)
    // Free on the web, and no First note, whose songs are the phone's.
    await expect(row).not.toContainText('Premium')
    await expect(row).not.toContainText('First note')

    const leap = row.locator(
      '[data-testid="ear-rooms-card"][data-exercise="leap-cliffs"]',
    )
    await leap.click()
    const host = page.getByTestId('web-room')
    await expect(host).toHaveAttribute('data-room', 'leap-cliffs')
    await expect(host.getByTestId('leap-room')).toBeVisible()
    // The whole window, over the bench and the app's own bars.
    expect(await host.boundingBox()).toEqual({
      x: 0,
      y: 0,
      width: 390,
      height: 844,
    })

    await page.getByTestId('web-room-back').click()
    await expect(host).toHaveCount(0)
    await expect(page.getByTestId('merc-bench')).toBeVisible()
    await expect(leap).toBeFocused()
  })
})
