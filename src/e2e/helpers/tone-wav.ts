// ============================================================
// Synthetic microphone input for e2e
// ============================================================
//
// Chromium's plain fake audio device produces silence, which
// `src/lib/voice-session.ts` correctly rejects as an unusable input —
// that check exists so the onboarding never runs its script against a
// dead mic. To exercise the mic-dependent beats at all, the browser has
// to be fed a real periodic signal via --use-file-for-fake-audio-capture.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

/** 220 Hz is A3, comfortably inside the detector's 60–1600 Hz window. */
export const TONE_HZ = 220
export const TONE_NOTE = 'A3'

/**
 * A sine plus two harmonics, 16-bit mono PCM at 48 kHz.
 *
 * The harmonics are not decoration: YIN locks far more reliably onto a
 * signal with some spectral content than onto a bare sine, and a take
 * the detector cannot lock means the test fails for a reason that has
 * nothing to do with the code under test.
 *
 * Chromium loops the file, so a few seconds covers a whole voiceprint.
 */
export function writeToneWav(hz: number = TONE_HZ, seconds = 5): string {
  const rate = 48000
  const samples = rate * seconds
  const buf = Buffer.alloc(44 + samples * 2)
  buf.write('RIFF', 0)
  buf.writeUInt32LE(36 + samples * 2, 4)
  buf.write('WAVE', 8)
  buf.write('fmt ', 12)
  buf.writeUInt32LE(16, 16)
  buf.writeUInt16LE(1, 20) // PCM
  buf.writeUInt16LE(1, 22) // mono
  buf.writeUInt32LE(rate, 24)
  buf.writeUInt32LE(rate * 2, 28)
  buf.writeUInt16LE(2, 32)
  buf.writeUInt16LE(16, 34)
  buf.write('data', 36)
  buf.writeUInt32LE(samples * 2, 40)

  for (let i = 0; i < samples; i++) {
    const t = i / rate
    const v =
      0.5 * Math.sin(2 * Math.PI * hz * t) +
      0.2 * Math.sin(4 * Math.PI * hz * t) +
      0.1 * Math.sin(6 * Math.PI * hz * t)
    const s = Math.max(-32768, Math.min(32767, Math.round(v * 26000)))
    buf.writeInt16LE(s, 44 + i * 2)
  }

  const file = path.join(os.tmpdir(), `mercurypitch-e2e-tone-${hz}.wav`)
  fs.writeFileSync(file, buf)
  return file
}

/** Chromium flags that route the generated tone into getUserMedia. */
export function fakeMicArgs(wavPath: string): string[] {
  return [
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    `--use-file-for-fake-audio-capture=${wavPath}`,
  ]
}

/**
 * A visitor who has never been here: no seen-flags, e2e hooks exposed.
 *
 * The clear happens ONCE per browser context, guarded by a sessionStorage
 * marker. `addInitScript` runs before every navigation — including
 * reloads — so an unguarded clear would wipe the seen-flag on every load
 * and make "skipping sticks across a reload" impossible to pass however
 * the app behaved.
 */
export const FRESH_VISITOR_INIT = () => {
  ;(window as unknown as { E2E_TEST_MODE?: boolean }).E2E_TEST_MODE = true
  try {
    if (sessionStorage.getItem('e2e.onboarding.reset') === '1') return
    sessionStorage.setItem('e2e.onboarding.reset', '1')
    localStorage.removeItem('pitchperfect_welcome_version')
    localStorage.removeItem('pitchperfect_onboarding_done')
  } catch {
    /* storage blocked — the door shows anyway */
  }
}
