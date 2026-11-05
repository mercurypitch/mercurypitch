// ============================================================
// Twinkle — "Twinkle, Twinkle, Little Star", its whole first verse
// ============================================================
//
// The series' one tune, written once (Lesson 14 WEB-SPEC, What the kit and
// the app still need, 6): the first verse as the published score has it,
// six lines of seven notes, crotchets with a minim at each line's end, two
// bars of 4/4 a line (Lesson 14 FACTS 17). Each note is a scale degree from
// do, so the tune starts on any note and is spelled as Lesson 4 spells
// that key (major-scale.ts): do to la, never ti (FACTS 18). Each note
// carries its syllable as a screen reader says it ("twin", "kle") and as
// the score prints it, its hyphen kept where the word goes on ("Twin-",
// "kle,"). Lesson 6's page sings the first two lines (lesson-06/melody.ts);
// Lesson 14's page sings the verse.
//
// Beside the notes: the chords Lesson 14's page plays under its lines, one
// a minim, the plainest of the tune's usual three (I, IV and V; FACTS 43),
// and the five breath marks of the verse at 80 beats a minute, each 0.3 s
// before the end of a line's long note, so the breath takes its time from
// the note before it and the beat does not move (FACTS 26, 85).

/** One note of a tune: its scale degree (0 do to 5 la), its length in crotchets, and its syllable. */
export interface MelodyNote {
  /** An index into the major scale, 0 do, 1 re, 2 mi, 3 fa, 4 so, 5 la. */
  readonly degree: number
  /** 1 a crotchet, 2 a minim. */
  readonly beats: number
  /** The sung syllable, as a screen reader says it ("twin", "kle"). */
  readonly syllable: string
}

/** A note of the verse: its syllable as the score prints it too ("Twin-", "kle,"). */
export interface VerseNote extends MelodyNote {
  readonly printed: string
}

/** A chord of the page's, by its numeral: built on do, fa or so. */
export type Numeral = 'I' | 'IV' | 'V'

const n = (
  degree: number,
  syllable: string,
  printed: string,
  beats = 1,
): VerseNote => ({ degree, beats, syllable, printed })

const LINE_1: readonly VerseNote[] = [
  n(0, 'twin', 'Twin-'),
  n(0, 'kle', 'kle,'),
  n(4, 'twin', 'twin-'),
  n(4, 'kle', 'kle,'),
  n(5, 'lit', 'lit-'),
  n(5, 'tle', 'tle'),
  n(4, 'star', 'star,', 2),
]

const LINE_2: readonly VerseNote[] = [
  n(3, 'How', 'How'),
  n(3, 'I', 'I'),
  n(2, 'won', 'won-'),
  n(2, 'der', 'der'),
  n(1, 'what', 'what'),
  n(1, 'you', 'you'),
  n(0, 'are', 'are!', 2),
]

const LINE_3: readonly VerseNote[] = [
  n(4, 'Up', 'Up'),
  n(4, 'a', 'a-'),
  n(3, 'bove', 'bove'),
  n(3, 'the', 'the'),
  n(2, 'world', 'world'),
  n(2, 'so', 'so'),
  n(1, 'high', 'high,', 2),
]

const LINE_4: readonly VerseNote[] = [
  n(4, 'like', 'like'),
  n(4, 'a', 'a'),
  n(3, 'dia', 'dia-'),
  n(3, 'mond', 'mond'),
  n(2, 'in', 'in'),
  n(2, 'the', 'the'),
  n(1, 'sky', 'sky.', 2),
]

/**
 * The first verse (FACTS 17, 18): do do so so la la so; fa fa mi mi re re
 * do; so so fa fa mi mi re, twice; then the first two lines again.
 */
export const VERSE: readonly (readonly VerseNote[])[] = [
  LINE_1,
  LINE_2,
  LINE_3,
  LINE_4,
  LINE_1,
  LINE_2,
]

/**
 * The page's chords under each line, one a minim (FACTS 43): line 1 I I IV
 * I, line 2 IV I V I, lines 3 and 4 I IV I V, lines 5 and 6 as 1 and 2.
 */
export const VERSE_CHORDS: readonly (readonly Numeral[])[] = [
  ['I', 'I', 'IV', 'I'],
  ['IV', 'I', 'V', 'I'],
  ['I', 'IV', 'I', 'V'],
  ['I', 'IV', 'I', 'V'],
  ['I', 'I', 'IV', 'I'],
  ['IV', 'I', 'V', 'I'],
]

/**
 * Each chord's notes, semitones above do: the major triad built on do, fa
 * or so, in root position from the melody's own octave (FACTS 43, 82):
 * from D3, I is D3 F♯3 A3, IV G3 B3 D4 and V A3 C♯4 E4.
 */
export const CHORD_STEPS: Readonly<Record<Numeral, readonly number[]>> = {
  I: [0, 4, 7],
  IV: [5, 9, 12],
  V: [7, 11, 14],
}

/** Beats a minute: a crotchet 0.75 s, a line 6 s, the verse 36 s (FACTS 20). */
export const BPM = 80
export const BEAT_SEC = 60 / BPM
/** Beats in a line: two bars of 4/4. */
export const LINE_BEATS = 8
export const LINE_SEC = LINE_BEATS * BEAT_SEC
export const VERSE_SEC = VERSE.length * LINE_SEC

/** A breath, seconds: taken from the end of the note before it (FACTS 26, 31). */
export const BREATH_SEC = 0.3

/**
 * The verse's breath marks, seconds from its start: at the end of each line
 * but the last, 0.3 s before the next line begins (FACTS 85), 5.7, 11.7,
 * 17.7, 23.7 and 29.7 s.
 */
export const VERSE_BREATHS: readonly number[] = VERSE.slice(0, -1).map(
  (_, i) => Math.round(((i + 1) * LINE_SEC - BREATH_SEC) * 10) / 10,
)

/** When each note of a line starts and ends, in beats from the line's start. */
export function lineBeats(
  line: readonly MelodyNote[],
): { readonly from: number; readonly to: number }[] {
  let at = 0
  return line.map((note) => {
    const from = at
    at += note.beats
    return { from, to: at }
  })
}
