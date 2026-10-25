// ============================================================
// Lesson 12 lines tests — the toys' names, live lines and readouts
// ============================================================
//
// WEB-SPEC, Tests 10's copy clauses, with the lines Toys 1, 2, 5 and 6
// give: every template passes the claims check; no accessible name or
// live line holds a sharp or flat sign or a bare numeral. The syllables are
// Lesson 4's, passed in as the names switch will pass them.

import { describe, expect, it } from 'vitest'
import { SOLFEGE } from '@/features/lessons/lesson-04/stairs-words'
import { validateGuidedDynamicClaim } from '@/lib/guided-voice/claims'
import type { Naming } from './lines'
import { centreLabel, chipName, cornerCount, figureSummary, fourChordsLine, keyTurnedLine, readoutHtml, readoutWords, rootMoves, slideLine, tuneButtonName, tuneEndLine, tuneStartLine, } from './lines'
import { chordsOf, KEYS, TUNE_IDS } from './music'

const syllable = (degree: number): string => SOLFEGE[degree]
const LETTERS: Naming = { syllable, solfege: false }
const DO_RE_MI: Naming = { syllable, solfege: true }

/** A Roman numeral standing as a word, or the diminished circle. */
const BARE = /\b(?:[IV]+|[iv]+)\b|°/

/** Markup as the eye reads it: the spoken words dropped. */
const seen = (html: string): string =>
  html.replace(/<span class="sr">[^<]*<\/span>/g, '').replace(/<[^>]+>/g, '')

/** Markup as a screen reader reads it: the hidden signs dropped. */
const heard = (html: string): string =>
  html
    .replace(/<span aria-hidden="true">[^<]*<\/span>/g, '')
    .replace(/<[^>]+>/g, '')

/** Do of Sing it's line at every Move do position, both voices: C4 or C5, four lower to three higher. */
const DOS = [60, 72].flatMap((d) =>
  [-4, -3, -2, -1, 0, 1, 2, 3].map((s) => d + s),
)

/** Every accessible name and live line the toys can build. */
function spokenLines(): string[] {
  const chips = KEYS.flatMap((key) =>
    chordsOf(key).flatMap((c) =>
      (['build', 'numerals'] as const).flatMap((step) =>
        [LETTERS, DO_RE_MI].map((n) => chipName(c, step, n)),
      ),
    ),
  )
  return [
    ...chips,
    ...KEYS.flatMap((key) => [
      figureSummary(key, []),
      figureSummary(key, [0]),
      figureSummary(key, [0, 1, 2, 3, 4, 5, 6]),
      keyTurnedLine(key),
      slideLine(key, LETTERS),
      slideLine(key, DO_RE_MI),
      fourChordsLine(key),
    ]),
    ...rootMoves(syllable),
    cornerCount(11, 15),
    ...TUNE_IDS.flatMap((id) => [
      tuneStartLine(id),
      tuneButtonName(id, false),
      tuneButtonName(id, true),
    ]),
    tuneEndLine(10, 12),
    ...DOS.map(readoutWords),
    ...DOS.map((d) => heard(readoutHtml(d))),
  ]
}

describe('the chips (Toys 1)', () => {
  it('names a chip in Step 1 by the syllable of its root, then its notes: "The chord on do: C, E, G"', () => {
    // Act
    const names = chordsOf('C').map((c) => chipName(c, 'build', LETTERS))

    // Assert
    expect(names[0]).toBe('The chord on do: C, E, G')
    expect(names[6]).toBe('The chord on ti: B, D, F')
  })

  it('names a chip from Step 2 on by its number and its chord: "Chord six, A minor: A, C, E"', () => {
    // Act
    const names = chordsOf('C').map((c) => chipName(c, 'numerals', LETTERS))

    // Assert
    expect([names[0], names[5], names[6]]).toEqual([
      'Chord one, C major: C, E, G',
      'Chord six, A minor: A, C, E',
      'Chord seven, B diminished: B, D, F',
    ])
  })

  it('spells G major\'s seventh chord in words: "Chord seven, F sharp diminished: F sharp, A, C"', () => {
    // Act
    const name = chipName(chordsOf('G')[6], 'numerals', LETTERS)

    // Assert: FACTS 19
    expect(name).toBe('Chord seven, F sharp diminished: F sharp, A, C')
  })

  it("puts the syllables in place of the letters under Do-re-mi, keeping the chord's own name", () => {
    // Act
    const c = chordsOf('C')
    const g = chordsOf('G')

    // Assert: Tests 13, the chord on la reads la do mi and do stays on the tonic
    expect(chipName(c[0], 'build', DO_RE_MI)).toBe(
      'The chord on do: do, mi, so',
    )
    expect(chipName(c[5], 'numerals', DO_RE_MI)).toBe(
      'Chord six, A minor: la, do, mi',
    )
    expect(chipName(g[6], 'numerals', DO_RE_MI)).toBe(
      'Chord seven, F sharp diminished: ti, re, fa',
    )
  })
})

