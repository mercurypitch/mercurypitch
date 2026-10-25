// ============================================================
// Lesson 10 lines — what the page's toys, predicts and Sing it say, in words
// ============================================================
//
// Every line template of WEB-SPEC Toys 1, 2, 3 and 6, pure, so the tests
// hold each one to the guided-voice claims check and to LESSON.md's words.
//
// The chord beads (Toys 1): the figure's summary for what it shows, each
// bead's and gap button's name, the polite line each action announces, the
// gap labels, the bracket, the name strip and Step 4's readout. The hero
// (Toys 2): its live lines as the chord plays and as a move lands. The
// predicts (Toys 3): their lock hints, hints and "You said" lines. Sing it
// (Toys 6): the lines its script writes; the comfort check, the voice
// choice's two lines and the doctor lines are Lesson 3's markup.
//
// A note that is spoken (an accessible name, a live line) is in words,
// "E flat 4", never the sign (Contract), through the kit's `wordName`, with
// a space before every octave as the spec writes it, "C 4", as Lesson 6's
// tune words do. No shown line here can carry a sign: every root is a white
// key, so the names, the labels and the readout are letters and numbers.
// Where the spec gives one example of a template, "C major: C 4, E 4, G 4.
// ...", "Stacked: C, E, G. C major.", the others follow its form.

import type { Spelled } from '@/features/lessons/kit/notes'
import { wordName } from '@/features/lessons/kit/notes'
import type { ChordTone, Quality } from './chords'
import { FIFTH, scaleOf, THIRD_OF, thirdOf, tone, triad } from './chords'
import type { MoveId, Tempo } from './sounds'

/** What the chord beads show: Step 1's third, a triad, or its scale spread out. */
export type ViewKind = 'third' | 'chord' | 'scale'

export interface View {
  readonly kind: ViewKind
  /** A white-key root, C4 to B4. */
  readonly root: number
  readonly quality: Quality
}

const capital = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1)

/** A note as a screen reader says it: "C 4", "E flat 4" (a space before every octave). */
export function said(s: Spelled): string {
  return s.alter === 0 ? `${s.letter} ${s.octave}` : wordName(s)
}

/** A note's letter as said, with no octave: "C", "E flat". */
const letter = (t: ChordTone): string => wordName(t.spelled, { octave: false })

/** A list of notes said with their octaves: "C 4, E 4, G 4". */
const saidAll = (notes: readonly ChordTone[]): string =>
  notes.map((n) => said(n.spelled)).join(', ')

/** A list of letters: "C, E flat, G". */
const letters = (notes: readonly ChordTone[]): string =>
  notes.map(letter).join(', ')

/** A third by its size: "major third" (4) or "minor third" (3) (FACTS 12). */
export function thirdWord(semitones: number): string {
  if (semitones === THIRD_OF.major) return 'major third'
  if (semitones === THIRD_OF.minor) return 'minor third'
  throw new Error(`lesson 10: a gap of ${semitones} is no third`)
}

/** A chord's name: "C major", "D minor". */
export const chordName = (root: number, quality: Quality): string =>
  `${letter(triad(root, quality)[0])} ${quality}`

/** A scale's name, as LESSON.md's Step 5 says them: "C major scale", "C natural minor". */
export const scaleName = (root: number, quality: Quality): string =>
  quality === 'major'
    ? `${chordName(root, quality)} scale`
    : `${letter(triad(root, quality)[0])} natural minor`

/** The notes a view shows: the third's two, the triad's three, or the scale's eight. */
export function notesOf(v: View): ChordTone[] {
  if (v.kind === 'third') return thirdOf(v.root, v.quality)
  if (v.kind === 'chord') return triad(v.root, v.quality)
  return scaleOf(v.root, v.quality)
}

/** The neighbouring pairs a view's gap buttons play: one for a third, two for a triad, none for a scale. */
function gapsOf(v: View): [ChordTone, ChordTone][] {
  if (v.kind === 'scale') return []
  const notes = notesOf(v)
  return notes.slice(1).map((hi, i) => [notes[i], hi])
}

// -------------------------------------------------------------- the chord beads, shown

/** A gap button's label: "4 · major third" (WEB-SPEC, Toys 1, Drawing). */
export const gapLabel = (semitones: number): string =>
  `${semitones} · ${thirdWord(semitones)}`

