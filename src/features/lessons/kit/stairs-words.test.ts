// ============================================================
// Staircase words tests — the stairs, the readout, the slider and the lines
// ============================================================

import { describe, expect, it } from 'vitest'
import type { NamesMode } from './names-modes'
import type { Degrees } from './stairs-scales'
import { MAJOR_FIVE, MINOR_FIVE } from './stairs-scales'
import { readout, risersSaid, scaleName, sliderText, stairLabel, stairName, stopSaid, summary, whiteKeysSaid, } from './stairs-words'

/** A line as the eye reads it: the signs shown, the spoken words dropped. */
const seen = (html: string): string =>
  html.replace(/<span class="sr">[^<]*<\/span>/g, '').replace(/<[^>]+>/g, '')

/** A line as a screen reader reads it: the hidden signs dropped, the words kept. */
const heard = (html: string): string =>
  html
    .replace(/<span aria-hidden="true">[^<]*<\/span>/g, '')
    .replace(/<[^>]+>/g, '')

const STAIRS = Array.from({ length: 8 }, (_, i) => i)

describe('stairName', () => {
  it("names D major's stairs one letter each, by number with 1 again at the top, and do to do", () => {
    expect(STAIRS.map((i) => stairName(i, 62, 'letters'))).toEqual([
      'D',
      'E',
      'F♯',
      'G',
      'A',
      'B',
      'C♯',
      'D',
    ])
    expect(STAIRS.map((i) => stairName(i, 62, 'numbers'))).toEqual([
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
      '1',
    ])
    expect(STAIRS.map((i) => stairName(i, 62, 'solfege'))).toEqual([
      'do',
      're',
      'mi',
      'fa',
      'so',
      'la',
      'ti',
      'do',
    ])
  })

  it('spells a flat start with flats and F sharp major with its E sharp', () => {
    expect(STAIRS.map((i) => stairName(i, 63, 'letters'))).toEqual([
      'E♭',
      'F',
      'G',
      'A♭',
      'B♭',
      'C',
      'D',
      'E♭',
    ])
    expect(stairName(6, 66, 'letters')).toBe('E♯')
  })

  it("names another scale's stairs from its own degrees: the major five on C, and the minor five on A (Lesson 20)", () => {
    // Act
    const names = (tonic: number, degrees: Degrees, mode: NamesMode) =>
      degrees.map((_d, i) => stairName(i, tonic, mode, degrees))

    // Assert
    expect(names(60, MAJOR_FIVE, 'solfege')).toEqual([
      'do',
      're',
      'mi',
      'so',
      'la',
      'do',
    ])
    expect(names(60, MAJOR_FIVE, 'letters')).toEqual([
      'C',
      'D',
      'E',
      'G',
      'A',
      'C',
    ])
    expect(names(60, MAJOR_FIVE, 'numbers')).toEqual([
      '1',
      '2',
      '3',
      '5',
      '6',
      '1',
    ])
    expect(names(57, MINOR_FIVE, 'solfege')).toEqual([
      'do',
      'me',
      'fa',
      'so',
      'te',
      'do',
    ])
    expect(names(57, MINOR_FIVE, 'letters')).toEqual([
      'A',
      'C',
      'D',
      'E',
      'G',
      'A',
    ])
  })
})

describe('stairLabel', () => {
  it("says each stair's number, its sung name and its note in words (Lesson 4 WEB-SPEC, Toys 1)", () => {
    expect(stairLabel(2, 62)).toBe('Stair 3, mi, F sharp 4')
    expect(stairLabel(6, 66)).toBe('Stair 7, ti, E sharp 5')
  })

  it('says "home" on both of do\'s stairs, since the house that marks them is hidden', () => {
    expect(stairLabel(0, 62)).toBe('Stair 1, do, D4, home')
    expect(stairLabel(7, 62)).toBe('Stair 8, do, D5, home')
    expect(stairLabel(4, 62)).not.toContain('home')
  })
})

