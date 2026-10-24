// ============================================================
// Lesson 12 sounds tests — every fixed sound's pitches, lengths and levels
// ============================================================
//
// WEB-SPEC, Tests 5: every fixed sound plays only FACTS 66's notes, each at
// hz(m); the loop and a tune last 8.0 s, 16.0 s under Slow; a chip's chord
// 1.4 s; Play I, then vi 3.1 s, its corner sliding in the 0.3 s between;
// the four words 4.8, 2.7, 2.7 and 2.7 s; a chord's voices at 0.075 each
// alone and 0.05 under Merc (FACTS 68 to 74).

import { describe, expect, it } from 'vitest'
import { hz } from '@/features/lessons/kit/notes'
import { TUNE_IDS } from './music'
import type { SoundNotes } from './sounds'
import { chip, CHORD_GAIN, GUIDE, I_THEN_VI_SLIDE, inKey, iThenVi, lengthOf, loop, MERC_GAIN, NOTE_GAIN, roots, singAlong, slow, tune, UNDER_GAIN, WORD_SOUNDS, } from './sounds'

/** FACTS 66: the fixed examples' notes, MIDI to hertz, to two decimals. */
const FACTS_66: Readonly<Record<number, number>> = {
  53: 174.61,
  55: 196.0,
  57: 220.0,
  59: 246.94,
  60: 261.63,
  62: 293.66,
  64: 329.63,
  65: 349.23,
  66: 369.99,
  67: 392.0,
  68: 415.3,
  69: 440.0,
  71: 493.88,
  72: 523.25,
  74: 587.33,
  76: 659.26,
  77: 698.46,
}

const DEGREES = [0, 1, 2, 3, 4, 5, 6]

/** FACTS 67 to 73's fixed sounds: everything in C, G's chips, and Sing it at Move do's middle. */
const FIXED: Readonly<Record<string, SoundNotes>> = {
  ...Object.fromEntries(DEGREES.map((d) => [`chip C ${d}`, chip(d, 'C')])),
  ...Object.fromEntries(DEGREES.map((d) => [`chip G ${d}`, chip(d, 'G')])),
  'I then vi': iThenVi('C'),
  loop: loop('C'),
  roots: roots('C'),
  ...Object.fromEntries(TUNE_IDS.map((id) => [id, tune(id, 'C')])),
  ...WORD_SOUNDS,
  'sing lower': singAlong('lower'),
  'sing higher': singAlong('higher'),
  guide: GUIDE,
}

const at = (sound: SoundNotes, t: number): number[] =>
  sound.filter((n) => Math.abs(n.t - t) < 1e-9).map((n) => n.midi)

