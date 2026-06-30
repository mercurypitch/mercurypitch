import { describe, expect, it } from 'vitest'
import { freqToMidiFloat, midiFloatToFreq } from './log-pitch'

describe('log-pitch', () => {
  it('maps A4 (440 Hz) to MIDI 69', () => {
    expect(freqToMidiFloat(440)).toBeCloseTo(69, 6)
  })

  it('is the inverse of midiFloatToFreq', () => {
    for (const midi of [40, 48, 57, 60, 69, 72.5, 81]) {
      expect(freqToMidiFloat(midiFloatToFreq(midi))).toBeCloseTo(midi, 6)
    }
  })

  it('treats an octave as a uniform +/-12 step', () => {
    const a3 = freqToMidiFloat(220)
    const a4 = freqToMidiFloat(440)
    const a5 = freqToMidiFloat(880)
    expect(a4 - a3).toBeCloseTo(12, 6)
    expect(a5 - a4).toBeCloseTo(12, 6)
  })

  it('does not round (keeps fractional pitch)', () => {
    // 15 cents sharp of A4.
    const f = 440 * Math.pow(2, 0.15 / 12)
    expect(freqToMidiFloat(f)).toBeCloseTo(69.15, 4)
  })
})
