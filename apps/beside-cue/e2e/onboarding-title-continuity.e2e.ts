// ============================================================
// V2 onboarding — opening title continuity
// ============================================================
//
// The authored Cue turn finishes just before the automatic reveal-to-hold
// transition. The same title surface must retain that finished pose while the
// sound-unlock action appears; replacing or resetting it reads as a hard cut.

import { expect, test } from '@playwright/test'

test('keeps one Cue title surface and its finished turn through the begin hold', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 664 })
  await page.goto('/')

  const cue = await page.locator('.brand-mark__cue').elementHandle()
  const heading = await page
    .getByRole('heading', {
      name: 'Beside Cue. One Pull. One chosen turn.',
    })
    .elementHandle()
  expect(cue).not.toBeNull()
  expect(heading).not.toBeNull()

  await expect(page.getByRole('button', { name: 'Tap to begin' })).toBeVisible()

  const heldPose = await cue!.evaluate((element) => {
    const matrix = new DOMMatrixReadOnly(getComputedStyle(element).transform)
    return {
      connected: element.isConnected,
      finishedAnimations: element
        .getAnimations()
        .filter((animation) => animation.playState === 'finished').length,
      horizontalScale: matrix.a,
      verticalScale: matrix.d,
    }
  })

  await expect(page.locator('.brand-mark')).toHaveCount(1)
  expect(heldPose.connected).toBe(true)
  expect(await heading!.evaluate((element) => element.isConnected)).toBe(true)
  expect(heldPose.finishedAnimations).toBe(1)
  expect(heldPose.horizontalScale).toBeCloseTo(1, 2)
  expect(heldPose.verticalScale).toBeCloseTo(1, 2)

  await page.getByRole('button', { name: 'Tap to begin' }).click()
  await expect(page.locator('main[data-phase]')).toHaveAttribute(
    'data-phase',
    'B01_CORKY_GREETING',
  )
  expect(await cue!.evaluate((element) => element.isConnected)).toBe(false)
})
