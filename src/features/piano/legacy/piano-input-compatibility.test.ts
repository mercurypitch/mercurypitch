// Piano input compatibility tests — chord scoring and mic fallback.

import { describe, expect, it } from 'vitest'
import { createPianoInputState } from '@/features/piano/input/piano-input-state'
import { matchLegacyPianoInputPitch } from './piano-input-compatibility'

const midiSource = { kind: 'midi', id: 'keyboard-a' } as const

describe('matchLegacyPianoInputPitch', () => {
  it('matches every sounding pitch in a normalized chord, not only primaryNote', () => {
    const input = createPianoInputState()
    for (const [index, midi] of [60, 64, 67].entries()) {
      input.apply({
        type: 'note-on',
        source: midiSource,
        channel: 0,
        midi,
        velocity: 0.75,
        timestampMs: index,
      })
    }

    expect(input.snapshot().primaryNote?.midi).toBe(67)
    for (const midi of [60, 64, 67]) {
      expect(matchLegacyPianoInputPitch(midi, input.snapshot(), 67, 0)).toEqual(
        { matched: true, cents: 0 },
      )
    }
    expect(matchLegacyPianoInputPitch(71, input.snapshot(), 67, 0)).toEqual({
      matched: false,
      cents: null,
    })
  })

  it('preserves microphone cents when normalized input does not match', () => {
    const input = createPianoInputState()

    expect(matchLegacyPianoInputPitch(62, input.snapshot(), 62, -13)).toEqual({
      matched: true,
      cents: -13,
    })
  })
})
