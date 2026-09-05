// ============================================================
// Home header — one safe-area row for Settings and the sound control
// ============================================================
// Chromium does not emulate a native status-bar inset. Override the app's
// shared safe-area token and measure the real layout, not CSS source text.

import { expect, test } from '@playwright/test'

for (const scenario of [
  { name: 'ordinary web', width: 320, height: 568, insetTop: 0 },
  { name: 'iPhone notch', width: 390, height: 844, insetTop: 44 },
  { name: 'iPhone Dynamic Island', width: 393, height: 852, insetTop: 59 },
]) {
  test(`Home sound shares the safe Settings row: ${scenario.name} @smoke`, async ({
    page,
  }, info) => {
    await page.setViewportSize({
      width: scenario.width,
      height: scenario.height,
    })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/?devSeed')
    await page.addStyleTag({
      content: `:root { --safe-top: max(1rem, ${scenario.insetTop}px); }`,
    })

    const home = page.getByRole('main')
    const settings = home.getByRole('button', {
      name: 'Settings',
      exact: true,
    })
    const sound = home.getByRole('button', {
      name: /^(Mute|Unmute) audio$/,
    })
    await expect(settings).toBeVisible()
    await expect(sound).toBeVisible()
    const settingsBox = (await settings.boundingBox())!
    const soundBox = (await sound.boundingBox())!
    const safeTop = Math.max(16, scenario.insetTop)

    expect(soundBox.y).toBeGreaterThanOrEqual(safeTop)
    expect(settingsBox.y).toBeGreaterThanOrEqual(safeTop)
    expect(
      Math.abs(
        soundBox.y +
          soundBox.height / 2 -
          (settingsBox.y + settingsBox.height / 2),
      ),
    ).toBeLessThanOrEqual(1)
    expect(soundBox.height).toBeGreaterThanOrEqual(48)
    expect(soundBox.width).toBeGreaterThanOrEqual(48)
    expect(settingsBox.height).toBeGreaterThanOrEqual(48)
    expect(soundBox.x).toBeGreaterThanOrEqual(
      settingsBox.x + settingsBox.width + 8,
    )
    expect(soundBox.x + soundBox.width).toBeLessThanOrEqual(scenario.width - 16)
    await page.screenshot({ path: info.outputPath('home-safe-header.png') })

    const wasMuted = await sound.getAttribute('aria-pressed')
    await sound.click()
    await expect(sound).toHaveAttribute(
      'aria-pressed',
      wasMuted === 'true' ? 'false' : 'true',
    )
    await settings.click()
    await expect(
      page.getByRole('region', { name: 'BeSideCue Pro' }),
    ).toBeVisible()
  })
}
