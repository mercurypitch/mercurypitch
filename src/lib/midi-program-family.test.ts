// MIDI program-family tests keep non-guitar GM parts off the guitar amp.

import { describe, expect, it } from 'vitest'
import { midiProgramFamily, normalizeMidiProgram, resolveMidiProgramFamily, } from './midi-program-family'

describe('midiProgramFamily', () => {
  it.each([
    [24, 'acoustic-guitar'],
    [25, 'acoustic-guitar'],
    [26, 'electric-guitar'],
    [31, 'electric-guitar'],
    [32, 'bass'],
    [39, 'bass'],
    [0, 'neutral'],
    [40, 'neutral'],
    [52, 'neutral'],
    [80, 'neutral'],
    [127, 'neutral'],
  ] as const)('classifies GM program %i as %s', (program, family) => {
    expect(midiProgramFamily(program)).toBe(family)
  })

  it('keeps invalid or one-based-looking values neutral', () => {
    expect(midiProgramFamily(-1)).toBe('neutral')
    expect(midiProgramFamily(128)).toBe('neutral')
    expect(midiProgramFamily(30.5)).toBe('neutral')
    expect(normalizeMidiProgram(-1)).toBeUndefined()
    expect(normalizeMidiProgram(128)).toBeUndefined()
    expect(normalizeMidiProgram(31)).toBe(31)
  })
})

describe('resolveMidiProgramFamily', () => {
  it('lets an explicit GM program override misleading names and stored family', () => {
    expect(
      resolveMidiProgramFamily({
        sourceProgram: 48,
        instrumentFamily: 'electric-guitar',
        instrumentName: 'Lead guitar',
      }),
    ).toBe('neutral')
    expect(
      resolveMidiProgramFamily({
        sourceProgram: 43,
        instrumentName: 'Bass',
      }),
    ).toBe('neutral')
  })

  it('recovers only unambiguous legacy guitar and bass names', () => {
    expect(resolveMidiProgramFamily({ instrumentName: 'Steel Guitar' })).toBe(
      'acoustic-guitar',
    )
    expect(
      resolveMidiProgramFamily({ instrumentName: 'Distortion Guitar' }),
    ).toBe('electric-guitar')
    expect(resolveMidiProgramFamily({ instrumentName: 'Fingered Bass' })).toBe(
      'bass',
    )
    expect(resolveMidiProgramFamily({ instrumentName: 'Contrabass' })).toBe(
      'neutral',
    )
    expect(resolveMidiProgramFamily({ instrumentName: 'Voice Oohs' })).toBe(
      'neutral',
    )
  })
})
