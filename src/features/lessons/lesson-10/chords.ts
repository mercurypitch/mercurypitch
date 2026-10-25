// ============================================================
// Lesson 10 chords — the triads and scales the page draws, spelled by letter
// ============================================================
//
// The chord and scale facts every Lesson 10 toy reads, pure. A triad is a
// third and a fifth above its root by letter, so C minor's third is E♭4,
// never D♯4 (FACTS 10, 19): its notes are its scale's first, third and
// fifth, do, mi and so in major, do, me and so in natural minor (FACTS 28),
// each spelled through the kit's `spellScale`, one letter per degree. The
// roots are the seven white keys from C4 to B4, so every chord a slide
// reaches is one of FACTS 19's fourteen, with no double sign and no E♯, B♯,
// C♭ or F♭, and every note lies in the window from C4 to F♯5, B major's
// fifth (FACTS 70a). Natural minor climbs 2, 1, 2, 2, 1, 2, 2 semitones
// and sits a semitone under the major scale on degrees 3, 6 and 7 (FACTS
// 22, 24). Stacking in thirds goes by letter as well, so B, E, G is E, G,
// B, E minor (FACTS 41a), and C, E, G♭ stacks but is neither major nor
// minor, its fifth 6 semitones (FACTS 41b).

import { MAJOR_DEGREES } from '@/features/lessons/kit/major-scale'
import type { Letter, Spelled } from '@/features/lessons/kit/notes'
import { letterOf, spellOn, spellScale } from '@/features/lessons/kit/notes'

/** The two qualities this lesson teaches (FACTS 20). */
export type Quality = 'major' | 'minor'

export const QUALITIES: readonly Quality[] = ['major', 'minor']

/** What a set of notes makes: one of the two, or neither (FACTS 41b). */
export type ChordQuality = Quality | 'neither'

/** A note as the page draws it: its MIDI number and its spelling. */
export interface ChordTone {
  readonly midi: number
  readonly spelled: Spelled
}

/** A triad's notes in order from its root, as `triad` returns them. */
export type Role = 'root' | 'third' | 'fifth'

export const ROLES: readonly Role[] = ['root', 'third', 'fifth']

/** Semitones from the root to the third: 4 major, 3 minor (FACTS 12, 17). */
export const THIRD_OF: Readonly<Record<Quality, number>> = {
  major: 4,
  minor: 3,
}

/** Semitones from the root to the fifth, a perfect fifth in either quality (FACTS 16, 17). */
export const FIFTH = 7

/**
 * The natural minor scale's eight notes as semitones above the tonic, do to
 * do (FACTS 22, 27; the app's own, FACTS 30).
 */
export const NATURAL_MINOR_DEGREES: readonly number[] = [
  0, 2, 3, 5, 7, 8, 10, 12,
]

/** The degrees natural minor lowers a semitone against the major scale: mi, la and ti (FACTS 24). */
export const LOWERED_DEGREES: readonly number[] = [3, 6, 7]

/** Each quality's scale, do to do, as semitones above the root. */
export const DEGREES: Readonly<Record<Quality, readonly number[]>> = {
  major: MAJOR_DEGREES,
  minor: NATURAL_MINOR_DEGREES,
}

/** The white-key roots a slide steps through, C4 to B4 (WEB-SPEC, Toys 1, Slide; FACTS 19). */
export const ROOTS: readonly number[] = [60, 62, 64, 65, 67, 69, 71]

/** The chord beads' window, C4 to F♯5: every note of every chord a slide reaches (FACTS 70a). */
export const WINDOW = { lo: 60, hi: 78 } as const

const LETTER_ORDER = 'CDEFGAB'

/** A white-key root's letter; a black key is no root here. */
function rootLetter(root: number): Letter {
  const letter = letterOf(root)
  if (letter === null || !ROOTS.includes(root))
    throw new Error(`lesson 10: ${root} is not a white-key root from C4 to B4`)
  return letter as Letter
}

/** A MIDI note spelled on `letter`. */
export const tone = (midi: number, letter: Letter): ChordTone => ({
  midi,
  spelled: spellOn(midi, letter),
})

/** The scale on a white-key root, do to do, one letter per degree (FACTS 27). */
export function scaleOf(root: number, quality: Quality): ChordTone[] {
  const degrees = DEGREES[quality]
  return spellScale(rootLetter(root), root, degrees).map((spelled, i) => ({
    midi: root + degrees[i],
    spelled,
  }))
}

/** The triad on a white-key root: root, third and fifth, the scale's degrees 1, 3 and 5 (FACTS 19, 28). */
export function triad(root: number, quality: Quality): ChordTone[] {
  const scale = scaleOf(root, quality)
  return [scale[0], scale[2], scale[4]]
}

/** Step 1's two notes: the root and the third above it. */
export const thirdOf = (root: number, quality: Quality): ChordTone[] =>
  triad(root, quality).slice(0, 2)

/** The next white-key root lower (-1) or higher (1), or null past C4 or B4 (WEB-SPEC, Edge cases). */
export function nextRoot(root: number, dir: -1 | 1): number | null {
  const i = ROOTS.indexOf(root)
  if (i < 0) return null
  return ROOTS[i + dir] ?? null
}

const letterIndex = (s: Spelled): number => LETTER_ORDER.indexOf(s.letter)

/**
 * Three notes stacked in thirds by letter, root first, each moved by
 * octaves to sit within an octave above the root, which keeps its place;
 * null when no order of the three stacks (FACTS 15, 41a).
 */
export function stackInThirds(notes: readonly ChordTone[]): ChordTone[] | null {
  if (notes.length !== 3) return null
  for (const root of notes) {
    const others = notes.filter((n) => n !== root)
    const steps = others.map(
      (n) => (letterIndex(n.spelled) - letterIndex(root.spelled) + 7) % 7,
    )
    const third = others[steps.indexOf(2)]
    const fifth = others[steps.indexOf(4)]
    if (third === undefined || fifth === undefined) continue
    const above = (n: ChordTone): ChordTone =>
      tone(
        root.midi + ((((n.midi - root.midi) % 12) + 12) % 12),
        n.spelled.letter,
      )
    return [root, above(third), above(fifth)]
  }
  return null
}

/**
 * What three notes make, stacked in thirds: major with a third of 4
 * semitones and a perfect fifth, minor with 3 and a perfect fifth, and
 * otherwise neither (FACTS 16, 17, 41b).
 */
export function qualityOf(notes: readonly ChordTone[]): ChordQuality {
  const stacked = stackInThirds(notes)
  if (stacked === null) return 'neither'
  const [root, third, fifth] = stacked
  if (fifth.midi - root.midi !== FIFTH) return 'neither'
  const gap = third.midi - root.midi
  if (gap === THIRD_OF.major) return 'major'
  if (gap === THIRD_OF.minor) return 'minor'
  return 'neither'
}
