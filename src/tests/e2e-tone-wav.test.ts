// ============================================================
// The e2e fake-mic tone is per-duration, not one shared file
// ============================================================
//
// `writeToneWav` named its file after the frequency alone. Every caller uses
// 220 Hz, but they ask for four different lengths — 1s (karaoke-results-mobile),
// 5s (the default, five specs), 8s (stem-mixer-lyrics-short-viewport) and 20s
// (guided-voice-check, admin-exercise-audio, lrc-word-markers) — and each call
// runs at module load, when Playwright loads spec files to collect tests.
//
// With `fullyParallel` and four workers that is a race over one path: whichever
// worker wrote last decided what every other spec's microphone played. A spec
// that asked for 20 seconds could be handed a 1-second tone.

import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { writeToneWav } from '@/e2e/helpers/tone-wav'

/** 44-byte WAV header, then 16-bit mono samples at 48 kHz. */
function toneSeconds(file: string): number {
  return (fs.statSync(file).size - 44) / 2 / 48000
}

describe('writeToneWav', () => {
  it('gives each duration its own path at the same frequency', () => {
    expect(writeToneWav(220, 1)).not.toBe(writeToneWav(220, 20))
  })

  it('leaves an already-written longer tone intact', () => {
    // The clobber, reproduced: a short-tone spec loading after a long-tone one
    // used to truncate the file the long-tone spec had already pinned.
    const long = writeToneWav(220, 20)
    writeToneWav(220, 1)

    expect(toneSeconds(long)).toBe(20)
  })

  it('writes the number of seconds it was asked for', () => {
    expect(toneSeconds(writeToneWav(220, 8))).toBe(8)
    expect(toneSeconds(writeToneWav(220))).toBe(5)
  })
})
