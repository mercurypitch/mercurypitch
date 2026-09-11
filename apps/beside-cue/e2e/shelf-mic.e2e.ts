// ============================================================
// The Top Shelf with the mic on: the HUD, the gauge and the flash
// ============================================================
//
// A fake capture device, so "Walk in" opens a mic the way a phone does
// and the stage draws what only a started stage draws: the HUD, the
// interval gauge and the flash at a leap's apex (docs/games/top-shelf.md
// §6). The notes are still the hook's -- a held `sing(midi)` outranks
// the mic -- so what fires each leap is known. Its own file because a
// fake device is a browser launch flag, which Playwright sets per
// worker, never per group.

import { expect, test } from '@playwright/test'
import { SHELF_1 } from '../src/games/glass3d/levels/shelf'
import { enter, FAST, landed, read, shoot, sing, walkToRiser, } from './shelf-hook'

test.use({
  permissions: ['microphone'],
  launchOptions: {
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
    ],
  },
})

test('the Top Shelf shows the interval gauge, and the flash at the apex', async ({
  page,
}, info) => {
  test.setTimeout(60_000)
  await enter(page)
  await sing(page, 57)
  await page.getByRole('button', { name: 'Walk in' }).click()
  await expect(page.locator('.shape-gauge')).toBeVisible()
  await expect(page.getByRole('button', { name: 'gauge' })).toBeVisible()
  await expect.poll(async () => (await read(page)).reference, FAST).toBe(57)
  await walkToRiser(page, SHELF_1.shelves[1]!.from)
  await shoot(page, info, 'shelf-1-hud-at-the-riser')
  // Twelve cents sharp of the fifth: the flash should say so.
  await sing(page, 64.12)
  await landed(page, 1)
  await shoot(page, info, 'shelf-1-flash-p5')
})