describe('the pitches (Tests 5)', () => {
  it("plays only FACTS 66's notes in every fixed sound, each at its frequency", () => {
    for (const [name, sound] of Object.entries(FIXED))
      for (const n of sound) {
        // Act
        const listed = FACTS_66[n.midi]

        // Assert
        expect(listed, `${name}: MIDI ${n.midi}`).toBeDefined()
        expect(hz(n.midi), `${name}: MIDI ${n.midi}`).toBeCloseTo(listed, 2)
      }
  })

  it("sounds a chip from the key's own octave: C4 E4 G4 to B4 D5 F5 in C, G3 B3 D4 to F sharp 4 A4 C5 in G", () => {
    // Act
    const c = [chip(0, 'C'), chip(6, 'C')].map((s) => s.map((n) => n.midi))
    const g = [chip(0, 'G'), chip(6, 'G')].map((s) => s.map((n) => n.midi))

    // Assert: FACTS 69
    expect(c).toEqual([
      [60, 64, 67],
      [71, 74, 77],
    ])
    expect(g).toEqual([
      [55, 59, 62],
      [66, 69, 72],
    ])
  })

  it('plays I as C4 E4 G4, then vi as A3 C4 E4', () => {
    // Act
    const sound = iThenVi('C')

    // Assert: FACTS 69
    expect(at(sound, 0)).toEqual([60, 64, 67])
    expect(at(sound, 1.7)).toEqual([57, 60, 64])
  })

  it('plays the four words as FACTS 70 voices them', () => {
    // Act
    const { numeral, diminished, augmented } = WORD_SOUNDS

    // Assert: I then V as the loop voices them; B3 D4 F4; C4 E4 G sharp 4
    expect([at(numeral, 0), at(numeral, 1.5)]).toEqual([
      [60, 64, 67],
      [55, 59, 62],
    ])
    expect(diminished.map((n) => n.midi)).toEqual([59, 62, 65, 59, 62, 65])
    expect(augmented.map((n) => n.midi)).toEqual([60, 64, 68, 60, 64, 68])
  })

  it('lets Merc sing do so la fa do on C4 for the lower voice and C5 for the higher, each root over its own chord', () => {
    for (const [voice, line] of [
      ['lower', [60, 55, 57, 53, 60]],
      ['higher', [72, 67, 69, 65, 72]],
    ] as const) {
      // Act
      const sound = singAlong(voice)
      const merc = sound.filter((n) => n.kind === 'merc')

      // Assert: FACTS 59, 61 and 73
      expect(
        merc.map((n) => n.midi),
        voice,
      ).toEqual(line)
      expect(merc.map((n) => n.t)).toEqual([0, 2, 4, 6, 8])
      for (const n of merc) {
        const under = sound.filter((c) => c.kind === 'soft' && c.t === n.t)
        expect(Math.min(...under.map((c) => c.midi)) % 12).toBe(n.midi % 12)
      }
    }
  })
})

describe('the lengths (Tests 5)', () => {
  it('lasts 8.0 s for the loop, its roots and every tune play, and 16.0 s under Slow', () => {
    // Arrange
    const sounds = [
      loop('C'),
      roots('C'),
      ...TUNE_IDS.map((id) => tune(id, 'C')),
    ]

    for (const sound of sounds) {
      // Act
      const plain = lengthOf(sound)
      const slower = lengthOf(slow(sound))

      // Assert: FACTS 68, 71 and 72; Toys 5
      expect(plain).toBeCloseTo(8, 9)
      expect(slower).toBeCloseTo(16, 9)
    }
  })

  it('lasts 1.4 s for a chip and 3.1 s for Play I, then vi, its corner sliding in the 0.3 s between', () => {
    // Act
    const sound = iThenVi('C')
    const iEnds = Math.max(
      ...sound.filter((n) => n.t === 0).map((n) => n.t + n.dur),
    )
    const viStarts = Math.min(...sound.filter((n) => n.t > 0).map((n) => n.t))

    // Assert: FACTS 69; Tests 5
    expect(lengthOf(chip(0, 'C'))).toBe(1.4)
    expect(lengthOf(sound)).toBeCloseTo(3.1, 9)
    expect(I_THEN_VI_SLIDE).toEqual({ t: iEnds, dur: 0.3 })
    expect(viStarts).toBeCloseTo(I_THEN_VI_SLIDE.t + I_THEN_VI_SLIDE.dur, 9)
  })

  it('lasts 4.8, 2.7, 2.7 and 2.7 s for the four words', () => {
    // Act
    const lengths = [
      WORD_SOUNDS.diatonic,
      WORD_SOUNDS.numeral,
      WORD_SOUNDS.diminished,
      WORD_SOUNDS.augmented,
    ].map(lengthOf)

    // Assert: FACTS 70
    expect(lengths[0]).toBeCloseTo(4.8, 9)
    for (const l of lengths.slice(1)) expect(l).toBeCloseTo(2.7, 9)
  })

  it("lasts 10.0 s for Sing it, Merc's notes 1.6 s with 0.4 s between and the last do 2.0 s", () => {
    // Act
    const sound = singAlong('lower')
    const merc = sound.filter((n) => n.kind === 'merc')

    // Assert: FACTS 61
    expect(lengthOf(sound)).toBe(10)
    expect(lengthOf(GUIDE)).toBe(10)
    expect(merc.map((n) => n.dur)).toEqual([1.6, 1.6, 1.6, 1.6, 2])
    for (const [i, n] of merc.slice(1).entries())
      expect(n.t - (merc[i].t + merc[i].dur)).toBeCloseTo(0.4, 9)
  })

  it('doubles every onset and length under Slow, and leaves the notes alone', () => {
    // Arrange
    const sound = tune('tune-2', 'C')

    // Act
    const slower = slow(sound)

    // Assert
    expect(slower).toEqual(
      sound.map((n) => ({ ...n, t: n.t * 2, dur: n.dur * 2 })),
    )
  })
})

