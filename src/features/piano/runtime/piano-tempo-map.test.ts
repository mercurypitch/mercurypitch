// ============================================================
// Piano tempo map tests — canonical boundaries and reversible score time
// ============================================================

import { describe, expect, it } from 'vitest'
import { compilePianoTempoMap, pianoTempoBeatToSeconds, pianoTempoBpmAtBeat, pianoTempoSecondsToBeat, } from './piano-tempo-map'

describe('compilePianoTempoMap', () => {
  it('supplies 120 BPM from beat zero until a later first authored event', () => {
    const tempoMap = compilePianoTempoMap([{ beat: 4, bpm: 90 }])

    expect(tempoMap).toEqual({
      initialTempoBpm: 120,
      points: [
        { beat: 0, bpm: 120, authoredSeconds: 0 },
        { beat: 4, bpm: 90, authoredSeconds: 2 },
      ],
    })
  })

  it('sorts boundaries, keeps the last same-beat event, and drops repeats', () => {
    const tempoMap = compilePianoTempoMap([
      { beat: 8, bpm: 72 },
      { beat: 0, bpm: 100 },
      { beat: 4, bpm: 90 },
      { beat: 4, bpm: 72 },
      { beat: 12, bpm: 72 },
      { beat: Number.NaN, bpm: 140 },
      { beat: 16, bpm: 0 },
    ])

    expect(tempoMap.points).toEqual([
      { beat: 0, bpm: 100, authoredSeconds: 0 },
      { beat: 4, bpm: 72, authoredSeconds: 2.4 },
    ])
    expect(Object.isFrozen(tempoMap)).toBe(true)
    expect(Object.isFrozen(tempoMap.points)).toBe(true)
    expect(Object.isFrozen(tempoMap.points[0])).toBe(true)
  })

  it('falls back to one 120 BPM point for an empty or invalid map', () => {
    expect(compilePianoTempoMap([])).toEqual({
      initialTempoBpm: 120,
      points: [{ beat: 0, bpm: 120, authoredSeconds: 0 }],
    })
    expect(compilePianoTempoMap([{ beat: -1, bpm: 80 }])).toEqual(
      compilePianoTempoMap([]),
    )
  })
})

describe('piano tempo conversion', () => {
  const tempoMap = compilePianoTempoMap([
    { beat: 0, bpm: 120 },
    { beat: 4, bpm: 60 },
    { beat: 6, bpm: 180 },
  ])

  it('integrates across every tempo boundary and resolves boundary BPMs', () => {
    expect(pianoTempoBeatToSeconds(tempoMap, 3)).toBeCloseTo(1.5)
    expect(pianoTempoBeatToSeconds(tempoMap, 4)).toBeCloseTo(2)
    expect(pianoTempoBeatToSeconds(tempoMap, 5)).toBeCloseTo(3)
    expect(pianoTempoBeatToSeconds(tempoMap, 6)).toBeCloseTo(4)
    expect(pianoTempoBeatToSeconds(tempoMap, 9)).toBeCloseTo(5)

    expect(pianoTempoBpmAtBeat(tempoMap, 3.999)).toBe(120)
    expect(pianoTempoBpmAtBeat(tempoMap, 4)).toBe(60)
    expect(pianoTempoBpmAtBeat(tempoMap, 6)).toBe(180)
  })

  it('reverses authored seconds through boundaries with binary search', () => {
    for (const beat of [0, 0.5, 3.999, 4, 5.25, 6, 11.5]) {
      expect(
        pianoTempoSecondsToBeat(
          tempoMap,
          pianoTempoBeatToSeconds(tempoMap, beat),
        ),
      ).toBeCloseTo(beat)
    }
  })

  it('contains invalid and negative query positions at beat zero', () => {
    expect(pianoTempoBeatToSeconds(tempoMap, -4)).toBe(0)
    expect(pianoTempoSecondsToBeat(tempoMap, -4)).toBe(0)
    expect(pianoTempoBpmAtBeat(tempoMap, Number.NaN)).toBe(120)
  })
})
