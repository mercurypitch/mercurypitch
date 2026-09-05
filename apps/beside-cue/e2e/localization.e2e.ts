// ============================================================
// Language preview — persistence and real compact-screen translated layouts
// ============================================================

import { expect, test } from '@playwright/test'
import { LOCALIZED_CHARACTER_VOICE_RECORDINGS } from '../src/content/localized-character-voice-recordings'

const LANGUAGES = [
  {
    id: 'es',
    settings: 'Ajustes',
    settingsTitle: 'Quédate solo con lo que te ayuda.',
    home: 'Tu disco actual',
    begin: 'Toca para empezar',
    continue: 'Continuar',
    sideB: 'Elegir la cara B',
    startRecord: 'Poner el disco en marcha',
    stopRecord: 'Detener y guardar el plan',
    reminder: 'Configurar recordatorio',
  },
  {
    id: 'de',
    settings: 'Einstellungen',
    settingsTitle: 'Behalte nur, was dir hilft.',
    home: 'Deine aktuelle Pressung',
    begin: 'Zum Starten tippen',
    continue: 'Weiter',
    sideB: 'Seite B wählen',
    startRecord: 'Schallplatte starten',
    stopRecord: 'Anhalten und Plan speichern',
    reminder: 'Erinnerung einstellen',
  },
] as const