describe('the levels (Tests 5)', () => {
  it("sounds a chord's voices at 0.075 each when it plays alone", () => {
    // Arrange
    const alone = [
      ...DEGREES.map((d) => chip(d, 'C')),
      iThenVi('C'),
      loop('C'),
      WORD_SOUNDS.diatonic,
      WORD_SOUNDS.numeral,
    ]

    // Assert: FACTS 74
    for (const sound of alone)
      for (const n of sound)
        expect(n).toMatchObject({ gain: CHORD_GAIN, kind: 'soft' })
  })

  it("sounds a chord's voices at 0.05 each under Merc's 0.2 ooh, and under the guide", () => {
    for (const sound of [
      ...TUNE_IDS.map((id) => tune(id, 'C')),
      singAlong('lower'),
      singAlong('higher'),
    ]) {
      // Act
      const voices = sound.filter((n) => n.kind === 'soft')
      const merc = sound.filter((n) => n.kind === 'merc')

      // Assert: FACTS 68 and 74
      expect(voices.every((n) => n.gain === UNDER_GAIN)).toBe(true)
      expect(merc.every((n) => n.gain === MERC_GAIN)).toBe(true)
      expect(merc.length).toBeGreaterThan(0)
    }
    expect(GUIDE.every((n) => n.gain === UNDER_GAIN && n.kind === 'soft')).toBe(
      true,
    )
  })

  it("plays the roots, and the four words' single notes, at a tapped note's 0.13", () => {
    // Act
    const single = [
      ...roots('C'),
      ...WORD_SOUNDS.diminished.slice(0, 3),
      ...WORD_SOUNDS.augmented.slice(0, 3),
    ]

    // Assert: FACTS 71 and 74
    for (const n of single)
      expect(n).toMatchObject({ gain: NOTE_GAIN, kind: 'soft' })
  })
})

describe('the keys and Move do', () => {
  it('sounds every chip, the loop, the roots and the tunes in G five semitones lower than in C', () => {
    // Arrange
    const pairs: [SoundNotes, SoundNotes][] = [
      ...DEGREES.map((d): [SoundNotes, SoundNotes] => [
        chip(d, 'G'),
        chip(d, 'C'),
      ]),
      [iThenVi('G'), iThenVi('C')],
      [loop('G'), loop('C')],
      [roots('G'), roots('C')],
      ...TUNE_IDS.map((id): [SoundNotes, SoundNotes] => [
        tune(id, 'G'),
        tune(id, 'C'),
      ]),
    ]

    for (const [g, c] of pairs) {
      // Act
      const lowered = inKey(c, -5)

      // Assert: FACTS 69 and 69a
      expect(g).toEqual(lowered)
    }
  })

  it('moves the chords and the roots together under Move do, from A flat 3 to E flat 4 for the lower voice', () => {
    // Arrange
    const sound = singAlong('lower')

    // Act
    const [lowest, highest] = [inKey(sound, -4), inKey(sound, 3)]

    // Assert: FACTS 60
    expect(lowest.find((n) => n.kind === 'merc')?.midi).toBe(56)
    expect(highest.find((n) => n.kind === 'merc')?.midi).toBe(63)
    expect(lowest.map((n) => n.midi + 4)).toEqual(sound.map((n) => n.midi))
    expect(lowest.map((n) => n.t)).toEqual(sound.map((n) => n.t))
  })
})
