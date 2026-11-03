// ============================================================
// Pitch testing rate — a 48 kHz decode read by 44.1 kHz detectors
// ============================================================
//
// The Lab builds its detectors once, at their default 44100 Hz, and most
// browsers decode at 48000 Hz. These hold the two halves of keeping the two
// apart: the pitch of what is analysed, and the clock its windows are read on.

import { describe, expect, it } from 'vitest'
import { YINDetector } from '@/lib/pitch-algorithms'
import { LAB_ANALYSIS_RATE, toLabAnalysisRate } from './pitch-testing-rate'

const DECODE_RATE = 48000

function sine(hz: number, sampleRate: number, seconds: number): Float32Array {
  const out = new Float32Array(Math.round(sampleRate * seconds))
  for (let i = 0; i < out.length; i++) {
    out[i] = 0.8 * Math.sin((2 * Math.PI * hz * i) / sampleRate)
  }
  return out
}

const cents = (actual: number, expected: number): number =>
  1200 * Math.log2(actual / expected)

describe('toLabAnalysisRate', () => {
  it('lets the Lab read a vocal stem decoded at 48 kHz at the pitch it was sung', () => {
    const decoded = sine(440, DECODE_RATE, 0.25)

    const analysed = toLabAnalysisRate(decoded, DECODE_RATE)
    const result = new YINDetector().detect(analysed.subarray(0, 2048))

    // Read at the decode rate the same A4 came out near 404 Hz: G#4.
    expect(result).not.toBeNull()
    expect(Math.abs(cents(result!.frequency, 440))).toBeLessThan(10)
  })

  it('keeps the length of the audio when windows are timed at the Lab rate', () => {
    const decoded = sine(220, DECODE_RATE, 3)

    const analysed = toLabAnalysisRate(decoded, DECODE_RATE)

    // Three seconds stay three seconds on the Lab's clock, so a note sung at
    // the end of a song is stamped at the end, not 8% early.
    expect(analysed.length / LAB_ANALYSIS_RATE).toBeCloseTo(3, 3)
  })

  it('hands a waveform already at the Lab rate back untouched', () => {
    const decoded = sine(220, LAB_ANALYSIS_RATE, 0.1)

    expect(toLabAnalysisRate(decoded, LAB_ANALYSIS_RATE)).toBe(decoded)
  })
})
