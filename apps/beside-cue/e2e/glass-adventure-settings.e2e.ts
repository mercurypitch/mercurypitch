// Gallery settings recovery — interrupted visits close safely before a fresh gameplay gesture.
import { expect, test } from '@playwright/test'
import { openMuseum, value } from './helpers/glass-adventure-controls'

for (const viewport of [
  { width: 393, height: 852 },
  { width: 740, height: 320 },
]) {
  test(`settings interruption preserves pause and fresh keyboard control at ${viewport.width}px @smoke`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport)
    await openMuseum(page, true)
    for (const gesture of ['Close settings', 'Resume', 'Escape']) {
      await page.getByRole('button', { name: 'Open settings' }).click()
      const settings = page.getByRole('dialog', {
        name: 'Settings',
        exact: true,
      })
      await expect(settings).toBeVisible()
      await page.evaluate(() => {
        window.dispatchEvent(new PageTransitionEvent('pagehide'))
        window.dispatchEvent(new PageTransitionEvent('pageshow'))
      })
      if (gesture === 'Escape') await page.keyboard.press('Escape')
      else
        await settings
          .getByRole('button', { name: gesture, exact: true })
          .click()
      await expect(settings).not.toBeVisible()
      const paused = page.getByRole('dialog', { name: 'Museum paused' })
      await expect(paused).toBeVisible()
      const resume = paused.getByRole('button', { name: 'Resume', exact: true })
      await expect(resume).toBeFocused()
      const start = {
        x: await value(page, 'player-x'),
        z: await value(page, 'player-z'),
      }
      await page.keyboard.down('KeyD')
      await page.clock.runFor(250)
      await page.keyboard.up('KeyD')
      expect(await value(page, 'player-x')).toBeCloseTo(start.x, 5)
      expect(await value(page, 'player-z')).toBeCloseTo(start.z, 5)
      if (gesture === 'Close settings')
        await page.screenshot({
          path: testInfo.outputPath('interrupted-settings.png'),
        })
      await resume.click()
      await expect(paused).not.toBeVisible()
      await page.keyboard.down('KeyD')
      await page.clock.runFor(250)
      await page.keyboard.up('KeyD')
      expect(
        Math.hypot(
          (await value(page, 'player-x')) - start.x,
          (await value(page, 'player-z')) - start.z,
        ),
      ).toBeGreaterThan(0.1)
    }
  })
}
