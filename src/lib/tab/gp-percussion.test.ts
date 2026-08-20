// ============================================================
// Guitar Pro Percussion Tests — indexed modern and direct legacy data
// ============================================================

import { describe, expect, it } from 'vitest'
import { guitarProDynamicVelocity, resolveGuitarProPercussion, } from './gp-percussion'

const modernTrack = {
  percussionArticulations: [
    {
      id: 9001,
      elementType: 'Studio Snare',
      staffLine: 3,
      outputMidiNumber: 38,
      noteHeadDefault: 101,
      techniqueSymbol: 202,
    },
  ],
}

describe('resolveGuitarProPercussion', () => {
  it('treats zero as a valid modern articulation index', () => {
    expect(resolveGuitarProPercussion(modernTrack, 0)).toEqual({
      gmKey: 38,
      source: {
        format: 'guitar-pro',
        articulationId: 9001,
        articulationIndex: 0,
        midiKey: 38,
        label: 'Studio Snare',
        staffLine: 3,
        noteHead: 101,
        technique: 202,
      },
    })
  })

  it('folds a modern extended output while retaining its source evidence', () => {
    const result = resolveGuitarProPercussion(
      {
        percussionArticulations: [
          { ...modernTrack.percussionArticulations[0], outputMidiNumber: 114 },
        ],
      },
      0,
    )
    expect(result).toMatchObject({
      gmKey: 43,
      source: {
        articulationId: 9001,
        articulationIndex: 0,
        midiKey: 114,
      },
    })
  })

  it('uses the bounded GM name when a modern articulation label is blank', () => {
    expect(
      resolveGuitarProPercussion(
        {
          percussionArticulations: [
            { ...modernTrack.percussionArticulations[0], elementType: '  ' },
          ],
        },
        0,
      ),
    ).toMatchObject({ source: { label: 'Acoustic Snare' } })
  })

  it('uses a direct legacy id only when no modern table exists', () => {
    expect(
      resolveGuitarProPercussion({ percussionArticulations: [] }, 91),
    ).toEqual({
      gmKey: 38,
      source: {
        format: 'guitar-pro',
        articulationId: 91,
        label: 'Snare rim shot',
      },
    })
  })

  it('drops an out-of-range modern index instead of treating it as legacy', () => {
    expect(resolveGuitarProPercussion(modernTrack, 91)).toBeNull()
  })

  it('uses a GM label for a direct legacy identity without an override', () => {
    expect(
      resolveGuitarProPercussion({ percussionArticulations: [] }, 42),
    ).toMatchObject({ source: { label: 'Closed Hi-Hat' } })
  })

  it('drops invalid, unknown, and unnormalizable modern values', () => {
    expect(
      resolveGuitarProPercussion({ percussionArticulations: [] }, -1),
    ).toBeNull()
    expect(
      resolveGuitarProPercussion({ percussionArticulations: [] }, 0.5),
    ).toBeNull()
    expect(
      resolveGuitarProPercussion({ percussionArticulations: [] }, 32),
    ).toBeNull()
    expect(
      resolveGuitarProPercussion(
        {
          percussionArticulations: [
            { ...modernTrack.percussionArticulations[0], outputMidiNumber: 32 },
          ],
        },
        0,
      ),
    ).toBeNull()
  })
})

describe('guitarProDynamicVelocity', () => {
  it('matches alphaTab dynamics and uses mezzo-forte for unknown values', () => {
    expect(
      Array.from({ length: 26 }, (_, dynamic) =>
        guitarProDynamicVelocity(dynamic),
      ),
    ).toEqual([
      15, 31, 47, 63, 79, 95, 111, 127, 10, 5, 3, 127, 127, 127, 111, 111, 111,
      95, 95, 95, 111, 95, 111, 1, 87, 111,
    ])
    expect(guitarProDynamicVelocity(999)).toBe(79)
  })
})
