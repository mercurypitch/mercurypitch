// Synthesized microphone audio reaches Top Shelf through the real detector.

import { expect, test } from '@playwright/test'
import { enter, read, shoot } from './shelf-hook'

declare global {
  interface Window {
    __shelfAudio?: {
      setMidi(midi: number | null): void
      tracks: MediaStreamTrack[]
    }
  }
}

test.use({ permissions: ['microphone'] })

test('a microphone fifth climbs through the detector and records silent frames', async ({
  page,
}, info) => {
  test.setTimeout(120_000)
  // Substitute capture only. Web Audio, the worklet, F0 detector, sing
  // driver and slide tracker are real; never call the sing(midi) hook.
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      const ctx = new AudioContext()
      await ctx.resume()
      const oscillator = ctx.createOscillator()
      const gain = ctx.createGain()
      const output = ctx.createMediaStreamDestination()
      oscillator.type = 'sine'
      oscillator.frequency.value = 220
      gain.gain.value = 0
      oscillator.connect(gain).connect(output)
      oscillator.start()
      const tracks = output.stream.getTracks()
      window.__shelfAudio = {
        tracks,
        setMidi(midi) {
          gain.gain.value = midi === null ? 0 : 0.2
          if (midi !== null)
            oscillator.frequency.value = 440 * 2 ** ((midi - 69) / 12)
        },
      }
      return output.stream
    }
  })
  await enter(page)
  await page.getByRole('button', { name: 'Walk in', exact: true }).click()
  await expect(
    page.getByRole('img', { name: 'Interval above your held note' }),
  ).toBeVisible()
  await expect
    .poll(() => page.evaluate(() => window.__w3s!().perf.load.f0 ?? 0), {
      timeout: 30_000,
    })
    .toBeGreaterThan(0)
  expect((await read(page)).reference).toBeNull()
  expect((await read(page)).leaps).toBe(0)

  await page.evaluate(() => window.__shelfAudio!.setMidi(57))
  await expect
    .poll(async () => Math.abs(((await read(page)).reference ?? 0) - 57), {
      timeout: 20_000,
    })
    .toBeLessThan(0.15)
  await page.evaluate(() => window.__shelfAudio!.setMidi(64))
  await expect
    .poll(async () => (await read(page)).shelf, { timeout: 20_000 })
    .toBe(1)
  expect((await read(page)).leaps).toBe(1)
  await shoot(page, info, 'shelf-audio-fifth-landed')

  await page.getByRole('button', { name: 'Leave', exact: true }).click()
  await expect
    .poll(() => page.evaluate(() => window.__w3s === undefined))
    .toBe(true)
  await expect
    .poll(
      () =>
        page.evaluate(() =>
          window.__shelfAudio!.tracks.every(
            (track) => track.readyState === 'ended',
          ),
        ),
      { timeout: 10_000 },
    )
    .toBe(true)
})
