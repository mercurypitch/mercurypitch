import { describe, expect, it } from 'vitest'
import { createPitchCanvasScale, midiToPitchCanvasRow, PITCH_VISUAL_COLORS, pitchCanvasRowToMidi, } from '@/features/stem-mixer/pitch-canvas-visuals'

describe('Stem Mixer pitch canvas visuals', () => {
  it('folds octaves only in the normal playback view', () => {
    const scale = createPitchCanvasScale(false, [60, 72])

    expect(scale.octaveAware).toBe(false)
    expect(scale.rowCount).toBe(12)
    expect(midiToPitchCanvasRow(60, scale)).toBe(
      midiToPitchCanvasRow(72, scale),
    )
  })

  it('keeps octave-separated notes on distinct Pitch Studio rows', () => {
    const scale = createPitchCanvasScale(true, [60, 72])

    expect(scale.octaveAware).toBe(true)
    expect(scale.minMidi).toBeLessThanOrEqual(60)
    expect(scale.maxMidi).toBeGreaterThanOrEqual(72)
    expect(midiToPitchCanvasRow(60, scale)).not.toBe(
      midiToPitchCanvasRow(72, scale),
    )
  })

  it('round-trips editor rows and supplies a useful empty range', () => {
    const scale = createPitchCanvasScale(true, [])

    expect(scale.rowCount).toBeGreaterThanOrEqual(18)
    expect(scale.minMidi).toBeLessThanOrEqual(48)
    expect(scale.maxMidi).toBeGreaterThanOrEqual(72)

    const row = midiToPitchCanvasRow(64, scale)
    expect(pitchCanvasRowToMidi(row, scale)).toBe(64)
  })

  it('uses stable layer semantics for the reference and singer', () => {
    expect(PITCH_VISUAL_COLORS.reference).toBe('#f59e0b')
    expect(PITCH_VISUAL_COLORS.singer).toBe('#a78bfa')
  })
})
