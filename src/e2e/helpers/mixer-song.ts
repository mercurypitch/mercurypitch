// A seeded song in the stem mixer, and the rail's moves a singer makes on it.
// ============================================================
//
// The song is a thirty-second sine in IndexedDB, so the real loader, decoder
// and transport run with no upload. The mic is a Web Audio stream standing
// in for the device; `blockMic` makes the next request fail, the way a
// browser's does when the person has blocked the mic.

import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'
import { dismissOverlays } from './ui'

interface SongSeed {
  seedSong: (input: {
    name: string
    fileHash: string
    vocalWavBase64: string
  }) => Promise<string>
}

/** A mono 8 kHz sine as a WAV, base64 for page.evaluate. */
export function toneWavBase64(seconds: number, hz: number): string {
  const rate = 8000
  const samples = Math.floor(rate * seconds)
  const buf = Buffer.alloc(44 + samples * 2)
  buf.write('RIFF', 0)
  buf.writeUInt32LE(36 + samples * 2, 4)
  buf.write('WAVE', 8)
  buf.write('fmt ', 12)
  buf.writeUInt32LE(16, 16)
  buf.writeUInt16LE(1, 20)
  buf.writeUInt16LE(1, 22)
  buf.writeUInt32LE(rate, 24)
  buf.writeUInt32LE(rate * 2, 28)
  buf.writeUInt16LE(2, 32)
  buf.writeUInt16LE(16, 34)
  buf.write('data', 36)
  buf.writeUInt32LE(samples * 2, 40)
  for (let index = 0; index < samples; index += 1) {
    buf.writeInt16LE(
      Math.round(Math.sin((2 * Math.PI * hz * index) / rate) * 8000),
      44 + index * 2,
    )
  }
  return buf.toString('base64')
}

export const RAIL_SONG = {
  name: 'Rail Layout Song',
  fileHash: 'rail-layout-song',
  vocalWavBase64: toneWavBase64(30, 220),
}

// The mic's own plumbing is not under test here; a Web Audio stream stands
// in for the device, as in stem-mixer-controls.spec.ts. `__micDenied` makes
// the next request fail as a blocked mic does.
const SYNTHETIC_MIC_INIT = () => {
  Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
    configurable: true,
    value: async () => {
      if ((window as unknown as { __micDenied?: boolean }).__micDenied) {
        throw new DOMException('Permission denied', 'NotAllowedError')
      }
      const context = new AudioContext()
      const oscillator = context.createOscillator()
      const destination = context.createMediaStreamDestination()
      oscillator.frequency.value = 220
      oscillator.connect(destination)
      oscillator.start()
      return destination.stream
    },
  })
}

/** From here on, the page's mic requests fail as a blocked mic's do, or
 *  (false) succeed again, as after the person allows it. */
export function blockMic(page: Page, blocked = true): Promise<void> {
  return page.evaluate((value) => {
    ;(window as unknown as { __micDenied?: boolean }).__micDenied = value
  }, blocked)
}

/** Seeds the song and opens it in the mixer; returns its session id. */
export async function openSeededSong(
  page: Page,
  viewport: { width: number; height: number },
): Promise<string> {
  await page.setViewportSize(viewport)
  await page.addInitScript(() => {
    ;(window as unknown as Record<string, unknown>).E2E_TEST_MODE = true
  })
  await page.addInitScript(SYNTHETIC_MIC_INIT)
  await page.goto('/')
  await dismissOverlays(page)
  await page.waitForFunction(
    () =>
      (window as unknown as { __ppSongSeed?: unknown }).__ppSongSeed !==
      undefined,
  )
  const sessionId = await page.evaluate((song) => {
    // The first-visit tour offer is a toast that sits on the rail at
    // 844x390 for ten seconds. It is not what these specs measure; mark it
    // already offered.
    localStorage.setItem('pitchperfect_mixer_tour_offered', 'true')
    return (
      window as unknown as { __ppSongSeed: SongSeed }
    ).__ppSongSeed.seedSong(song)
  }, RAIL_SONG)
  await page.goto(`/#/karaoke/session/${sessionId}/mixer`)
  await dismissOverlays(page)
  await expect(page.getByTestId('mixer-time-total')).toHaveText('0:30', {
    timeout: 20_000,
  })
  return sessionId
}

export const songPosition = (page: Page) =>
  page.getByRole('slider', { name: 'Song position' })

/** Where the playhead is, in seconds. */
export const playhead = (page: Page): Promise<number> =>
  songPosition(page).evaluate((element) =>
    Number((element as HTMLInputElement).value),
  )

/** Moves the playhead, the way the arrow keys or a drag would. */
export async function seek(page: Page, seconds: number): Promise<void> {
  await songPosition(page).fill(String(seconds))
  await expect.poll(() => playhead(page)).toBeCloseTo(seconds, 1)
}

/** Sets A and B with the rail's buttons, at the playhead. */
export async function setLoop(page: Page, a: number, b: number): Promise<void> {
  await seek(page, a)
  await page.getByRole('button', { name: 'Set loop start (A)' }).click()
  await seek(page, b)
  await page.getByRole('button', { name: 'Set loop end (B)' }).click()
  await expect(
    page.getByRole('button', { name: 'Set loop end (B)' }),
  ).toHaveAttribute('data-set', 'true')
}
