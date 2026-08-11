// ============================================================
// Piano Night fall geometry tests — transport-aligned duration bars
// ============================================================

import { describe, expect, it } from 'vitest'
import { PIANO_NIGHT_FALL_TRAVEL_PERCENT_PER_BEAT, pianoNightFallGeometry, } from './piano-night-fall-geometry'

describe('pianoNightFallGeometry', () => {
  it('places the leading edge on the keyboard at note-on', () => {
    const geometry = pianoNightFallGeometry(8, 3.7, 8)

    expect(geometry.bottomPercent).toBe(0)
    expect(geometry.heightPercent).toBeCloseTo(
      3.7 * PIANO_NIGHT_FALL_TRAVEL_PERCENT_PER_BEAT,
    )
    expect(geometry.striking).toBe(true)
    expect(geometry.visible).toBe(true)
  })

  it('places the trailing edge on the keyboard at note-off', () => {
    const duration = 0.78
    const justBeforeRelease = pianoNightFallGeometry(
      12,
      duration,
      12 + duration - 0.001,
    )
    const trailingEdge =
      justBeforeRelease.bottomPercent + justBeforeRelease.heightPercent

    expect(trailingEdge).toBeCloseTo(
      0.001 * PIANO_NIGHT_FALL_TRAVEL_PERCENT_PER_BEAT,
    )
    expect(justBeforeRelease.striking).toBe(true)

    const released = pianoNightFallGeometry(12, duration, 12 + duration)
    expect(released.bottomPercent + released.heightPercent).toBeCloseTo(0)
    expect(released.striking).toBe(false)
    expect(released.visible).toBe(false)
  })

  it('moves duration bars at the same spatial rate at every beat', () => {
    const first = pianoNightFallGeometry(16, 2, 10)
    const second = pianoNightFallGeometry(16, 2, 11)

    expect(first.bottomPercent - second.bottomPercent).toBeCloseTo(
      PIANO_NIGHT_FALL_TRAVEL_PERCENT_PER_BEAT,
    )
    expect(first.heightPercent).toBe(second.heightPercent)
  })
})
