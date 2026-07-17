// ============================================================
// Glass calibration — ceiling detection and target selection.
// ============================================================

import { describe, expect, it } from 'vitest'
import { GLASS_CONFIG } from './config'
import { computeTarget } from './target'
import { sequence, silence, tone } from './test-frames'

describe('computeTarget', () => {
  it('finds the ceiling of a clean glide and offsets the target below it', () => {
    // A "glide": half-second steps up an octave, ending sustained at C5 (72).
    const frames = sequence(
      (t) => tone(60, 0.5, { startT: t }),
      (t) => tone(64, 0.5, { startT: t }),
      (t) => tone(67, 0.5, { startT: t }),
      (t) => tone(70, 0.5, { startT: t }),
      (t) => tone(72, 0.8, { startT: t }),
    )
    const result = computeTarget(frames)
    expect(result.ok).toBe(true)
    expect(result.ceilingMidi).toBe(72)
    expect(result.targetMidi).toBe(72 + GLASS_CONFIG.target.offsetSemitones)
  })

  it('ignores a brushed top note that was not sustained long enough', () => {
    const frames = sequence(
      (t) => tone(60, 1.2, { startT: t }),
      (t) => tone(65, 1.2, { startT: t }),
      // Two frames at C6 — a squeak, well under ceilingSustainMs.
      (t) => tone(84, 2 / 60, { startT: t }),
    )
    const result = computeTarget(frames)
    expect(result.ceilingMidi).toBe(65)
  })

  it('rejects a glide with too little voiced audio and offers the median fallback', () => {
    const frames = sequence(
      (t) => tone(62, 0.6, { startT: t }),
      (t) => silence(4, t),
    )
    const result = computeTarget(frames)
    expect(result.ok).toBe(false)
    expect(result.medianMidi).toBe(62)
    expect(result.fallbackTargetMidi).toBe(
      62 + GLASS_CONFIG.calibration.fallbackOffsetFromMedian,
    )
  })

  it('rejects a glide that never left one note (span too narrow)', () => {
    const result = computeTarget(tone(64, 5))
    expect(result.ok).toBe(false)
    expect(result.spanSemitones).toBe(0)
    // The sustained note still yields a ceiling — just not a trusted one.
    expect(result.ceilingMidi).toBe(64)
  })

  it('does not count breath gaps as dwell', () => {
    const withGap = sequence(
      (t) => tone(60, 0.5, { startT: t }),
      (t) => silence(3, t),
      (t) => tone(60, 0.5, { startT: t }),
    )
    const continuous = tone(60, 1)
    const gapDwell = computeTarget(withGap).voicedSeconds
    const contDwell = computeTarget(continuous).voicedSeconds
    expect(gapDwell).toBeLessThan(contDwell + 0.2)
  })

  it('returns nulls on an empty or fully unvoiced take', () => {
    const result = computeTarget(silence(3))
    expect(result.ok).toBe(false)
    expect(result.ceilingMidi).toBeNull()
    expect(result.targetMidi).toBeNull()
    expect(result.medianMidi).toBeNull()
    expect(result.fallbackTargetMidi).toBeNull()
  })
})
