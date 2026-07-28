import { describe, expect, it } from 'vitest'
import { MIN_VOICED_FRAMES, settledNote, } from '@/features/onboarding/settled-note'
import type { F0Frame } from '@/lib/mirror/metrics'

const HOP = 0.016

/** A steady tone at `hz`, `count` frames long, starting at `t0`. */
function tone(hz: number, count: number, t0 = 0, conf = 0.95): F0Frame[] {
  return Array.from({ length: count }, (_, i) => ({
    t: t0 + i * HOP,
    f0: hz,
    conf,
  }))
}

const silence = (count: number, t0 = 0): F0Frame[] =>
  Array.from({ length: count }, (_, i) => ({ t: t0 + i * HOP, f0: 0, conf: 0 }))

// A4 = 440 Hz, G3 = 196 Hz, C4 = 261.63 Hz.
describe('settledNote', () => {
  it('names a steady A4', () => {
    const note = settledNote(tone(440, 120))
    expect(note?.note).toBe('A4')
    expect(note?.midi).toBe(69)
    expect(note?.hz).toBeCloseTo(440, 0)
  })

  it('names a steady G3', () => {
    expect(settledNote(tone(196, 120))?.note).toBe('G3')
  })

  it('returns null for silence rather than guessing', () => {
    expect(settledNote(silence(120))).toBeNull()
  })

  it('returns null for an empty take', () => {
    expect(settledNote([])).toBeNull()
  })

  it('returns null when there is too little voiced material', () => {
    expect(settledNote(tone(440, MIN_VOICED_FRAMES - 1))).toBeNull()
  })

  it('ignores a slid attack and names where the voice settled', () => {
    // Half a second sliding up from G3, then a long steady A4.
    const slide = Array.from({ length: 20 }, (_, i) => ({
      t: i * HOP,
      f0: 196 + i * 12,
      conf: 0.9,
    }))
    const held = tone(440, 140, 20 * HOP)
    expect(settledNote([...slide, ...held])?.note).toBe('A4')
  })

  it('falls back to all voiced frames when trimming leaves too little', () => {
    // A short take: trimming the onset would drop below the frame floor,
    // so it should still name the note rather than return null.
    const note = settledNote(tone(440, 30))
    expect(note?.note).toBe('A4')
  })

  it('survives unvoiced gaps in the middle of a hold', () => {
    const take = [
      ...tone(261.63, 50),
      ...silence(8, 50 * HOP),
      ...tone(261.63, 60, 58 * HOP),
    ]
    expect(settledNote(take)?.note).toBe('C4')
  })

  it('reports how much voiced material backed the reading', () => {
    const note = settledNote(tone(440, 120))
    expect(note?.voicedSeconds).toBeGreaterThan(0)
  })
})
