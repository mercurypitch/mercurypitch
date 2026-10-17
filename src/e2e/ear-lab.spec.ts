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

  test("shows Hairline's whole paragraph on the instrument card at a desk", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await openNavTab(page, 'tab-ear-lab')
    await page
      .locator('[data-tour="ear.drills"] button', { hasText: 'Hairline' })
      .first()
      .click()
    const card = page.getByTestId('ear-instrument-card')
    await expect(card).toBeVisible()
    await expect(card).toHaveAttribute('data-open', 'false')

    // Three lines cut it at "is your readi…".
    const text = card.locator('p')
    await expect(text).toContainText('there is no ceiling to park at.')
    const cut = await text.evaluate(
      (element) => element.scrollHeight > element.clientHeight + 1,
    )
    expect(cut, 'the card still cuts the paragraph short').toBe(false)
    // Nothing is left to unfold.
    await expect(card.getByRole('button', { name: 'More' })).toHaveCount(0)
  })

  test("keeps three lines and More where five would still cut Hairline's paragraph", async ({
    page,
  }) => {
    // The card is 228px wide here, and the paragraph needs six lines: five
    // would only hang the card lower over the instrument.
    await page.setViewportSize({ width: 1024, height: 768 })
    await openNavTab(page, 'tab-ear-lab')
    await page
      .locator('[data-tour="ear.drills"] button', { hasText: 'Hairline' })
      .first()
      .click()
    const card = page.getByTestId('ear-instrument-card')
    await expect(card).toBeVisible()
    await expect(card.getByRole('button', { name: 'More' })).toBeVisible()
    const clamp = await card
      .locator('p')
      .evaluate((element) =>
        getComputedStyle(element).getPropertyValue('-webkit-line-clamp'),
      )
    expect(clamp).toBe('3')
  })

  test("brings More back when the desk narrows under Hairline's card", async ({
    page,
  }) => {
    // Opened where five lines hold the paragraph, then narrowed to where it
    // needs six (or an iPad Pro turned from 1366 to 1024): the card read it
    // once and stayed cut at five, with an ellipsis and no More.
    await page.setViewportSize({ width: 1440, height: 900 })
    await openNavTab(page, 'tab-ear-lab')
    await page
      .locator('[data-tour="ear.drills"] button', { hasText: 'Hairline' })
      .first()
      .click()
    const card = page.getByTestId('ear-instrument-card')
    const more = card.getByRole('button', { name: 'More' })
    const clamp = () =>
      card
        .locator('p')
        .evaluate((element) =>
          getComputedStyle(element).getPropertyValue('-webkit-line-clamp'),
        )
    await expect(card).toBeVisible()
    await expect(more).toHaveCount(0)

    await page.setViewportSize({ width: 1024, height: 768 })
    await expect(more).toBeVisible()
    expect(await clamp()).toBe('3')

    await page.setViewportSize({ width: 1440, height: 900 })
    await expect(more).toHaveCount(0)
    expect(await clamp()).toBe('5')
  })

  test("offers More again when Less folds Hairline's card left open", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1024, height: 768 })
    await openNavTab(page, 'tab-ear-lab')
    const hairline = page
      .locator('[data-tour="ear.drills"] button', { hasText: 'Hairline' })
      .first()
    await hairline.click()
    const card = page.getByTestId('ear-instrument-card')
    await card.getByRole('button', { name: 'More' }).click()
    await expect(card).toHaveAttribute('data-open', 'true')

    // The drill remembers the card open, so it comes back unfolded.
    await page.getByRole('button', { name: 'Back to the bench' }).click()
    await hairline.click()
    await expect(card).toHaveAttribute('data-open', 'true')
    await card.getByRole('button', { name: 'Less' }).click()
    await expect(card).toHaveAttribute('data-open', 'false')
    await expect(card.getByRole('button', { name: 'More' })).toBeVisible()
  })
})
