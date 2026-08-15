// ============================================================
// Lab pane resize — real pointer coverage for the stacked work surface
// ============================================================
//
// Prerequisite: the e2e app must grant Lab only when it is running on
// localhost with window.E2E_TEST_MODE set before boot. Production and normal
// local sessions must continue to rely on LabPage's server-held access grant.

import { expect, test } from '@playwright/test'
import { dismissOverlays } from './helpers/ui'

test('Lab pane separator resizes adjacent views with a real mouse @smoke', async ({
  page,
}) => {
  await page.addInitScript(() => {
    ;(window as Window & { E2E_TEST_MODE?: boolean }).E2E_TEST_MODE = true
  })
  await page.setViewportSize({ width: 1180, height: 720 })
  await page.goto('/#/lab')
  await dismissOverlays(page)

  await expect(
    page.getByRole('heading', { name: 'Synchronized panes' }),
    'The e2e server must expose Lab only to localhost E2E_TEST_MODE runs.',
  ).toBeVisible()

  const separator = page.getByRole('separator', {
    name: 'Resize Spectrogram and Pitch Trace panes',
  })
  await separator.scrollIntoViewIfNeeded()
  await expect(separator).toBeVisible()

  const before = Number(await separator.getAttribute('aria-valuenow'))
  const box = await separator.boundingBox()
  expect(box).not.toBeNull()

  const x = box!.x + box!.width / 2
  const y = box!.y + box!.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x, y + 72, { steps: 8 })
  await page.mouse.up()

  await expect
    .poll(async () => Number(await separator.getAttribute('aria-valuenow')))
    .toBeGreaterThan(before)
})
