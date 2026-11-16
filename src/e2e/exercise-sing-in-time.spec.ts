// ============================================================
// Sing It in Time: the drill's setup and Hear it first, in a real browser
// ============================================================
//
// The drill's planner, judge, clock and screens are unit-tested, and a run
// needs a voice, which this browser has none of. What only a browser shows:
// the card opens it from the gallery, its first tune is set on a staff that
// fits a phone with Start in reach, Hear it first plays the tune on the beat
// with the cursor moving through it on the real clock, and its address
// opens it on Lesson 18's two bars.

import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { dismissOverlays, openNavTab, waitForNav } from './helpers/ui'

async function openDrill(page: Page): Promise<void> {
  await page.addInitScript(() => {
    ;(window as unknown as { E2E_TEST_MODE?: boolean }).E2E_TEST_MODE = true
    localStorage.setItem('pitchperfect_advanced_features', 'true')
  })
  await page.goto('/')
  await waitForNav(page)
  await dismissOverlays(page)
  await openNavTab(page, 'tab-exercises')
  await page
    .locator('.exercise-card', { hasText: 'Sing It in Time' })
    .first()
    .click()
  await expect(page.locator('.exercise-idle-start')).toBeVisible({
    timeout: 10000,
  })
}

test.describe('Sing It in Time', () => {
  test('its card opens it on a phone: the first tune on the staff, its setup, and Start in reach', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await openDrill(page)
    await expect(page.locator('h2.exercise-title')).toHaveText(
      'Sing It in Time',
    )
    await expect(page.locator('.idle-hint')).toHaveText(
      '3 tunes · 60 BPM · quarters and halves, steps and thirds',
    )
    await expect(page.getByTestId('exercise-stage-coach')).toContainText(
      "I give you do, then the click counts one bar. Keep reading: the beat won't wait.",
    )

    const staff = page.getByTestId('tune-staff')
    await expect(staff).toBeVisible()
    await expect(staff).toHaveAttribute(
      'aria-label',
      /^(Treble|Bass) staff in /,
    )
    expect(await page.getByTestId('tune-note').count()).toBeGreaterThanOrEqual(
      5,
    )
    await expect(page.getByTestId('tune-beat')).toHaveCount(8)
    await expect(page.getByRole('button', { name: 'Hear do' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Names on' })).toBeVisible()
    await expect(
      page.getByRole('switch', { name: /Click while I sing/ }),
    ).toHaveAttribute('aria-checked', 'false')

    // The staff fits the phone, and Start sits on screen under it.
    const box = await staff.boundingBox()
    expect(box).not.toBeNull()
    expect((box?.x ?? -1) >= 0).toBe(true)
    expect((box?.x ?? 0) + (box?.width ?? 999)).toBeLessThanOrEqual(390)
    const start = await page.locator('.exercise-idle-start').boundingBox()
    expect((start?.y ?? 9999) + (start?.height ?? 0)).toBeLessThanOrEqual(844)
    expect(start?.y ?? 0).toBeGreaterThan((box?.y ?? 0) + (box?.height ?? 0))
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      ),
    ).toBe(0)
  })

  test('the staff takes the sheet’s width on a desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await openDrill(page)
    const staff = await page.getByTestId('tune-staff').boundingBox()
    expect(staff?.width ?? 0).toBeGreaterThanOrEqual(520)
  })

  test('Hear it first plays the tune on the beat, the cursor moving through it', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await openDrill(page)
    await page.getByRole('button', { name: 'Hear it first' }).click()
    await expect(page.getByRole('button', { name: 'Listen…' })).toBeDisabled()
    await expect(page.locator('.exercise-stage-demo-line')).toHaveText(
      /^Listen: do, the count-in, then the tune on the beat, in [A-G]♭? major\.$/,
    )
    // Merc's do and the count-in take six beats at 60; then the cursor is on
    // the bars and a note is lit under it.
    // (a vertical line has no width, so it is attached rather than "visible")
    await expect(page.getByTestId('tune-cursor')).toBeAttached({
      timeout: 10000,
    })
    await expect(
      page.locator('[data-testid="tune-note"][data-tone="now"]'),
    ).toHaveCount(1, { timeout: 10000 })
  })

  test("its address opens it on Lesson 18's two bars", async ({ page }) => {
    // Production's Worker answers /exercises/<slug> with the app's shell
    // (src/worker.ts); the e2e server has no such rule, so do what it does.
    await page.route(/\/exercises\/sing-it-in-time\?/, async (route) => {
      const shell = await route.fetch({
        url: new URL('/', route.request().url()).href,
      })
      await route.fulfill({ response: shell })
    })
    await page.goto('/exercises/sing-it-in-time?lesson=18')
    await expect(page.locator('h2.exercise-title')).toHaveText(
      'Sing It in Time',
      { timeout: 15000 },
    )
    await expect(page.locator('.idle-hint')).toHaveText(
      '3 tunes · 60 BPM · quarters and halves, steps and thirds',
    )
  })
})
