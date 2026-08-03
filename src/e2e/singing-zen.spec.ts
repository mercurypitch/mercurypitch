import { expect, test } from '@playwright/test'
import { dismissOverlays } from '@/e2e/helpers/ui'

async function prepare(page: import('@playwright/test').Page): Promise<void> {
  await page.addInitScript(() => {
    ;(window as Window & { E2E_TEST_MODE?: boolean }).E2E_TEST_MODE = true
  })
  await page.goto('/')
  await page.waitForSelector('#app')
  await dismissOverlays(page)
}

async function openZen(
  page: import('@playwright/test').Page,
  exerciseId?: string,
): Promise<void> {
  await page.evaluate((id) => {
    const bridge = (
      window as Window & {
        __pp?: {
          appStore?: {
            openSingingZen?: (launch: unknown) => void
          }
        }
      }
    ).__pp
    bridge?.appStore?.openSingingZen?.(
      id === undefined
        ? { mode: 'monitor', source: 'singing' }
        : { mode: 'exercise', exerciseId: id, source: 'path' },
    )
  }, exerciseId)
}

test.describe('Singing Zen pitch stage', () => {
  test('@smoke opens a melody-free monitor and returns to Singing', async ({
    page,
  }) => {
    await prepare(page)
    await openZen(page)

    const stage = page.getByTestId('zen-pitch-stage')
    await expect(stage).toBeVisible()
    await expect(stage).toHaveAttribute('data-pitch-stage-mode', 'zen-monitor')
    await expect(
      page.getByRole('heading', { name: 'Open Pitch Monitor' }),
    ).toBeVisible()
    await expect(page.getByTestId('zen-pitch-canvas')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Playhead' })).toHaveCount(0)

    await page.getByRole('button', { name: 'Close' }).click()
    await expect(stage).toHaveCount(0)
  })

  test('loads authored cues, guide copy and target controls', async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await prepare(page)
    await openZen(page, 'mah-meh-mee-moh-moo')

    await expect(page.getByText('Mah Meh Mee Moh Moo').first()).toBeVisible()
    await expect(page.getByText('Hear pronunciation and tone')).toBeVisible()
    await expect(
      page.getByRole('group', { name: 'Target note visibility' }),
    ).toBeVisible()
    await expect(page.getByRole('button', { name: 'Dim' })).toBeVisible()

    const example = page.locator('[data-example-audio-state]')
    await expect(example.locator('canvas')).toHaveCount(1)
    await example.click()
    await expect(example).toHaveAttribute('data-example-audio-state', 'playing')
    await expect
      .poll(async () =>
        Number(await example.getAttribute('data-example-audio-progress')),
      )
      .toBeGreaterThan(0)
    await example.click()
    await expect(example).toHaveAttribute('data-example-audio-state', 'paused')

    await page.screenshot({
      path: testInfo.outputPath('zen-exercise-desktop.png'),
      fullPage: true,
    })

    await page.keyboard.press('Escape')
    await expect(page.getByTestId('zen-pitch-stage')).toHaveCount(0)
  })

  test('uses a one-time guide sheet on a phone viewport', async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await prepare(page)
    await openZen(page, 'ng-five-tone')

    await expect(
      page.getByRole('dialog', { name: 'Practice guide' }),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Begin practice' }),
    ).toBeVisible()
    await page.screenshot({
      path: testInfo.outputPath('zen-exercise-mobile-guide.png'),
      fullPage: true,
    })
    await page.getByRole('button', { name: 'Close practice guide' }).click()
    await expect(
      page.getByRole('dialog', { name: 'Practice guide' }),
    ).toHaveCount(0)
    await expect(page.getByTestId('zen-pitch-canvas')).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Open practice guide' }),
    ).toBeVisible()

    await page.screenshot({
      path: testInfo.outputPath('zen-exercise-mobile.png'),
      fullPage: true,
    })
  })
})
