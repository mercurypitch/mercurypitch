import { describe, expect, it } from 'vitest'
import { freqToExactMidi, scoreNoteAccuracy, scoreNoteInRange, } from '@/features/exercises/exercise-scoring-utils'

/** Build samples singing `midi` across [startSec, endSec) at ~20Hz. */
function sing(
  midi: number,
  startSec: number,
  endSec: number,
  centsOff = 0,
): Array<{ freq: number; time: number; cents: number }> {
  const samples = []
  const freq = 440 * Math.pow(2, (midi + centsOff / 100 - 69) / 12)
  for (let t = startSec; t < endSec; t += 0.05) {
    samples.push({ freq, time: t, cents: centsOff })
  }
  return samples
}

describe('scoreNoteInRange (echo-mode slot scoring)', () => {
  it('scores a perfectly sung slot at 100', () => {
    const history = sing(60, 1.0, 2.0)
    expect(scoreNoteInRange(history, 60, 1.0, 2.0)).toBe(100)
  })

  it('only sees samples inside its slot', () => {
    // Perfect C4 in slot 1, perfect E4 in slot 2.
    const history = [...sing(60, 0, 1.0), ...sing(64, 1.0, 2.0)]
    expect(scoreNoteInRange(history, 60, 0, 1.0)).toBe(100)
    expect(scoreNoteInRange(history, 64, 1.0, 2.0)).toBe(100)
    // Asking slot 2 for C4 must NOT pick up slot 1's C4 samples.
    expect(scoreNoteInRange(history, 60, 1.0, 2.0)).toBeLessThan(20)
  })

  it('right notes in the wrong order do not score (the call-response flaw)', () => {
    // Phrase C4→E4 but the singer swaps them: E4 first, then C4.
    const history = [...sing(64, 0, 1.0), ...sing(60, 1.0, 2.0)]
    const slot1 = scoreNoteInRange(history, 60, 0, 1.0) // expected C4, sang E4
    const slot2 = scoreNoteInRange(history, 64, 1.0, 2.0) // expected E4, sang C4
    expect(slot1).toBe(0) // 400 cents off → floored
    expect(slot2).toBe(0)
  })

  it('graduates with cents deviation like the note-by-note formula', () => {
    const history = sing(60, 0, 1.0, 20) // 20 cents sharp
    // 100 − 20×1.5 = 70
    expect(scoreNoteInRange(history, 60, 0, 1.0)).toBe(70)
  })

  it('empty slot scores 0', () => {
    const history = sing(60, 0, 1.0)
    expect(scoreNoteInRange(history, 60, 5.0, 6.0)).toBe(0)
  })

  it('stays consistent with scoreNoteAccuracy on the same material', () => {
    const history = sing(62, 0, 2.0, 10)
    const trailing = scoreNoteAccuracy(history, 62, 2000)
    const ranged = scoreNoteInRange(history, 62, 0, 2.0)
    expect(ranged).toBe(trailing)
  })

  it('freqToExactMidi round-trips the synthetic samples', () => {
    const [s] = sing(69, 0, 0.1)
    expect(freqToExactMidi(s.freq)).toBeCloseTo(69, 5)
  })
})
