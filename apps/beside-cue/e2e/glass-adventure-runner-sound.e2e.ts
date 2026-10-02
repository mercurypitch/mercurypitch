// Runner sound acceptance — real host controls, saved independent mix and keyboard-safe modal transitions.
import { expect, test } from '@playwright/test'
import { installRunnerVoice } from './helpers/runner-voice-fixture'

for (const viewport of [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
]) {
  test(`runner sound controls ${viewport.width}px @smoke`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport)
    await installRunnerVoice(page, true, { omitRaster: false })
    await page.addInitScript(() =>
      localStorage.setItem(
        'beside-cue:glass-adventure:runner-audio:v1',
        JSON.stringify({
          musicVolume: 0.35,
          guideVolume: 0.65,
          musicMuted: false,
        }),
      ),
    )
    await page.goto('/glass-game/?layout=singing-current')
    const runner = page.getByTestId('song-runner')
    const start = page.getByRole('button', { name: 'Start course' })
    await expect(start).toBeEnabled({ timeout: 90_000 })
    const headerTrigger = page
      .locator('header')
      .getByRole('button', { name: 'Sound / tune' })
    const chrome = await headerTrigger.evaluate((el) => {
      const rect = el.getBoundingClientRect(),
        style = getComputedStyle(el)
      const svg = el.querySelector('svg')!.getBoundingClientRect()
      return {
        width: rect.width,
        height: rect.height,
        color: style.color,
        radius: style.borderRadius,
        icon: svg.width,
        inside: rect.left >= 0 && rect.right <= innerWidth,
      }
    })
    expect(chrome.width).toBeGreaterThanOrEqual(44)
    expect(chrome.height).toBeGreaterThanOrEqual(44)
    expect(chrome.color).toBe('rgb(36, 77, 81)')
    expect(chrome.radius).toBe('13px')
    expect(chrome.icon).toBe(24)
    expect(chrome.inside).toBe(true)
    // Keyboard focus starts in the actual trapped setup dialog.
    const setup = page.getByRole('dialog', { name: 'Ready when you are' })
    const entry = setup.getByRole('button', { name: 'Sound / tune' })
    await expect(entry).toBeVisible()
    await start.focus()
    for (
      let i = 0;
      i < 12 && !(await entry.evaluate((el) => el === document.activeElement));
      i++
    )
      await page.keyboard.press('Tab')
    await expect(entry).toBeFocused()
    await page.keyboard.press('Enter')
    const sound = page.getByRole('dialog', { name: 'Sound / tune' })
    await expect(sound).toBeVisible()
    const panelStyle = await sound.evaluate((el) => {
      const r = el.getBoundingClientRect(),
        s = getComputedStyle(el)
      return {
        background: s.backgroundColor,
        width: r.width,
        inside:
          r.left >= 0 &&
          r.right <= innerWidth &&
          r.top >= 0 &&
          r.bottom <= innerHeight,
      }
    })
    expect(panelStyle.background).toBe('rgb(255, 253, 247)')
    expect(panelStyle.inside).toBe(true)
    await page.screenshot({ path: testInfo.outputPath('sound-panel.png') })
    const music = sound.getByRole('slider', { name: 'Music volume' })
    const note = sound.getByRole('slider', { name: 'Note example volume' })
    const sliderBox = (await music.boundingBox())!
    await page.mouse.click(
      sliderBox.x + sliderBox.width * 0.7,
      sliderBox.y + sliderBox.height / 2,
    )
    expect(Number(await music.inputValue())).toBeGreaterThan(50)
    const guide = await note.inputValue()
    await sound.getByRole('button', { name: 'Mute music' }).click()
    await expect(note).toHaveValue(guide)
    const prefs = await page.evaluate(() =>
      JSON.parse(
        localStorage.getItem('beside-cue:glass-adventure:runner-audio:v1')!,
      ),
    )
    expect(prefs.musicMuted).toBe(true)
    expect(prefs.guideVolume).toBe(Number(guide) / 100)
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab')
      expect(
        await sound.evaluate((el) => el.contains(document.activeElement)),
      ).toBe(true)
    }
    await page.keyboard.press('Escape')
    await expect(sound).not.toBeVisible()
    await expect(entry).toBeFocused()
    await start.click()
    await expect(runner).toHaveAttribute('data-phase', 'running', {
      timeout: 15_000,
    })
    await page.screenshot({ path: testInfo.outputPath('host-running.png') })
    await headerTrigger.click()
    await expect(sound).toBeVisible()
    await expect(runner).toHaveAttribute('data-phase', 'paused')
    await expect(sound).not.toContainText("backing music couldn't load")
    await page.keyboard.press('Escape')
    await expect(sound).not.toBeVisible()
    const paused = page.getByRole('dialog', { name: 'Course paused' })
    await expect
      .poll(() => paused.evaluate((el) => el.contains(document.activeElement)))
      .toBe(true)
    await paused.getByRole('button', { name: 'Sound / tune' }).click()
    await expect(sound).toBeVisible()
    await sound
      .getByRole('button', { name: 'Change note', exact: true })
      .click()
    await expect(sound).not.toBeVisible()
    await expect(
      page.getByRole('slider', { name: 'Comfortable note' }),
    ).toBeFocused()
    await expect(
      paused.getByRole('button', { name: 'Resume', exact: true }),
    ).toBeEnabled()
    await page.evaluate(() => window.runnerVoiceFixture.dispose())
  })
}
