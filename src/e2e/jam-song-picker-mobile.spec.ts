// ============================================================
// Responsive Jam song picker — real interaction regression.
// ============================================================
//
// The shared Sheet once rendered inside JamPanel's clipped, filtered stage.
// Desktop still worked, and even a narrow Chromium viewport could sometimes
// paint it, but iOS treated the fixed sheet as part of that containing block.
// Keep the product-level contract here: a host can open the drawer, see the
// shipped song and built-in practice content, close it, and choose an item.

import { expect, test } from '@playwright/test'
import { dismissOverlays } from './helpers/ui'

test.use({
  viewport: { width: 390, height: 844 },
  permissions: ['microphone', 'camera'],
  launchOptions: {
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
    ],
  },
})

test.describe('Responsive Jam song picker', () => {
  test('opens as a viewport drawer with the baseline catalogue @smoke', async ({
    page,
  }) => {
    await page.goto('/#/jam')
    await dismissOverlays(page)

    await page.getByRole('button', { name: 'Create Room' }).click()
    await expect(
      page.getByText('Preview room — these peers are not real'),
    ).toBeVisible()

    const toggle = page.getByRole('button', {
      name: 'Choose a drill or a song',
    })
    await toggle.click()

    const drawer = page.getByRole('dialog', {
      name: 'Choose a song or a drill',
    })
    await expect(drawer).toBeVisible()

    // A viewport-fixed sheet cannot remain below the stage that clips it.
    // This structural assertion fails in every engine if the portal is ever
    // removed, while the original visual symptom was WebKit-only.
    expect(
      await drawer.evaluate(
        (element) => element.closest('#jam-panel') === null,
      ),
    ).toBe(true)

    await expect(drawer.getByText('Goodbye to Spring')).toBeVisible()
    await expect(
      drawer.getByText('Josh Woodward', { exact: false }),
    ).toBeVisible()
    await expect(drawer.getByText('Long Note', { exact: true })).toBeVisible()
    await expect(
      drawer.getByText('C Major Scale', { exact: true }),
    ).toBeVisible()

    const drawerBox = await drawer.boundingBox()
    expect(drawerBox).not.toBeNull()
    expect(drawerBox?.width).toBeGreaterThanOrEqual(388)
    expect(
      Math.abs((drawerBox?.y ?? 0) + (drawerBox?.height ?? 0) - 844),
    ).toBeLessThanOrEqual(2)

    const firstChoice = drawer.getByRole('button').first()
    const choiceBox = await firstChoice.boundingBox()
    expect(choiceBox?.height).toBeGreaterThanOrEqual(44)

    await page.keyboard.press('Escape')
    await expect(drawer).not.toBeVisible()
    await expect(toggle).toBeFocused()

    await toggle.click()
    await drawer.getByRole('button', { name: /Long Note/ }).click()
    await expect(drawer).not.toBeVisible()
  })

  test('keeps the desktop picker as an anchored overlay @smoke', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/#/jam')
    await dismissOverlays(page)

    await page.getByRole('button', { name: 'Create Room' }).click()
    await expect(
      page.getByText('Preview room — these peers are not real'),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Choose a drill or a song' }).click()

    const desktopChoice = page
      .locator('#jam-panel button')
      .filter({ hasText: 'Goodbye to Spring' })
    await expect(desktopChoice).toBeVisible()
    await expect(
      page.getByRole('dialog', { name: 'Choose a song or a drill' }),
    ).toHaveCount(0)
    expect(
      await desktopChoice.evaluate(
        (element) => element.closest('#jam-panel') !== null,
      ),
    ).toBe(true)

    await page.mouse.click(1000, 700)
    await expect(desktopChoice).not.toBeVisible()
  })
})
