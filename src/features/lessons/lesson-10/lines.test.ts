// ============================================================
// Lesson 10 lines tests — the page's words, against LESSON.md and the rules
// ============================================================
//
// The template half of WEB-SPEC, Tests 10: every line template of Toys 1,
// 2, 3 and 6, on every root and in every view, passes the guided-voice
// claims check as a finding; no accessible name or live line holds a ♯ or
// ♭ sign; and every line LESSON.md gives is LESSON.md's, word for word, as
// every example the spec gives is the spec's. Each note is spelled one
// letter per degree, so D major's third is said "F sharp 4" and C minor's
// "E flat 4" (FACTS 10, 19, 27).

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { validateGuidedDynamicClaim } from '@/lib/guided-voice/claims'
import { QUALITIES, ROOTS } from './chords'
import type { Action, ChordOrScale, View, ViewKind } from './lines'
import { beadNames, changedLine, COLD_PREDICT, FIFTH_LABEL, gapLabel, gapNames, heroChordLine, heroMoveLine, nameStrip, patternReadout, qualityLine, SCALE_PREDICT, SING_LINES, summary, } from './lines'
import type { MoveId, Tempo } from './sounds'

/** A package document, its lines joined, so a quoted line can be found across a wrap. */
const doc = (name: string): string =>
  readFileSync(
    resolve(
      process.cwd(),
      'docs/plans/find-your-pitch/lessons/10-major-minor',
      name,
    ),
    'utf8',
  ).replace(/\s+/g, ' ')

const LESSON = doc('LESSON.md')
const SPEC = doc('WEB-SPEC.md')

const KINDS: readonly ViewKind[] = ['third', 'chord', 'scale']
const ACTIONS: readonly Action[] = [
  'stack',
  'root-lower',
  'root-higher',
  'chord',
  'scale',
]
const MOVES: readonly MoveId[] = ['mi', 'so']
const TEMPOS: readonly Tempo[] = ['slow', 'fast']

/** Every view the chord beads can show: each kind, on every root, in both qualities. */
const VIEWS: readonly View[] = KINDS.flatMap((kind) =>
  ROOTS.flatMap((root) =>
    QUALITIES.map((quality) => ({ kind, root, quality })),
  ),
)

const C_MAJOR: ChordOrScale = { kind: 'chord', root: 60, quality: 'major' }
const C_MINOR: ChordOrScale = { kind: 'chord', root: 60, quality: 'minor' }

const hasChordName = (v: View): v is ChordOrScale => v.kind !== 'third'

/** Every accessible name and live line the page's toys, predicts and Sing it say. */
function spokenLines(): string[] {
  return [
    ...VIEWS.flatMap((v) => [
      summary(v),
      ...beadNames(v),
      ...gapNames(v),
      qualityLine(v),
    ]),
    ...VIEWS.filter(hasChordName).flatMap((v) =>
      ACTIONS.map((a) => changedLine(a, v)),
    ),
    heroChordLine(),
    ...MOVES.map(heroMoveLine),
    ...[COLD_PREDICT, SCALE_PREDICT].flatMap((p) => [
      p.lock,
      ...Object.values(p.hints),
      ...Object.values(p.guess),
    ]),
    ...Object.values(SING_LINES),
  ]
}

/** Every line the toys show for the eye: the gap labels, the bracket, the name strip and the readout. */
function shownLines(): string[] {
  return [
    gapLabel(3),
    gapLabel(4),
    FIFTH_LABEL,
    ...VIEWS.filter((v) => v.kind !== 'scale').map(nameStrip),
    ...ROOTS.flatMap((r) =>
      QUALITIES.flatMap((q) => TEMPOS.map((t) => patternReadout(r, q, t))),
    ),
  ]
}

