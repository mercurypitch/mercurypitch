// Singing tablet controls — keeps the secondary transport controls reachable
// with a real pointer in the compact landscape layout.

import { expect, test } from '@playwright/test'
import { dismissOverlays, openNavTab, waitForNav } from './helpers/ui'

test.use({ viewport: { width: 1024, height: 700 } })

test('keeps More and its controls pointer-reachable on a landscape tablet @smoke', async ({
  page,
}) => {
  await page.addInitScript(() => {
    ;(window as Window & { E2E_TEST_MODE?: boolean }).E2E_TEST_MODE = true
  })
  await page.goto('/')
  await waitForNav(page)
  await dismissOverlays(page)
  await openNavTab(page, 'tab-singing')

  const overlay = page.getByTestId('singing-control-overlay')
  const more = page.getByTestId('singing-more-toggle')
  await expect(overlay).toBeVisible()
  await expect(more).toBeVisible()

  const overlayBox = await overlay.boundingBox()
  const moreBox = await more.boundingBox()
  expect(overlayBox).not.toBeNull()
  expect(moreBox).not.toBeNull()
  expect(moreBox!.x).toBeGreaterThanOrEqual(overlayBox!.x)
  expect(moreBox!.x + moreBox!.width).toBeLessThanOrEqual(
    overlayBox!.x + overlayBox!.width,
  )

  await page.mouse.click(
    moreBox!.x + moreBox!.width / 2,
    moreBox!.y + moreBox!.height / 2,
  )
  await expect(more).toHaveAttribute('aria-expanded', 'true')

  const secondaryControls = [
    page.getByTestId('tempo-group'),
    page.getByLabel('Volume'),
    page.getByLabel('Playback speed'),
  ]
  for (const control of secondaryControls) {
    await expect(control).toBeVisible()
    const box = await control.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.x).toBeGreaterThanOrEqual(0)
    expect(box!.x + box!.width).toBeLessThanOrEqual(1024)
    expect(box!.y).toBeGreaterThanOrEqual(0)
    expect(box!.y + box!.height).toBeLessThanOrEqual(700)
  }
})
