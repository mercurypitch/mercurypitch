// Runner icon material — compact Settings keeps its live cog centered inside the painted tile.
import { expect, test } from '@playwright/test'
import { expectGameMaterialFramesFit } from './helpers/glass-ui-settings'

test.use({ hasTouch: true })
test.setTimeout(120_000)

test('runner Settings cog stays centered in both themes and compact hosts @smoke', async ({
  page,
}, testInfo) => {
  await page.addInitScript(() => {
    localStorage.setItem('beside-cue:glass-adventure:comfortable-note', '61')
  })
  await page.goto('/glass-game/?layout=singing-current')
  await expect(
    page.getByRole('button', { name: 'Start course', exact: true }),
  ).toBeEnabled({ timeout: 60_000 })
  const trigger = page.getByRole('button', {
    name: 'Open settings',
    exact: true,
  })
  const settings = page.getByRole('dialog', { name: 'Settings', exact: true })
  for (const theme of ['Crystal', 'Celadon']) {
    await trigger.tap()
    await settings.getByRole('tab', { name: 'Display', exact: true }).tap()
    await settings.getByRole('button', { name: theme, exact: true }).tap()
    await settings
      .getByRole('button', { name: 'Close settings', exact: true })
      .tap()
    for (const viewport of [
      { width: 320, height: 568 },
      { width: 390, height: 844 },
      { width: 844, height: 390 },
      { width: 1024, height: 768 },
      { width: 1440, height: 900 },
    ]) {
      await page.setViewportSize(viewport)
      await expectGameMaterialFramesFit(trigger)
      await page.screenshot({
        path: testInfo.outputPath(`runner-cog-${theme}-${viewport.width}.png`),
      })
      await expect
        .poll(() =>
          trigger.evaluate((button) => {
            const touch = button.getBoundingClientRect()
            const tile = button
              .querySelector('[data-game-surface="tile"]')!
              .getBoundingClientRect()
            const icon = button
              .querySelector('[data-game-icon="settings"]')!
              .getBoundingClientRect()
            return {
              target: Math.min(touch.width, touch.height),
              tileOffset: Math.max(
                Math.abs(tile.x - touch.x),
                Math.abs(tile.y - touch.y),
                Math.abs(tile.width - touch.width),
                Math.abs(tile.height - touch.height),
              ),
              centerOffset: Math.max(
                Math.abs(icon.x + icon.width / 2 - tile.x - tile.width / 2),
                Math.abs(icon.y + icon.height / 2 - tile.y - tile.height / 2),
              ),
            }
          }),
        )
        .toEqual({ target: 44, tileOffset: 0, centerOffset: 0 })
      await trigger.tap()
      await expect(settings).toBeVisible()
      await settings
        .getByRole('button', { name: 'Close settings', exact: true })
        .tap()
    }
  }
})
