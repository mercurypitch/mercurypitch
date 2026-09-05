import { expect, test } from '@playwright/test'

for (const viewport of [
  { width: 390, height: 667 },
  { width: 375, height: 600 },
]) {
  test(`cinematic picture reaches both portrait edges ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport)
    await page.goto('/')
    await page.getByRole('button', { name: 'Tap to begin' }).click()
    // Decorative video has no accessible name; its media target identifies the
    // actual playback surface rather than an unrelated full-width page wrapper.
    const video = page.locator('[data-v2-media-kind="video"] video').first()
    await expect(video).toBeVisible()
    const box = await video.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.x).toBeCloseTo(0, 0)
    expect(box!.x + box!.width).toBeCloseTo(viewport.width, 0)
    expect(
      await video.evaluate((node) => getComputedStyle(node).objectFit),
    ).toBe('cover')
  })
}
