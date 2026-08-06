// ============================================================
// Jam lyric progress — real pointer navigation regression.
// ============================================================
//
// A lyric-row click is a transport seek, not a completed performance. The
// position readout must follow forward/backward clicks immediately, keep the
// song total stable, and return to the intro when Stop rewinds the room.

import { expect, test } from '@playwright/test'
import { dismissOverlays } from './helpers/ui'

test.use({ viewport: { width: 1280, height: 800 } })

test('keeps lyric position stable through click-seek and stop @smoke', async ({
  page,
}) => {
  await page.goto('/#/jam')
  await dismissOverlays(page)

  await page.getByRole('button', { name: 'Create Room' }).click()
  await expect(
    page.getByText('Preview room — these peers are not real'),
  ).toBeVisible()

  await page.getByRole('button', { name: 'Choose a drill or a song' }).click()
  await page
    .locator('#jam-panel button')
    .filter({ hasText: 'Goodbye to Spring' })
    .click()

  const progress = page.getByLabel('Lyric position')
  await expect(progress).toHaveText('Intro · 26 lines')

  const fifthLine = page.getByText("But summer's gonna come", {
    exact: false,
  })
  const fifthBox = await fifthLine.boundingBox()
  expect(fifthBox).not.toBeNull()
  await page.mouse.click(
    (fifthBox?.x ?? 0) + (fifthBox?.width ?? 0) / 2,
    (fifthBox?.y ?? 0) + (fifthBox?.height ?? 0) / 2,
  )
  await expect(progress).toHaveText('Line 5 / 26')

  const secondLine = page.getByText('Yeah, I will try', { exact: false })
  const secondBox = await secondLine.boundingBox()
  expect(secondBox).not.toBeNull()
  await page.mouse.click(
    (secondBox?.x ?? 0) + (secondBox?.width ?? 0) / 2,
    (secondBox?.y ?? 0) + (secondBox?.height ?? 0) / 2,
  )
  await expect(progress).toHaveText('Line 2 / 26')

  await page
    .getByRole('button', { name: 'Start playback for everyone here' })
    .click()
  await page
    .getByRole('button', { name: 'Stop and go back to the top' })
    .click()
  await expect(progress).toHaveText('Intro · 26 lines')
})
