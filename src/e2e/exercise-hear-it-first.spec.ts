// ============================================================
// Hear it first: Merc plays a drill's example before the singer tries
// ============================================================
//
// The shell's part (the button, Merc's line, giving way to a run) and each
// drill's example are unit-tested. A browser shows the rest: the button sits
// under Start where a thumb finds it, the example runs its length on the
// real clock and hands the bubble back to the brief, and a drill left
// while it plays is left cleanly.

import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { dismissOverlays, openNavTab, waitForNav } from './helpers/ui'

async function openDrill(page: Page, title: string): Promise<void> {
  await page.addInitScript(() => {
    ;(window as unknown as { E2E_TEST_MODE?: boolean }).E2E_TEST_MODE = true
    localStorage.setItem('pitchperfect_advanced_features', 'true')
  })
  await page.goto('/')
  await waitForNav(page)
  await dismissOverlays(page)
  await openNavTab(page, 'tab-exercises')
  await page.locator('.exercise-card', { hasText: title }).first().click()
  await expect(page.locator('.exercise-idle-start')).toBeVisible({
    timeout: 10000,
  })
}

test.describe('Hear it first', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test("plays Interval Trainer's example under its name, then gives the bubble back", async ({
    page,
  }) => {
    await openDrill(page, 'Interval Trainer')
    const button = page.getByRole('button', { name: 'Hear it first' })
    await expect(button).toBeVisible()

    // Under Start, a thumb wide and tall, inside the sheet.
    const [start, demo] = await Promise.all(
      [page.locator('.exercise-idle-start'), button].map((el) =>
        el.evaluate((node) => {
          const r = node.getBoundingClientRect()
          return { top: r.top, bottom: r.bottom, height: r.height }
        }),
      ),
    )
    expect(demo.top).toBeGreaterThanOrEqual(start.bottom)
    expect(demo.height).toBeGreaterThanOrEqual(44)

    await button.click()
    const line = page.locator('.exercise-stage-demo-line')
    await expect(line).toHaveText(
      /^Listen: [A-G]#?\d, then [A-G]#?\d\. That is a Perfect 5th\.$/,
    )
    await expect(page.locator('.idle-hint')).toHaveCount(0)

    // Two notes and the gap between them: under three seconds.
    await expect(line).toHaveCount(0, { timeout: 6000 })
    await expect(page.locator('.idle-hint')).toHaveText(
      '6 rounds · Major 2nd through Octave',
    )
    await expect(button).toBeEnabled()
  })

  // A run needs a microphone, which this suite's browser does not have, so
  // "the example gives way to a run" is the shell's unit test
  // (ExerciseShell.stage.test.tsx). What a browser can show is the other way
  // out: leaving the drill while the example plays.
  test("plays Scale Runner's scale under its name, and leaving the drill cuts it short", async ({
    page,
  }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await openDrill(page, 'Scale Runner')
    await page.getByRole('button', { name: 'Hear it first' }).click()
    await expect(page.locator('.exercise-stage-demo-line')).toHaveText(
      /^Listen: the Major scale, up from [A-G]#?\d\.$/,
    )

    // Eight notes take about four seconds; Back does not wait for them.
    await page.locator('.back-btn').click()
    await expect(page.locator('.exercise-card').first()).toBeVisible({
      timeout: 10000,
    })

    // Back in, the drill opens on its brief with the example ready again.
    await page
      .locator('.exercise-card', { hasText: 'Scale Runner' })
      .first()
      .click()
    await expect(page.locator('.idle-hint')).toHaveText('8 notes · Major · up')
    await expect(page.locator('.exercise-stage-demo-line')).toHaveCount(0)
    await expect(
      page.getByRole('button', { name: 'Hear it first' }),
    ).toBeEnabled()
    expect(errors).toEqual([])
  })
})
