import { describe, expect, it } from 'vitest'
import type { DetectedPitch } from '@/lib/pitch-detector'
import { BRIDGE_FRAMES, createPitchSmoother, MEDIAN_WINDOW, SMOOTH_MIN_CLARITY, } from './jam-pitch-smoothing'

function frame(frequency: number, clarity = 0.9): DetectedPitch {
  return { frequency, clarity, noteName: 'C', octave: 4, cents: 0 }
}

const SILENCE = frame(0, 0)

describe('createPitchSmoother', () => {
  it('shows nothing before anyone sings', () => {
    const s = createPitchSmoother()
    expect(s.push(SILENCE)).toBeNull()
    expect(s.push(null)).toBeNull()
  })

  it('passes a steady note through unchanged', () => {
    const s = createPitchSmoother()
    for (let i = 0; i < MEDIAN_WINDOW; i++) s.push(frame(440))
    expect(s.push(frame(440))?.frequency).toBeCloseTo(440, 6)
  })

  it('swallows a single octave flicker', () => {
    // One frame at double the pitch is the classic YIN slip. Raw, it
    // threw the trail an octave for a frame; the median never sees it.
    const s = createPitchSmoother()
    for (let i = 0; i < MEDIAN_WINDOW; i++) s.push(frame(220))
    const out = s.push(frame(440))
    expect(out?.frequency).toBeCloseTo(220, 6)
  })

  it('still follows a real slide', () => {
    const s = createPitchSmoother()
    let last = 0
    for (const f of [220, 233, 247, 262, 277, 294, 311]) {
      last = s.push(frame(f))?.frequency ?? 0
    }
    // Lagging behind the median window is expected; being stuck is not.
    expect(last).toBeGreaterThan(247)
  })

  it('renames the note to match the smoothed pitch', () => {
    const s = createPitchSmoother()
    for (let i = 0; i < MEDIAN_WINDOW; i++) s.push(frame(440))
    const out = s.push(frame(440))
    expect(out?.noteName).toBe('A')
    expect(out?.octave).toBe(4)
    expect(out?.midi).toBe(69)
    expect(Math.abs(out?.cents ?? 99)).toBeLessThan(5)
  })

  it('holds the last pitch across a consonant', () => {
    const s = createPitchSmoother()
    for (let i = 0; i < MEDIAN_WINDOW; i++) s.push(frame(330))
    for (let i = 0; i < BRIDGE_FRAMES; i++) {
      expect(s.push(SILENCE)?.frequency).toBeCloseTo(330, 6)
    }
  })

  it('lets go once the singer has actually stopped', () => {
    const s = createPitchSmoother()
    s.push(frame(330))
    for (let i = 0; i < BRIDGE_FRAMES; i++) s.push(SILENCE)
    expect(s.push(SILENCE)).toBeNull()
  })

  it('treats a mumble as silence, not as a reading', () => {
    const s = createPitchSmoother()
    const out = s.push(frame(440, SMOOTH_MIN_CLARITY - 0.01))
    expect(out).toBeNull()
  })

  it('forgets the held pitch on reset', () => {
    const s = createPitchSmoother()
    s.push(frame(330))
    s.reset()
    expect(s.push(SILENCE)).toBeNull()
  })
})
