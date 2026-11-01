import { describe, expect, it } from 'vitest'
import { chordLampsLabel, chordLampState, keyLampLabel, saidNote, } from './home-note-lamps'
import type { RoundOutcome } from './home-note-machine'

describe("Home note's lamps", () => {
  it('lights each chord as it reaches the speaker, and keeps the passed ones', () => {
    // Before the first chord.
    expect([0, 1, 2].map((i) => chordLampState(i, 0, false))).toEqual([
      'toCome',
      'toCome',
      'toCome',
    ])
    // The second chord sounding.
    expect([0, 1, 2].map((i) => chordLampState(i, 2, false))).toEqual([
      'played',
      'playing',
      'toCome',
    ])
    // The last chord sounding, then the band stopped.
    expect(chordLampState(2, 3, false)).toBe('playing')
    expect([0, 1, 2].map((i) => chordLampState(i, 3, true))).toEqual([
      'played',
      'played',
      'played',
    ])
  })

  it('says the chords as a musician does, the same chord twice at Learning', () => {
    expect(chordLampsLabel(['I', 'IV', 'V'], 2, false)).toBe(
      "The band's chords: the one played, the four playing, the five to come",
    )
    expect(chordLampsLabel(['I', 'IV', 'V', 'I'], 4, false)).toBe(
      "The band's chords: the one played, the four played, the five played, the one playing",
    )
  })

  it('says a sharp in words', () => {
    expect(saidNote(67)).toBe('G4')
    expect(saidNote(58)).toBe('A sharp 3')
  })

  it("names a key's lamp by its place, its home and how it went", () => {
    const outcome = (index: number, home: number, landed: boolean) =>
      ({
        round: { index, home },
        landed,
        cents: landed ? 4 : null,
        seconds: landed ? 1.2 : null,
        voiced: true,
        heardAgain: false,
      }) satisfies RoundOutcome
    expect(keyLampLabel(outcome(0, 55, true))).toBe(
      'Key 1, home G3, found. Hear it again',
    )
    expect(keyLampLabel(outcome(4, 58, false))).toBe(
      'Key 5, home A sharp 3, missed. Hear it again',
    )
  })
})
