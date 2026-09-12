// Guitar Night track-picker regressions keep unavailable scoring choices explained.
// ============================================================

import { devices, expect, test } from '@playwright/test'
import { seedAuthoredGuitarScore } from './helpers/guitar-night-score'

for (const touch of [false, true]) {
  test.describe(touch ? 'phone track picker' : 'desktop track picker', () => {
    test.use(
      touch
        ? {
            viewport: devices['Pixel 7'].viewport,
            isMobile: true,
            hasTouch: true,
          }
        : { viewport: { width: 1280, height: 900 } },
    )

    test('explains drum backing without changing the scored part @smoke', async ({
      page,
    }, testInfo) => {
      const songId = 'guitar-track-picker-with-drums'
      await seedAuthoredGuitarScore(page, songId, true, { percussion: true })
      await page.goto(`/guitar-night?song=${songId}`, {
        waitUntil: 'domcontentloaded',
      })
      await page
        .getByRole('button', { name: 'Load a song', exact: true })
        .click()

      const picker = page.getByRole('group', { name: 'Visible part' })
      const drums = picker.getByRole('button', { name: /Studio Drums/ })
      const lead = picker.getByRole('button', {
        name: 'Lead guitar',
        exact: true,
      })
      const rhythm = picker.getByRole('button', {
        name: 'Rhythm guitar',
        exact: true,
      })
      await expect(drums).toContainText('Backing only')
      await expect(lead).toHaveAttribute('aria-pressed', 'true')
      // The drum chip is an explanation, not a selectable scoring target.
      await expect(drums).not.toHaveAttribute('aria-pressed')

      if (touch) await drums.tap()
      else await drums.hover()

      const explanation = page.getByRole('tooltip')
      await expect(explanation).toContainText(
        'Drum tracks cannot be scored in Guitar Night',
      )
      await expect(explanation).toContainText('Drum Night')
      await expect(lead).toHaveAttribute('aria-pressed', 'true')
      await expect(drums).toHaveAccessibleDescription(
        /Drum tracks cannot be scored/,
      )
      const bounds = await explanation.boundingBox()
      expect(bounds).not.toBeNull()
      expect(bounds!.x).toBeGreaterThanOrEqual(0)
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(
        page.viewportSize()!.width,
      )
      await expect(explanation).not.toHaveCSS(
        'background-color',
        'rgba(0, 0, 0, 0)',
      )
      await expect(explanation).toHaveCSS('opacity', '1')
      await page.screenshot({
        path: testInfo.outputPath('drum-scoring-explanation.png'),
      })

      await page.keyboard.press('Escape')
      await expect(explanation).toHaveCount(0)
      if (!touch) {
        await page.mouse.move(1, 1)
        await drums.focus()
        await page.keyboard.press('Enter')
        await expect(explanation).toBeVisible()
      }
      await rhythm.click()
      await expect(explanation).toHaveCount(0)
      await expect(rhythm).toHaveAttribute('aria-pressed', 'true')
      await expect(lead).toHaveAttribute('aria-pressed', 'false')

      await page
        .getByRole('button', { name: 'Practice with tab', exact: true })
        .click()
      const room = page.getByTestId('guitar-night-score-room')
      await room.getByTestId('guitar-night-session-trigger').click()
      const mixer = page.getByRole('dialog', { name: /^Track mixer for / })
      // Drums still have their separate, working stage-follow action in the mixer.
      const followDrums = mixer
        .getByTestId('guitar-night-session-track')
        .filter({ hasText: 'Studio Drums' })
      await expect(followDrums).toBeEnabled()
      await followDrums.click()
      await expect(mixer).toHaveCount(0)
      await room.getByTestId('guitar-night-session-trigger').click()
      await expect(followDrums).toHaveAttribute('aria-pressed', 'true')
      await expect(
        mixer
          .getByTestId('guitar-night-session-track')
          .filter({ hasText: 'Rhythm guitar' }),
      ).toContainText('scored')
    })
  })
}