/** The bracket from the root to the fifth (Steps 2 to 4, and free play). */
export const FIFTH_LABEL = `${FIFTH} · perfect fifth`

/** The name strip: the chord, "C major · do-mi-so", or Step 1's third, "Major third · 4 semitones". */
export function nameStrip(v: View): string {
  if (v.kind === 'third') {
    const size = THIRD_OF[v.quality]
    return `${capital(thirdWord(size))} · ${size} semitones`
  }
  // the triad's syllables: do-mi-so, or do-me-so in do-based minor (FACTS 8, 19)
  const syllables = v.quality === 'major' ? 'do-mi-so' : 'do-me-so'
  return `${chordName(v.root, v.quality)} · ${syllables}`
}

/** Step 4's readout, what is set: "C minor · slow" (WEB-SPEC, Toys 1, Pattern). */
export const patternReadout = (
  root: number,
  quality: Quality,
  tempo: Tempo,
): string => `${chordName(root, quality)} · ${tempo}`

// -------------------------------------------------------------- the chord beads, spoken

/**
 * The figure's summary, which changes with what it shows: "C major: C 4,
 * E 4, G 4. Gaps of 4 and 3 semitones; root to fifth 7, a perfect fifth."
 * (WEB-SPEC, Toys 1, Keyboard and screen readers).
 */
export function summary(v: View): string {
  const notes = notesOf(v)
  if (v.kind === 'scale')
    return `${scaleName(v.root, v.quality)}: ${saidAll(notes)}.`
  const sizes = gapsOf(v).map(([lo, hi]) => hi.midi - lo.midi)
  if (v.kind === 'third')
    return `${capital(thirdWord(sizes[0]))}: ${saidAll(notes)}. A gap of ${sizes[0]} semitones.`
  return (
    `${chordName(v.root, v.quality)}: ${saidAll(notes)}. ` +
    `Gaps of ${sizes[0]} and ${sizes[1]} semitones; root to fifth ${FIFTH}, a perfect fifth.`
  )
}

/** Each bead's role, as the step's text names it: Step 1 has two notes, not yet a chord. */
const ROLE_WORDS: Readonly<Record<'third' | 'chord', readonly string[]>> = {
  third: ['the bottom note', 'the top note'],
  chord: ['the root', 'the third', 'the fifth'],
}

/** Each bead's button, from the root up: "C 4, the root"; none in the scale, where no stair is a target. */
export function beadNames(v: View): string[] {
  if (v.kind === 'scale') return []
  const roles = ROLE_WORDS[v.kind]
  return notesOf(v).map((n, i) => `${said(n.spelled)}, ${roles[i]}`)
}

/**
 * Each gap button, starting with what it shows, then what it plays: "4,
 * major third: C 4 up to E 4". As Lesson 6's gap buttons do, the name
 * begins with the label, so a voice control user can say what they see
 * (WCAG 2.5.3).
 */
export function gapNames(v: View): string[] {
  return gapsOf(v).map(([lo, hi]) => {
    const size = hi.midi - lo.midi
    return `${size}, ${thirdWord(size)}: ${said(lo.spelled)} up to ${said(hi.spelled)}`
  })
}

/**
 * The polite line after Major · Minor, for the view it leaves: "Minor: the
 * third moved down a semitone, to E flat 4. C minor." In Step 1 the moving
 * bead is the top note, not yet a chord's third; spread into a scale, the
 * line reads the scale's letters.
 */
export function qualityLine(v: View): string {
  const word = capital(v.quality)
  if (v.kind === 'scale')
    return `${word}: ${letters(notesOf(v))}. ${scaleName(v.root, v.quality)}.`
  const moved = notesOf(v)[1]
  const way = v.quality === 'minor' ? 'down' : 'up'
  const what = v.kind === 'third' ? 'the top note' : 'the third'
  const after =
    v.kind === 'third'
      ? `A ${thirdWord(THIRD_OF[v.quality])}`
      : chordName(v.root, v.quality)
  return `${word}: ${what} moved ${way} a semitone, to ${said(moved.spelled)}. ${after}.`
}

/** A view with a chord's name: a triad, or its scale (Step 1's third has no Slide and no stacking). */
export type ChordOrScale = View & { readonly kind: 'chord' | 'scale' }

/** The other actions a polite line reports. */
export type Action = 'stack' | 'root-lower' | 'root-higher' | 'chord' | 'scale'

