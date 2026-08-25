// Guitar Night live-tuner smoke coverage protects enabled contrast and capture continuity.
// ============================================================

import { expect, test } from '@playwright/test'
import { fakeMicArgs, writeToneWav } from './helpers/tone-wav'

const TUNER_TONE_WAV = writeToneWav(82.41)

test.use({
  launchOptions: { args: fakeMicArgs(TUNER_TONE_WAV) },
  permissions: ['microphone'],
  viewport: { width: 800, height: 1280 },
  hasTouch: true,
  isMobile: true,
})

test('keeps live listening legible and engaged across tuner choices @smoke', async ({
  page,
}) => {
  await page.goto('/guitar-night', { waitUntil: 'domcontentloaded' })
  await page.locator('[data-entry="tuner"]').click()

  const tuner = page.getByTestId('guitar-night-tuner')
  await tuner.getByRole('button', { name: 'Start listening' }).click()
  const stopListening = tuner.getByRole('button', { name: 'Stop listening' })
  await expect(stopListening).toBeVisible()

  // A pointer can remain over a tapped control on hybrid and touch browsers.
  // Its active state must still own both foreground and background.
  await stopListening.hover()
  const contrast = await stopListening.evaluate((control) => {
    const parseRgb = (value: string): [number, number, number] => {
      const channels = value
        .match(/[\d.]+/g)
        ?.slice(0, 3)
        .map(Number)
      if (channels === undefined || channels.length !== 3) return [0, 0, 0]
      return [channels[0] ?? 0, channels[1] ?? 0, channels[2] ?? 0]
    }
    const luminance = ([red, green, blue]: [number, number, number]) => {
      const linear = [red, green, blue].map((channel) => {
        const encoded = channel / 255
        return encoded <= 0.04045
          ? encoded / 12.92
          : Math.pow((encoded + 0.055) / 1.055, 2.4)
      })
      return (
        (linear[0] ?? 0) * 0.2126 +
        (linear[1] ?? 0) * 0.7152 +
        (linear[2] ?? 0) * 0.0722
      )
    }
    const label = control.querySelector('span') ?? control
    const foreground = luminance(parseRgb(getComputedStyle(label).color))
    const background = luminance(
      parseRgb(getComputedStyle(control).backgroundColor),
    )
    return (
      (Math.max(foreground, background) + 0.05) /
      (Math.min(foreground, background) + 0.05)
    )
  })
  expect(contrast).toBeGreaterThanOrEqual(4.5)

  await tuner.getByRole('button', { name: 'Manual' }).click()
  await expect(stopListening).toBeVisible()
  await tuner.getByRole('button', { name: 'Auto' }).click()
  await expect(stopListening).toBeVisible()

  await tuner
    .getByRole('button', {
      name: 'String 6, E2, 82.41 Hz, play reference',
    })
    .click()
  await expect(stopListening).toBeVisible()
  await expect(
    tuner.getByRole('button', { name: 'Stop E2 reference' }),
  ).toBeVisible()

  await expect(
    tuner.getByRole('button', { name: 'Hear E2 reference' }),
  ).toBeVisible({ timeout: 5_000 })
  await expect(stopListening).toBeVisible()

  await tuner.getByRole('button', { name: 'Direct input' }).click()
  await expect(stopListening).toBeVisible()
})