describe('the readout and the slider', () => {
  it('names the scale and its black keys, every sign speakable', () => {
    // Act
    const onD = readout(62)

    // Assert
    expect(seen(onD)).toBe('D major · 2 black keys: F♯, C♯')
    expect(heard(onD)).toBe('D major · 2 black keys: F sharp, C sharp')
    expect(seen(readout(60))).toBe('C major · no black keys')
    expect(seen(readout(65))).toBe('F major · 1 black key: B♭')
  })

  it('gives the slider a value in words: "Do is D4: D major, two black keys"', () => {
    expect(sliderText(62)).toBe('Do is D4: D major, two black keys')
    expect(sliderText(60)).toBe('Do is C4: C major, no black keys')
    expect(sliderText(65)).toBe('Do is F4: F major, one black key')
    expect(sliderText(66)).toBe(
      'Do is F sharp 4: F sharp major, five black keys',
    )
    expect(scaleName(70, true)).toBe('B flat major')
  })
})

describe("the staircase's lines", () => {
  it('sums up the scale with its notes and steps (Lesson 4 WEB-SPEC, Toys 1)', () => {
    expect(summary(62)).toBe(
      'D major: D, E, F sharp, G, A, B, C sharp, D. Tone, tone, semitone, tone, tone, tone, semitone.',
    )
  })

  it('says the white keys from D are not a major scale, and from C that they are', () => {
    expect(whiteKeysSaid(62)).toBe(
      'White keys from D: tone, semitone, tone, tone, tone, semitone, tone. Not a major scale.',
    )
    expect(whiteKeysSaid(60)).toBe(
      'White keys from C: tone, tone, semitone, tone, tone, tone, semitone. On C, the white keys are the major scale.',
    )
  })

  it('has nothing to say for White keys only from a black key', () => {
    for (const black of [61, 63, 66, 68, 70])
      expect(whiteKeysSaid(black)).toBeNull()
  })

  it('names ti where Stop on ti stops', () => {
    expect(stopSaid(62)).toBe(
      'Stopped on ti, C sharp 5. Landing on do finishes the scale.',
    )
    expect(stopSaid(60)).toBe(
      'Stopped on ti, B4. Landing on do finishes the scale.',
    )
  })
})

describe("a pentatonic's words (Lesson 20 WEB-SPEC, Toys 1)", () => {
  it('names each stair from its own degrees, its signs spoken: "Stair 2, me, E flat 3" in Play it on C', () => {
    // Act
    const onC = [0, 1, 4, 5].map((i) => stairLabel(i, 48, MINOR_FIVE))
    const fromD = stairLabel(2, 50, MAJOR_FIVE)

    // Assert
    expect(onC).toEqual([
      'Stair 1, do, C3, home',
      'Stair 2, me, E flat 3',
      'Stair 5, te, B flat 3',
      'Stair 6, do, C4, home',
    ])
    expect(fromD).toBe('Stair 3, mi, F sharp 3')
  })

  it("says Lesson 4's stairs as before when no degrees are given", () => {
    expect(stairLabel(2, 50)).toBe('Stair 3, mi, F sharp 3')
  })

  it("gives each scale's risers in semitones", () => {
    expect([risersSaid(MAJOR_FIVE), risersSaid(MINOR_FIVE)]).toEqual([
      '2, 2, 3, 2 and 3',
      '3, 2, 2, 3 and 2',
    ])
  })

  it('sums up a pentatonic with its notes and its steps in semitones', () => {
    // Act
    const major = summary(48, MAJOR_FIVE)
    const minor = summary(45, MINOR_FIVE)

    // Assert
    expect(major).toBe(
      'C major pentatonic: C, D, E, G, A, C. Steps of 2, 2, 3, 2 and 3 semitones.',
    )
    expect(minor).toBe(
      'A minor pentatonic: A, C, D, E, G, A. Steps of 3, 2, 2, 3 and 2 semitones.',
    )
  })
})
