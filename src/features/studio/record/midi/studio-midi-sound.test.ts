// Studio MIDI sound tests — a drum or percussion lane plays the kit and every other lane the piano, and each says so: the piano as itself only where the lane is a piano.
import { describe, expect, it } from 'vitest'
import { studioMidiSound, studioMidiSoundWords } from './studio-midi-sound'

describe('studioMidiSound', () => {
  it('plays the kit for drums and percussion, and the piano for every other family', () => {
    // Arrange, Act, Assert
    expect(studioMidiSound({ family: 'drums' })).toBe('drums')
    expect(studioMidiSound({ family: 'percussion' })).toBe('drums')
    expect(studioMidiSound({ family: 'keys' })).toBe('piano')
    expect(studioMidiSound({ family: 'pitched-percussion' })).toBe('piano')
    expect(studioMidiSound({ family: 'bass' })).toBe('piano')
  })
})

describe('studioMidiSoundWords', () => {
  it('says what the lane plays as', () => {
    // Arrange, Act, Assert
    expect(studioMidiSoundWords({ family: 'drums', glyph: 'kick' })).toMatch(
      /^Plays the drum kit\. A key with no drum plays nothing/,
    )
    expect(studioMidiSoundWords({ family: 'keys', glyph: 'grand-piano' })).toBe(
      'Plays the piano.',
    )
    expect(studioMidiSoundWords({ family: 'keys', glyph: 'organ' })).toBe(
      'Plays as piano until this instrument has its own sound.',
    )
    expect(
      studioMidiSoundWords({ family: 'bass', glyph: 'electric-bass' }),
    ).toBe('Plays as piano until this instrument has its own sound.')
  })
})