describe('the figure and its live lines (Toys 1)', () => {
  it('sums up the figure: "C major\'s seven chords, three lit: one, two and three."', () => {
    // Assert
    expect(figureSummary('C', [0, 1, 2])).toBe(
      "C major's seven chords, three lit: one, two and three.",
    )
    expect(figureSummary('G', [])).toBe("G major's seven chords, none lit.")
    expect(figureSummary('C', [0, 4])).toBe(
      "C major's seven chords, two lit: one and five.",
    )
  })

  it('announces the key switch: "G major: every chord turned round the ring."', () => {
    // Assert
    expect(keyTurnedLine('G')).toBe(
      'G major: every chord turned round the ring.',
    )
  })

  it('announces Play I, then vi: "One, C major, then six, A minor: C and E stay, and G becomes A."', () => {
    // Act
    const c = slideLine('C', LETTERS)
    const g = slideLine('G', LETTERS)

    // Assert: FACTS 21 and 69a, the corner on D going to E in G
    expect(c).toBe(
      'One, C major, then six, A minor: C and E stay, and G becomes A.',
    )
    expect(g).toBe(
      'One, G major, then six, E minor: G and B stay, and D becomes E.',
    )
  })

  it('names the slide by syllable under Do-re-mi', () => {
    // Assert
    expect(slideLine('C', DO_RE_MI)).toBe(
      'One, C major, then six, A minor: do and mi stay, and so becomes la.',
    )
  })

  it('reads each root\'s move as it sounds: "do", "down to so", "up to la", "down to fa"', () => {
    // Assert: FACTS 26, Step 4's Notice
    expect(rootMoves(syllable)).toEqual([
      'do',
      'down to so',
      'up to la',
      'down to fa',
    ])
  })

  it('labels the centre "C major" in Step 1 and "vi · A minor" from Step 2 on', () => {
    // Act
    const c = chordsOf('C')

    // Assert: Toys 1, End to end 4
    expect(centreLabel(c[0], false)).toBe('C major')
    expect(centreLabel(c[0], true)).toBe('I · C major')
    expect(centreLabel(c[5], true)).toBe('vi · A minor')
    expect(centreLabel(chordsOf('G')[6], true)).toBe('vii° · F♯ diminished')
  })
})

describe('the hero and the tune toy (Toys 2 and 5)', () => {
  it('speaks for the four chords and the tunes: "Four chords: C major, G major, A minor, F major."', () => {
    // Assert
    expect(fourChordsLine('C')).toBe(
      'Four chords: C major, G major, A minor, F major.',
    )
    expect(tuneStartLine('tune-1')).toBe('Tune 1, over the four chords.')
    expect(tuneEndLine(11, 15)).toBe('On a corner: 11 of 15.')
    expect(cornerCount(10, 12)).toBe('On a corner: 10 of 12')
  })

  it('names each tune button for what it plays, and for what it stops while it plays', () => {
    // Act
    const names = TUNE_IDS.map((id) => [
      tuneButtonName(id, false),
      tuneButtonName(id, true),
    ])

    // Assert: Toys 5; the name says what the button shows (WCAG 2.5.3)
    expect(names).toEqual([
      ['Play tune 1', 'Stop tune 1'],
      ['Play tune 2', 'Stop tune 2'],
      ['Play tune 2 with even notes', 'Stop tune 2 with even notes'],
    ])
  })
})

describe("Sing it's readout (Toys 6)", () => {
  it('reads "do is C4: C4, G3, A3, F3, C4" at the lower voice\'s middle, and C5 for the higher', () => {
    // Assert: FACTS 59
    expect(readoutWords(60)).toBe('do is C4: C4, G3, A3, F3, C4')
    expect(readoutWords(72)).toBe('do is C5: C5, G4, A4, F4, C5')
  })

  it("spells every Move do position in Lesson 4's names for the key, from A flat 3 to E flat 4", () => {
    // Act
    const shown = (doMidi: number): string => seen(readoutHtml(doMidi))

    // Assert: FACTS 60, and WEB-SPEC Toys 6's table
    expect(shown(56)).toBe('do is A♭3: A♭3, E♭3, F3, D♭3, A♭3')
    expect(shown(63)).toBe('do is E♭4: E♭4, B♭3, C4, A♭3, E♭4')
    expect(shown(59)).toBe('do is B3: B3, F♯3, G♯3, E3, B3')
    expect(shown(58)).toBe('do is B♭3: B♭3, F3, G3, E♭3, B♭3')
    expect(shown(69)).toBe('do is A4: A4, E4, F♯4, D4, A4')
    expect(shown(73)).toBe('do is D♭5: D♭5, A♭4, B♭4, G♭4, D♭5')
    expect(shown(75)).toBe('do is E♭5: E♭5, B♭4, C5, A♭4, E♭5')
  })

  it('speaks every sign of the readout in words: "do is A flat 3"', () => {
    // Act
    const html = readoutHtml(56)

    // Assert
    expect(readoutWords(56)).toBe(
      'do is A flat 3: A flat 3, E flat 3, F3, D flat 3, A flat 3',
    )
    expect(heard(html).replace(/\s+/g, ' ')).toBe(
      'do is A flat 3: A flat 3, E flat 3, F3, D flat 3, A flat 3',
    )
  })
})

describe('every line (Tests 10)', () => {
  it('holds no sharp or flat sign and no bare numeral in any accessible name or live line', () => {
    for (const line of spokenLines()) {
      // Assert
      expect(line, line).not.toMatch(/[♯♭]/)
      expect(line, line).not.toMatch(BARE)
    }
  })

  it('passes the claims check, the drawn labels and readouts included', () => {
    // Arrange
    const drawn = [
      ...KEYS.flatMap((key) => chordsOf(key).map((c) => centreLabel(c, true))),
      ...DOS.map((d) => seen(readoutHtml(d))),
    ]

    for (const line of [...spokenLines(), ...drawn]) {
      // Act
      const { violations } = validateGuidedDynamicClaim({
        surface: 'finding',
        text: line,
      })

      // Assert
      expect(violations, line).toEqual([])
    }
  })
})