for (const language of LANGUAGES) {
  test(`${language.id} onboarding plays localized speech and reaches the record at 200% text @smoke`, async ({
    page,
  }, info) => {
    test.setTimeout(150_000)
    await page.setViewportSize({ width: 320, height: 568 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    const voiceRequests: string[] = []
    page.on('request', (request) => {
      if (request.url().includes('/audio/voice/'))
        voiceRequests.push(request.url())
    })
    // Observe real decoded Web Audio buffers; do not bypass autoplay or stub playback.
    await page.addInitScript(() => {
      const observed = window as Window & {
        __localizedAudioStarts?: Array<{ duration: number; state: string }>
      }
      observed.__localizedAudioStarts = []
      const original = AudioBufferSourceNode.prototype.start
      AudioBufferSourceNode.prototype.start = function (...args) {
        observed.__localizedAudioStarts!.push({
          duration: this.buffer?.duration ?? 0,
          state: this.context.state,
        })
        return original.apply(this, args)
      }
    })
    await page.goto('/')
    await page
      .getByRole('combobox', { name: 'Choose interface language' })
      .selectOption(language.id)
    await expect(page.locator('html')).toHaveAttribute('lang', language.id)
    await page.addStyleTag({ content: 'html { font-size: 200% !important; }' })
    const begin = page.getByRole('button', {
      name: language.begin,
      exact: true,
    })
    await begin.scrollIntoViewIfNeeded()
    await begin.click()
    await expect(page.getByRole('combobox')).toHaveCount(0)

    const greeting = LOCALIZED_CHARACTER_VOICE_RECORDINGS[language.id].find(
      (recording) => recording.lineId === 'corky.onboarding.greeting',
    )!
    await expect
      .poll(() =>
        voiceRequests.some((url) => url.includes(greeting.sources[0].src)),
      )
      .toBe(true)
    await expect
      .poll(async () =>
        page.evaluate((durationMs) => {
          const observed = window as Window & {
            __localizedAudioStarts?: Array<{ duration: number; state: string }>
          }
          return (
            observed.__localizedAudioStarts?.some(
              (start) =>
                start.state === 'running' &&
                Math.abs(start.duration * 1000 - durationMs) < 100,
            ) ?? false
          )
        }, greeting.sources[0].durationMs),
      )
      .toBe(true)

    const director = page.locator('main[data-phase]')
    for (const [phase, actionName] of [
      ['B03_PULL_CHOICE_HOLD', language.continue],
      ['B04_CUE_CONTEXT_HOLD', language.sideB],
      ['B05_SIDE_B_CHOICE_HOLD', language.startRecord],
    ] as const) {
      await expect(director).toHaveAttribute('data-phase', phase, {
        timeout: 30_000,
      })
      const label = page
        .locator('label')
        .filter({ has: page.getByRole('radio') })
        .first()
      await label.scrollIntoViewIfNeeded()
      await label.click()
      await expect(page.getByRole('radio').first()).toBeChecked()
      const action = page.getByRole('button', { name: actionName, exact: true })
      await action.scrollIntoViewIfNeeded()
      await expect(action).toBeEnabled()
      const box = await action.boundingBox()
      expect(box!.width).toBeGreaterThanOrEqual(48)
      expect(box!.height).toBeGreaterThanOrEqual(48)
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(320)
      await page.screenshot({ path: info.outputPath(`${phase}.png`) })
      await action.click()
    }
    const stop = page.getByRole('button', {
      name: language.stopRecord,
      exact: true,
    })
    await expect(stop).toBeVisible({ timeout: 30_000 })
    await stop.click()
    await expect(director).toHaveAttribute('data-phase', 'B07_REMINDER_HOLD', {
      timeout: 30_000,
    })
    const reminder = page.getByRole('button', {
      name: language.reminder,
      exact: true,
    })
    await reminder.scrollIntoViewIfNeeded()
    await expect(reminder).toBeVisible()
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(320)
    await page.screenshot({ path: info.outputPath('reminder-200.png') })
    expect(voiceRequests.length).toBeGreaterThan(1)
    expect(
      voiceRequests.every((url) =>
        url.includes(`/audio/voice/${language.id}/`),
      ),
    ).toBe(true)
  })

  for (const textZoom of [100, 200]) {
    test(`${language.id} persists at 320px and ${textZoom}% text @smoke`, async ({
      page,
    }, info) => {
      await page.setViewportSize({ width: 320, height: 568 })
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.goto('/?devSeed')
      await page.getByRole('button', { name: 'Settings', exact: true }).click()
      await page
        .getByRole('combobox', { name: 'Choose interface language' })
        .selectOption(language.id)
      await expect(page.locator('html')).toHaveAttribute('lang', language.id)
      await expect(
        page.getByRole('heading', {
          name: language.settingsTitle,
          exact: true,
        }),
      ).toBeVisible()
      await page.addStyleTag({
        content: `html { font-size: ${textZoom}% !important; }`,
      })
      const selector = page.getByRole('combobox')
      await selector.scrollIntoViewIfNeeded()
      const box = await selector.boundingBox()
      expect(box).not.toBeNull()
      expect(box!.width).toBeGreaterThanOrEqual(48)
      expect(box!.height).toBeGreaterThanOrEqual(48)
      expect(box!.x).toBeGreaterThanOrEqual(0)
      expect(box!.x + box!.width).toBeLessThanOrEqual(320)
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(320)
      // The app clips horizontal overflow, so document width alone misses
      // translated status text and headings that have fallen off the screen.
      const clippedSettingsContent = await page
        .locator('.settings-screen')
        .evaluate((root) => {
          const frame = root.getBoundingClientRect()
          const padding = getComputedStyle(root)
          const left = frame.left + Number.parseFloat(padding.paddingLeft)
          const right = frame.right - Number.parseFloat(padding.paddingRight)
          return [
            ...root.querySelectorAll(
              '.app-header, .app-header > :not([aria-hidden="true"]), .settings-group__heading, .settings-group__heading > *, .settings-group h2, .settings-row, .custom-time > button',
            ),
          ].flatMap((element) => {
            const bounds = element.getBoundingClientRect()
            if (
              bounds.left >= left - 1 &&
              bounds.right <= right + 1 &&
              element.scrollWidth <= element.clientWidth + 2
            )
              return []
            return [
              {
                text: element.textContent,
                left: bounds.left,
                right: bounds.right,
                scrollWidth: element.scrollWidth,
                clientWidth: element.clientWidth,
              },
            ]
          })
        })
      expect(clippedSettingsContent).toEqual([])
      const back = page.locator('.settings-screen .app-header button').first()
      const backBox = (await back.boundingBox())!
      expect(backBox.width).toBeGreaterThanOrEqual(48)
      expect(backBox.height).toBeGreaterThanOrEqual(48)
      await page.screenshot({ path: info.outputPath('settings-language.png') })

      // The URL seed must not overwrite the existing snapshot on reload.
      await page.reload()
      await page.addStyleTag({
        content: `html { font-size: ${textZoom}% !important; }`,
      })
      await expect(page.locator('html')).toHaveAttribute('lang', language.id)
      await expect(
        page.getByRole('heading', { name: language.home }),
      ).toBeVisible()
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(320)
      await page.screenshot({ path: info.outputPath('home-language.png') })
      const settingsBox = (await page
        .getByRole('button', { name: language.settings, exact: true })
        .boundingBox())!
      const soundBox = (await page
        .locator('.app-header button[aria-pressed]')
        .boundingBox())!
      expect(
        Math.abs(
          settingsBox.y +
            settingsBox.height / 2 -
            soundBox.y -
            soundBox.height / 2,
        ),
      ).toBeLessThanOrEqual(1)
      expect(settingsBox.x + settingsBox.width + 8).toBeLessThanOrEqual(
        soundBox.x,
      )
      await page
        .getByRole('button', { name: language.settings, exact: true })
        .click()
      await expect(page.getByRole('combobox')).toHaveValue(language.id)
    })
  }
}
