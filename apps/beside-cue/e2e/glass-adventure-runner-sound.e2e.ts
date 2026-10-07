// Runner settings acceptance — real controls, independent saved mix and explicit resume gestures.
import { expect, test } from '@playwright/test'
import { expectGameHudVisibility, expectGameMaterialFramesFit, } from './helpers/glass-ui-settings'
import { installRunnerVoice } from './helpers/runner-voice-fixture'
import { useRunnerControlsRenderer } from './helpers/runner-controls-renderer'

for (const viewport of [
  { width: 320, height: 640 },
  { width: 390, height: 844 },
  { width: 740, height: 320 },
  { width: 1440, height: 900 },
]) {
  test(`runner settings controls ${viewport.width}px @smoke`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport)
    // This control/focus test uses real DOM, transport and captured PCM. Actual
    // GPU scene captures separately verify the shared material in its host.
    await useRunnerControlsRenderer(page)
    await installRunnerVoice(page, true)
    await page.addInitScript(() => {
      localStorage.setItem(
        'beside-cue:glass-adventure:runner-audio:v1',
        JSON.stringify({
          musicVolume: 0.35,
          guideVolume: 0.65,
          musicMuted: false,
        }),
      )
      localStorage.setItem(
        'beside-cue:glass-adventure:museum-audio:v1',
        JSON.stringify({
          musicVolume: 0.2,
          ambienceVolume: 0.4,
          muted: false,
        }),
      )
    })
    await page.goto('/glass-game/?layout=singing-current')
    const runner = page.getByTestId('song-runner')
    const start = page.getByRole('button', { name: 'Start course' })
    await expect(start).toBeEnabled({ timeout: 90_000 })
    const headerTrigger = page
      .locator('header')
      .getByRole('button', { name: 'Open settings' })
    const chrome = await headerTrigger.evaluate((el) => {
      const rect = el.getBoundingClientRect()
      const icon = el
        .querySelector('[data-game-icon="settings"]')!
        .getBoundingClientRect()
      const surface = el.querySelector('[data-game-surface]')!
      return {
        width: rect.width,
        height: rect.height,
        icon: { width: icon.width, height: icon.height },
        color: getComputedStyle(surface).color,
        inside: rect.left >= 0 && rect.right <= innerWidth,
      }
    })
    expect(chrome.width).toBeGreaterThanOrEqual(44)
    expect(chrome.height).toBeGreaterThanOrEqual(44)
    expect(chrome.color).toBe('rgb(21, 59, 67)')
    expect(chrome.icon).toEqual({ width: 24, height: 24 })
    expect(chrome.inside).toBe(true)
    const triggerSurface = headerTrigger.locator('[data-game-surface]')
    await expectGameMaterialFramesFit(headerTrigger)
    const triggerFrame = triggerSurface.locator(':scope > [data-game-frame]')
    await expect(triggerFrame).toBeVisible()
    await expect(triggerFrame).toHaveAttribute('data-game-frame', 'tile')
    await expect(triggerFrame).toHaveAttribute('data-frame-finish', 'facet')
    expect(await triggerFrame.boundingBox()).toEqual(
      await triggerSurface.boundingBox(),
    )
    expect(
      await page.getByRole('button', { name: 'Pause course' }).count(),
    ).toBe(0)
    const setup = page.getByRole('dialog', { name: 'Ready when you are' })
    const setupBox = (await setup.boundingBox())!
    const headerBox = (await page
      .locator('header[data-game-hud]')
      .boundingBox())!
    expect(setupBox.y).toBeGreaterThanOrEqual(
      headerBox.y + headerBox.height + 4,
    )
    const entry = setup.getByRole('button', { name: 'Settings', exact: true })
    await expect(start).toBeFocused()
    for (
      let i = 0;
      i < 12 && !(await entry.evaluate((el) => el === document.activeElement));
      i++
    )
      await page.keyboard.press('Tab')
    await expect(entry).toBeFocused()
    await expectGameHudVisibility(page, true)
    await page.keyboard.press('Enter')
    const settings = page.getByRole('dialog', { name: 'Settings', exact: true })
    await expect(settings).toBeVisible()
    await expectGameHudVisibility(page, false)
    const layout = await settings.evaluate((el) => {
      const bounds = el.getBoundingClientRect()
      return {
        inside:
          bounds.left >= 0 &&
          bounds.right <= innerWidth &&
          bounds.top >= 0 &&
          bounds.bottom <= innerHeight,
      }
    })
    expect(layout.inside).toBe(true)
    const settingsSurface = settings.locator(':scope > [data-game-surface]')
    await expectGameMaterialFramesFit(settings)
    const settingsFrame = settingsSurface.locator(':scope > [data-game-frame]')
    await expect(settingsFrame).toBeVisible()
    await expect(settingsFrame).toHaveAttribute('data-frame-finish', 'facet')
    expect(await settingsFrame.boundingBox()).toEqual(
      await settingsSurface.boundingBox(),
    )
    await page.screenshot({ path: testInfo.outputPath('settings-sound.png') })
    const music = settings.getByRole('slider', { name: 'Music volume' })
    const note = settings.getByRole('slider', { name: 'Note example volume' })
    const sliderBox = (await music.boundingBox())!
    await music.click({
      position: { x: sliderBox.width * 0.7, y: sliderBox.height / 2 },
    })
    expect(Number(await music.inputValue())).toBeGreaterThan(50)
    const guide = await note.inputValue()
    await settings.getByRole('button', { name: 'Mute music' }).click()
    await expect(note).toHaveValue(guide)
    const prefs = await page.evaluate(() => ({
      runner: JSON.parse(
        localStorage.getItem('beside-cue:glass-adventure:runner-audio:v1')!,
      ),
      museum: JSON.parse(
        localStorage.getItem('beside-cue:glass-adventure:museum-audio:v1')!,
      ),
    }))
    expect(prefs.runner.musicMuted).toBe(true)
    expect(prefs.runner.guideVolume).toBe(Number(guide) / 100)
    expect(prefs.museum).toEqual({
      musicVolume: 0.2,
      ambienceVolume: 0.4,
      muted: false,
    })
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab')
      expect(
        await settings.evaluate((el) => el.contains(document.activeElement)),
      ).toBe(true)
    }
    await page.keyboard.press('Escape')
    await expect(settings).not.toBeVisible()
    await expectGameHudVisibility(page, true)
    await expect(start).toBeFocused()
    expect(await page.evaluate(() => window.runnerVoiceFixture.requests)).toBe(
      0,
    )
    await start.click()
    await expect(runner).toHaveAttribute('data-phase', 'running', {
      timeout: 15_000,
    })
    await page.screenshot({
      path: testInfo.outputPath('host-controls-running.png'),
    })
    await headerTrigger.click()
    await expect(settings).toBeVisible()
    await expectGameHudVisibility(page, false)
    await expect(runner).toHaveAttribute('data-phase', 'paused')
    await expect(runner).toHaveAttribute('data-microphone', 'closed')
    await expect(
      page.getByRole('dialog', { name: 'Course paused' }),
    ).toHaveCount(0)
    const marker = page.getByTestId('runner-controls-presentation')
    const retainedScene = await marker.elementHandle()
    const requests = await page.evaluate(
      () => window.runnerVoiceFixture.requests,
    )
    await settings.getByRole('tab', { name: 'Display', exact: true }).click()
    await settings.getByRole('button', { name: 'High', exact: true }).click()
    await expect(marker).toHaveAttribute('data-render-quality', 'high')
    await settings.getByRole('button', { name: 'Celadon', exact: true }).click()
    await expect(page.locator('[data-game-theme]')).toHaveAttribute(
      'data-game-theme',
      'dark',
    )
    await expect(settingsFrame).toHaveAttribute('data-frame-finish', 'enamel')
    await expectGameMaterialFramesFit(settings)
    expect(await settingsFrame.boundingBox()).toEqual(
      await settingsSurface.boundingBox(),
    )
    expect(await retainedScene!.evaluate((node) => node.isConnected)).toBe(true)
    expect(await page.evaluate(() => window.runnerVoiceFixture.requests)).toBe(
      requests,
    )
    await expect(runner).toHaveAttribute('data-phase', 'paused')
    await page.screenshot({
      path: testInfo.outputPath('settings-display-dark.png'),
    })
    await page.keyboard.press('Escape')
    await expect(settings).not.toBeVisible()
    await expectGameHudVisibility(page, true)
    await expect(runner).toHaveAttribute('data-phase', 'running', {
      timeout: 15_000,
    })
    await expect(runner).toHaveAttribute('data-microphone', 'ready')
    await headerTrigger.click()
    await settings.getByRole('tab', { name: 'Play', exact: true }).click()
    await settings
      .getByRole('button', { name: 'Change note', exact: true })
      .click()
    await expect(settings).not.toBeVisible()
    await expectGameHudVisibility(page, true)
    await expect(
      page.getByRole('slider', { name: 'Comfortable note' }),
    ).toBeFocused()
    await expect(runner).toHaveAttribute('data-phase', 'paused')
    await expect(
      page
        .getByRole('dialog', { name: 'Course paused' })
        .getByRole('button', { name: 'Resume', exact: true }),
    ).toBeEnabled()
    await page.evaluate(() => window.runnerVoiceFixture.dispose())
  })
}
