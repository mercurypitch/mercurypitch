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

/** 16-bit mono PCM at 48 kHz, from a level per sample (−1 to 1 of 26000). */
const RATE = 48000

function wavOf(samples: number, level: (i: number) => number): Buffer {
  const buf = Buffer.alloc(44 + samples * 2)
  buf.write('RIFF', 0)
  buf.writeUInt32LE(36 + samples * 2, 4)
  buf.write('WAVE', 8)
  buf.write('fmt ', 12)
  buf.writeUInt32LE(16, 16)
  buf.writeUInt16LE(1, 20) // PCM
  buf.writeUInt16LE(1, 22) // mono
  buf.writeUInt32LE(RATE, 24)
  buf.writeUInt32LE(RATE * 2, 28)
  buf.writeUInt16LE(2, 32)
  buf.writeUInt16LE(16, 34)
  buf.write('data', 36)
  buf.writeUInt32LE(samples * 2, 40)
  for (let i = 0; i < samples; i++) {
    const s = Math.max(-32768, Math.min(32767, Math.round(level(i) * 26000)))
    buf.writeInt16LE(s, 44 + i * 2)
  }
  return buf
}

/** A sine and two harmonics at `phase` (radians of the fundamental). */
const voice = (phase: number): number =>
  0.5 * Math.sin(phase) + 0.2 * Math.sin(2 * phase) + 0.1 * Math.sin(3 * phase)

/**
 * Writes `buf` to a file named `name` in the temp folder: beside it, then
 * renamed into place, never written over. Every worker that loads a spec
 * writes the same file at module load, and a plain write truncates it
 * first, so a worker that read it back in that moment got a short file --
 * and a song that would not load. Measured 2026-10-11: six processes
 * writing and reading one path at once came back short in 358 of 900
 * reads, and in none once renamed. A rename swaps in a whole file, and a
 * reader keeps whichever one it opened.
 */
function place(name: string, buf: Buffer): string {
  const file = path.join(os.tmpdir(), name)
  const scratch = `${file}.${process.pid}.tmp`
  fs.writeFileSync(scratch, buf)
  fs.renameSync(scratch, file)
  return file
}

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
  const buf = wavOf(RATE * seconds, (i) => voice((2 * Math.PI * hz * i) / RATE))
  // The length is part of the name. Callers ask for four different lengths at
  // 220 Hz, all at module load, and Playwright loads spec files across four
  // parallel workers — keying on frequency alone let a 1-second spec truncate
  // the 20-second file `guided-voice-check` had already pinned, so its capture
  // ran out of microphone mid-take and failed the task-completion gate.
  return place(`mercurypitch-e2e-tone-${hz}-${seconds}s.wav`, buf)
}

/**
 * A siren: the same tone gliding from `fromHz` up to `toHz` in
 * `secondsEachWay`, and back down in as long, even in semitones (an
 * exponential sweep in hertz), with no pause at either end. Chromium loops
 * the file, so it sings one siren after another, and a take that never
 * falls quiet runs its full length and holds a whole turn at each end from
 * any starting point (Lesson 7's WEB-SPEC, Tests).
 */
export function writeGlideWav(
  fromHz: number,
  toHz: number,
  secondsEachWay: number,
): string {
  const half = Math.round(RATE * secondsEachWay)
  const ratio = Math.log(toHz / fromHz)
  let phase = 0
  const buf = wavOf(2 * half, (i) => {
    // up for the first half, down for the second, evenly in log frequency
    const u = i < half ? i / half : (2 * half - i) / half
    phase += (2 * Math.PI * fromHz * Math.exp(ratio * u)) / RATE
    return voice(phase)
  })
  return place(
    `mercurypitch-e2e-glide-${fromHz}-${toHz}-${secondsEachWay}s.wav`,
    buf,
  )
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
