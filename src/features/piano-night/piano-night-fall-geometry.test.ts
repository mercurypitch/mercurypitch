// ============================================================
// Piano Night fall geometry tests — transport-aligned duration bars
// ============================================================

import { describe, expect, it } from 'vitest'
import { PIANO_NIGHT_FALL_TRAVEL_PERCENT_PER_BEAT, pianoNightFallAnchorBeat, pianoNightFallGeometry, pianoNightFallStaticBottomPercent, pianoNightFallTrackTranslationPercent, pianoNightFallWindow, } from './piano-night-fall-geometry'

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

  it('preserves exact note geometry across a track-anchor rollover', () => {
    const startBeat = 12

    for (const playheadBeat of [3.999, 4, 7.999, 8]) {
      const anchorBeat = pianoNightFallAnchorBeat(playheadBeat)
      const staticBottom = pianoNightFallStaticBottomPercent(
        startBeat,
        anchorBeat,
      )
      const translation = pianoNightFallTrackTranslationPercent(
        playheadBeat,
        anchorBeat,
      )
      const composedBottom = staticBottom - translation

      expect(composedBottom).toBeCloseTo(
        pianoNightFallGeometry(startBeat, 2, playheadBeat).bottomPercent,
      )
    }
  })

  it('keeps a bounded window while retaining long sustains', () => {
    const denseScore = Array.from({ length: 10_000 }, (_, index) => ({
      id: index,
      startBeat: index / 10,
      duration: 0.5,
    }))
    const longSustain = {
      id: 'long-sustain',
      startBeat: 14,
      duration: 12,
    }
    const window = pianoNightFallWindow([...denseScore, longSustain], 20)

    expect(window).toContain(longSustain)
    expect(window.length).toBeLessThan(200)
    expect(window.every((note) => note.startBeat <= 37)).toBe(true)
    expect(window.every((note) => note.startBeat + note.duration > 19)).toBe(
      true,
    )
  })
})