const ACTION_WORDS: Readonly<Record<Action, string>> = {
  stack: 'Stacked',
  'root-lower': 'Root lower',
  'root-higher': 'Root higher',
  chord: 'Chord',
  scale: 'Scale',
}

/**
 * The polite line after Stack a third, a slide or Chord · Scale, for the
 * view it leaves, in the form of "Stacked: C, E, G. C major.": the letters
 * it now shows, then their name.
 */
export function changedLine(action: Action, v: ChordOrScale): string {
  const name =
    v.kind === 'scale'
      ? scaleName(v.root, v.quality)
      : chordName(v.root, v.quality)
  return `${ACTION_WORDS[action]}: ${letters(notesOf(v))}. ${name}.`
}

// -------------------------------------------------------------- the hero

/** C4, E4 and G4, the cold open's chord, with one note moved down a semitone on its own letter. */
function coldChord(move: MoveId | null): ChordTone[] {
  const notes = triad(60, 'major')
  if (move === null) return notes
  const k = move === 'mi' ? 1 : 2
  return notes.map((n, i) => (i === k ? tone(n.midi - 1, n.spelled.letter) : n))
}

/** The hero's live line as the chord plays: "C, E and G together." (WEB-SPEC, Toys 2). */
export function heroChordLine(): string {
  const [c, e, g] = coldChord(null).map(letter)
  return `${c}, ${e} and ${g} together.`
}

/** The hero's live line as a move lands: "Mi moved down a semitone: C, E flat, G." (LESSON.md). */
export const heroMoveLine = (move: MoveId): string =>
  `${capital(move)} moved down a semitone: ${letters(coldChord(move))}.`

// -------------------------------------------------------------- the predicts

/** A predict's lines: its lock hint in the markup, its hints for the kit, and its "You said" lines. */
export interface PredictLines<C extends string> {
  readonly lock: string
  readonly hints: {
    readonly chosen: string
    readonly next: string
    readonly silent: string
    readonly again: string
  }
  readonly guess: Readonly<Record<C, string>>
}

/** The cold open's predict, [ Mi ] [ So ] (LESSON.md; WEB-SPEC, Toys 3). */
export const COLD_PREDICT: PredictLines<MoveId> = {
  lock: 'Choose an answer to unlock the two moves.',
  hints: {
    chosen:
      'Locked in. Move mi down, then move so down, and listen to each chord.',
    next: 'Now hear both moves, mi down and so down, for the answer.',
    silent:
      'Sound is off, so nothing played. Turn sound on to hear the chord, then play it again.',
    again: 'Move either note again, or play the chord.',
  },
  guess: { mi: 'You said: mi', so: 'You said: so' },
}

/** Step 5's two choices: [ Just one: mi ] [ Three ]. */
export type ScaleChoice = 'one' | 'three'

/** Step 5's predict (LESSON.md; WEB-SPEC, Toys 3). */
export const SCALE_PREDICT: PredictLines<ScaleChoice> = {
  lock: 'Choose an answer to unlock the two scales.',
  hints: {
    chosen: 'Locked in. Play C major, then C minor, and watch the staircase.',
    next: 'Now play the other one.',
    silent:
      'Sound is off, so nothing played. Turn sound on to hear them, then press Play C minor.',
    again: 'Play them again, or switch the names to do-re-mi.',
  },
  guess: { one: 'You said: just one', three: 'You said: three' },
}

// -------------------------------------------------------------- Sing it

/** The lines Sing it's script writes (LESSON.md; WEB-SPEC, Toys 6). */
export const SING_LINES = {
  /** "Just listen today", before Lesson 3's doctor lines. */
  listen:
    'Good call. Merc sings do-mi-so and do-me-so, and nothing listens. Rest your voice.',
  /** Start the guide's hint until Merc's notes have played with sound on. */
  first: "Play Merc's notes first",
  /** After Play Merc's notes with sound off. */
  silent:
    "Sound is off, so nothing played. Turn sound on to hear Merc's notes, then start the guide.",
  /** Easy or Workable: it names the task, never the voice. */
  moved: 'Do-mi-so, then do-me-so: you just moved the third.',
  /** Effortful: Lesson 3's gentle line. */
  gentle: 'Keep it gentle: rest before you sing again.',
  /** Uncomfortable: Lesson 3's enough-for-today line. */
  enough:
    "Thanks for saying so. That's enough singing for today: rest your voice.",
} as const
