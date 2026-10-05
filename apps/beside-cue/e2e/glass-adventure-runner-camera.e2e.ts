// Runner camera choices preserve the live visit while switching the presentation in Tune.
import { expect, test } from '@playwright/test'
import { installRunnerVoice } from './helpers/runner-voice-fixture'
import { useRunnerControlsRenderer } from './helpers/runner-controls-renderer'

for (const viewport of [
  { width: 390, height: 844 },
  { width: 844, height: 310 },
]) {
  test(`runner view choice preserves the visit ${viewport.width}px @smoke`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport)
    await useRunnerControlsRenderer(page)
    await installRunnerVoice(page, true)
    await page.goto(
      '/glass-game/?layout=singing-current&steering=continuous&camera=angled',
    )
    const runner = page.getByTestId('song-runner')
    await expect(
      page.getByRole('button', { name: 'Start course' }),
    ).toBeEnabled({ timeout: 90000 })
    await expect(runner).toHaveAttribute(
      'data-camera-profile',
      'steering-angled',
    )
    await page.getByRole('button', { name: 'Start course' }).click()
    await expect(runner).toHaveAttribute('data-phase', 'running', {
      timeout: 15000,
    })
    await page
      .locator('header')
      .getByRole('button', { name: 'Sound / tune' })
      .click()
    const tune = page.getByRole('dialog', { name: 'Sound / tune' })
    await expect(tune).toBeVisible()
    await expect(runner).toHaveAttribute('data-phase', 'paused')
    const seconds = await runner.getAttribute('data-course-seconds')
    const marker = page.getByTestId('runner-controls-presentation')
    await marker.evaluate((node) => {
      node.setAttribute('data-original-visit', 'true')
    })
    for (const [label, profile] of [
      ['Closer', 'steering-close'],
      ['Standard', 'responsive-close'],
      ['Angled', 'steering-angled'],
    ]) {
      const button = tune.getByRole('button', { name: label, exact: true })
      await button.click()
      await expect(button).toHaveAttribute('aria-pressed', 'true')
      await expect(runner).toHaveAttribute('data-camera-profile', profile)
      await expect(marker).toHaveAttribute('data-camera-profile', profile)
      await expect(marker).toHaveAttribute('data-original-visit', 'true')
      await expect(runner).toHaveAttribute('data-course-seconds', seconds!)
      await expect(runner).toHaveAttribute('data-phase', 'paused')
    }
    await page.keyboard.press('Escape')
    await expect(tune).not.toBeVisible()
    await page.getByRole('button', { name: 'Resume', exact: true }).click()
    await expect(runner).toHaveAttribute('data-phase', 'running')
    await expect
      .poll(async () =>
        Number(await runner.getAttribute('data-course-seconds')),
      )
      .toBeGreaterThan(Number(seconds))
    await expect(marker).toHaveAttribute('data-original-visit', 'true')
    await page.evaluate(() => window.runnerVoiceFixture.dispose())
  })
}