describe('the chord beads', () => {
  it("sum up C major in the spec's words, and C minor in the same form", () => {
    // Act
    const major = summary(C_MAJOR)
    const minor = summary(C_MINOR)

    // Assert: WEB-SPEC, Toys 1, Keyboard and screen readers
    expect(major).toBe(
      'C major: C 4, E 4, G 4. Gaps of 4 and 3 semitones; root to fifth 7, a perfect fifth.',
    )
    expect(SPEC).toContain(`"${major}"`)
    expect(minor).toBe(
      'C minor: C 4, E flat 4, G 4. Gaps of 3 and 4 semitones; root to fifth 7, a perfect fifth.',
    )
  })

  it("sum up Step 1's third and Step 5's scales by their notes", () => {
    // Act
    const third = summary({ kind: 'third', root: 60, quality: 'minor' })
    const scale = summary({ kind: 'scale', root: 60, quality: 'minor' })
    const major = summary({ kind: 'scale', root: 60, quality: 'major' })

    // Assert
    expect(third).toBe('Minor third: C 4, E flat 4. A gap of 3 semitones.')
    expect(scale).toBe(
      'C natural minor: C 4, D 4, E flat 4, F 4, G 4, A flat 4, B flat 4, C 5.',
    )
    expect(major).toBe('C major scale: C 4, D 4, E 4, F 4, G 4, A 4, B 4, C 5.')
  })

  it('spell every root one letter per degree: D major says F sharp, B major D sharp 5 and F sharp 5', () => {
    // Act
    const d = summary({ kind: 'chord', root: 62, quality: 'major' })
    const b = summary({ kind: 'chord', root: 71, quality: 'major' })
    const f = summary({ kind: 'scale', root: 65, quality: 'minor' })

    // Assert: FACTS 19 and 27
    expect(d).toMatch(/^D major: D 4, F sharp 4, A 4\. /)
    expect(b).toMatch(/^B major: B 4, D sharp 5, F sharp 5\. /)
    expect(f).toBe(
      'F natural minor: F 4, G 4, A flat 4, B flat 4, C 5, D flat 5, E flat 5, F 5.',
    )
  })

  it('name each bead by its note and role, and each gap button by its label, then what it plays', () => {
    // Act
    const beads = beadNames(C_MAJOR)
    const gaps = gapNames(C_MAJOR)

    // Assert: WEB-SPEC, Toys 1, the spec's bead example first; a gap button
    // starts with its label, "4 · major third", as Lesson 6's do (WCAG 2.5.3)
    expect(beads[0]).toBe('C 4, the root')
    expect(SPEC).toContain(`"${beads[0]}"`)
    expect(beads).toEqual(['C 4, the root', 'E 4, the third', 'G 4, the fifth'])
    expect(gaps).toEqual([
      '4, major third: C 4 up to E 4',
      '3, minor third: E 4 up to G 4',
    ])
    expect(gapNames(C_MINOR)).toEqual([
      '3, minor third: C 4 up to E flat 4',
      '4, major third: E flat 4 up to G 4',
    ])
  })

  it("start every gap button's name with the words of the label it shows", () => {
    // Arrange: a label's words, its signs and punctuation left out
    const words = (s: string): string =>
      s
        .replace(/[^\w\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()

    for (const v of VIEWS)
      for (const name of gapNames(v)) {
        // Act
        const size = Number(name.split(',')[0])

        // Assert
        expect(words(name).startsWith(words(gapLabel(size))), name).toBe(true)
      }
  })

  it("name Step 1's two beads as the bottom and top note, and give the scale's stairs no buttons", () => {
    // Act
    const third: View = { kind: 'third', root: 60, quality: 'minor' }
    const scale: View = { kind: 'scale', root: 60, quality: 'minor' }

    // Assert
    expect(beadNames(third)).toEqual([
      'C 4, the bottom note',
      'E flat 4, the top note',
    ])
    expect(gapNames(third)).toEqual(['3, minor third: C 4 up to E flat 4'])
    expect(beadNames(scale)).toEqual([])
    expect(gapNames(scale)).toEqual([])
  })

  it("announce Minor and Stacked in the spec's words, and the other actions in their form", () => {
    // Act
    const minor = qualityLine(C_MINOR)
    const stacked = changedLine('stack', C_MAJOR)

    // Assert: WEB-SPEC, Toys 1
    expect(minor).toBe(
      'Minor: the third moved down a semitone, to E flat 4. C minor.',
    )
    expect(SPEC).toContain(`"${minor}"`)
    expect(stacked).toBe('Stacked: C, E, G. C major.')
    expect(SPEC).toContain(`"${stacked}"`)
    expect(qualityLine(C_MAJOR)).toBe(
      'Major: the third moved up a semitone, to E 4. C major.',
    )
    expect(
      changedLine('root-higher', { kind: 'chord', root: 62, quality: 'major' }),
    ).toBe('Root higher: D, F sharp, A. D major.')
    expect(
      changedLine('scale', { kind: 'scale', root: 60, quality: 'major' }),
    ).toBe('Scale: C, D, E, F, G, A, B, C. C major scale.')
  })

  it("announce Step 1's switch on the top note, and Step 5's on the scale's letters", () => {
    // Act
    const third = qualityLine({ kind: 'third', root: 60, quality: 'minor' })
    const scale = qualityLine({ kind: 'scale', root: 60, quality: 'minor' })

    // Assert
    expect(third).toBe(
      'Minor: the top note moved down a semitone, to E flat 4. A minor third.',
    )
    expect(scale).toBe(
      'Minor: C, D, E flat, F, G, A flat, B flat, C. C natural minor.',
    )
  })

  it('label the gaps, the bracket and the name strip, and read the pattern as set', () => {
    // Act
    const strips = [
      nameStrip(C_MAJOR),
      nameStrip(C_MINOR),
      nameStrip({ kind: 'third', root: 60, quality: 'major' }),
    ]

    // Assert: WEB-SPEC, Toys 1, Drawing and Pattern, every example the spec's
    expect([gapLabel(4), gapLabel(3), FIFTH_LABEL]).toEqual([
      '4 · major third',
      '3 · minor third',
      '7 · perfect fifth',
    ])
    expect(strips).toEqual([
      'C major · do-mi-so',
      'C minor · do-me-so',
      'Major third · 4 semitones',
    ])
    expect(patternReadout(60, 'minor', 'slow')).toBe('C minor · slow')
    for (const line of [
      gapLabel(4),
      gapLabel(3),
      FIFTH_LABEL,
      ...strips,
      patternReadout(60, 'minor', 'slow'),
    ])
      expect(SPEC).toContain(`"${line}"`)
  })

  it('refuse a gap that is no third', () => {
    // Act
    const tone = (): string => gapLabel(2)

    // Assert
    expect(tone).toThrow()
  })
})

describe('the hero', () => {
  it("says the chord and each move in the spec's and LESSON.md's words", () => {
    // Act
    const chord = heroChordLine()
    const moves = MOVES.map(heroMoveLine)

    // Assert: WEB-SPEC, Toys 2; LESSON.md, Cold open
    expect(chord).toBe('C, E and G together.')
    expect(SPEC).toContain(`"${chord}"`)
    expect(moves).toEqual([
      'Mi moved down a semitone: C, E flat, G.',
      'So moved down a semitone: C, E, G flat.',
    ])
    for (const line of moves) expect(LESSON).toContain(`"${line}"`)
  })
})

describe('the predicts', () => {
  it('take every hint and guess line from LESSON.md, word for word', () => {
    // Arrange
    const lines = [COLD_PREDICT, SCALE_PREDICT].flatMap((p) => [
      p.lock,
      ...Object.values(p.hints),
      ...Object.values(p.guess),
    ])

    // Act
    const missing = lines.filter((line) => !LESSON.includes(`"${line}"`))

    // Assert: LESSON.md, Cold open and Step 5; WEB-SPEC, Toys 3
    expect(lines).toHaveLength(14)
    expect(missing).toEqual([])
  })

  it('say what was chosen, never right or wrong', () => {
    // Act
    const guesses = [
      ...Object.values(COLD_PREDICT.guess),
      ...Object.values(SCALE_PREDICT.guess),
    ]

    // Assert
    expect(guesses).toEqual([
      'You said: mi',
      'You said: so',
      'You said: just one',
      'You said: three',
    ])
    for (const g of guesses) expect(g).not.toMatch(/right|wrong|correct/i)
  })
})

describe('Sing it', () => {
  it("writes LESSON.md's lines word for word, and the spec's hints", () => {
    // Act
    const { listen, moved, gentle, enough, first, silent } = SING_LINES

    // Assert: LESSON.md, Sing it; WEB-SPEC, Toys 6
    for (const line of [moved, gentle, enough])
      expect(LESSON).toContain(`"${line}"`)
    expect(LESSON).toContain(`"${listen} If hoarseness`)
    for (const line of [first, silent]) expect(SPEC).toContain(`"${line}"`)
  })
})

describe('every line', () => {
  it('passes the guided-voice claims check as a finding, on every root and in every view', () => {
    for (const line of [...spokenLines(), ...shownLines()]) {
      // Act
      const result = validateGuidedDynamicClaim({
        surface: 'finding',
        text: line,
      })

      // Assert
      expect(result.violations, line).toEqual([])
    }
  })

  it('holds no sharp or flat sign in an accessible name or a live line, saying each in words', () => {
    // Arrange
    const lines = spokenLines()

    // Act
    const signed = lines.filter((line) => /[♯♭]/.test(line))

    // Assert: Contract, words only; the black keys are there, said
    expect(signed).toEqual([])
    expect(lines.some((line) => /\b[A-G] sharp \d\b/.test(line))).toBe(true)
    expect(lines.some((line) => /\b[A-G] flat \d\b/.test(line))).toBe(true)
  })

  it('shows no sign either, since every root is a white key', () => {
    // Act
    const signed = shownLines().filter((line) => /[♯♭]/.test(line))

    // Assert
    expect(signed).toEqual([])
  })
})
