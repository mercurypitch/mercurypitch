// Songbook host proof — lazy real audio, exclusive playback, and readable phone/tablet/desktop controls.
import { expect, test } from '@playwright/test'

for (const viewport of [
  { width: 360, height: 780 },
  { width: 820, height: 1180 },
  { width: 1280, height: 900 },
]) {
  test(`songbook auditions fit ${viewport.width}px and play only the selected take @smoke`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport)
    let audioRequests = 0
    page.on('request', (request) => {
      if (
        request.url().includes('/adventure-voice-v7/') &&
        request.url().endsWith('.mp3')
      )
        audioRequests++
    })
    await page.goto('/glass-game/?lab=songbook')
    await expect(
      page.getByRole('heading', { name: 'Merc’s little songbook' }),
    ).toBeVisible()
    const cards = page
      .getByRole('region', { name: 'Song sketches' })
      .locator('article')
    await expect(cards).toHaveCount(6)
    expect(audioRequests).toBe(0)
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
    for (const button of await cards.getByRole('button').all()) {
      const box = await button.boundingBox()
      expect(box?.height).toBeGreaterThanOrEqual(44)
      expect(box!.x).toBeGreaterThanOrEqual(0)
      expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width)
    }
    const sung = page.getByRole('button', {
      name: 'Play Merc sings: Let it shine',
    })
    await sung.click()
    await expect(
      page.getByRole('button', { name: 'Stop Merc sings: Let it shine' }),
    ).toHaveText('Stop')
    expect(audioRequests).toBe(1)
    await page
      .getByRole('button', { name: 'Play Guide singer: Let it shine' })
      .click()
    await expect(
      page.getByRole('button', { name: 'Stop Guide singer: Let it shine' }),
    ).toHaveText('Stop')
    await expect(sung).toHaveAttribute('aria-pressed', 'false')
    await expect(page.locator('button[aria-pressed="true"]')).toHaveCount(1)
    expect(audioRequests).toBe(2)
    await page
      .getByRole('button', { name: 'Stop Guide singer: Let it shine' })
      .click()
    await expect(page.locator('button[aria-pressed="true"]')).toHaveCount(0)
    await page.screenshot({
      path: test.info().outputPath(`songbook-${viewport.width}.png`),
      fullPage: true,
    })
  })
}
