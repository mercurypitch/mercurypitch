// ============================================================
// Lesson 25's toy in words — the staircase, the chord column and the switches, said
// ============================================================
//
// What the steps' toy says (WEB-SPEC, Toys 1, Readouts and names, and
// Contract): the staircase's name for a screen reader, "A harmonic minor,
// do to do: A, B, C, D, E, F, G sharp, A. Steps of 2, 1, 2, 2, 1, 3 and 1
// semitones."; the chord column's chord, one letter per chord tone, with
// its gaps and its name, "E, G sharp, B: 4 and 3 semitones, E major."; and
// each switch's change, "Te raised to ti: G sharp 3." Every note is spelled
// one letter per degree (kit/chords.ts). Pure: no DOM.

import type { ColumnChord } from '@/features/lessons/kit/chord-column'
import type { ChordTone, Raises } from '@/features/lessons/kit/chords'
import { chordOnSo, gapsOf, HARMONIC_MINOR_DEGREES, MELODIC_MINOR_UP_DEGREES, minorScale, NATURAL_MINOR_DEGREES, qualityOf, scaleOf, } from '@/features/lessons/kit/chords'
import { MAJOR_DEGREES } from '@/features/lessons/kit/major-scale'
import { signName, wordName } from '@/features/lessons/kit/notes'
import { sameDegrees } from '@/features/lessons/kit/stairs-scales'
import { risersSaid } from '@/features/lessons/kit/stairs-words'
import type { Look, PlayId } from './sounds'
import { HARMONIC, MELODIC, NATURAL } from './sounds'

/** A note's letter in words, no octave: "G sharp". */
const letter = (n: ChordTone): string => wordName(n.spelled, { octave: false })

/** The scales the staircase draws, by their stairs. */
const FORMS: readonly {
  readonly degrees: readonly number[]
  readonly name: string
  readonly raises: Raises | null
}[] = [
  { degrees: NATURAL_MINOR_DEGREES, name: 'natural minor', raises: NATURAL },
  { degrees: HARMONIC_MINOR_DEGREES, name: 'harmonic minor', raises: HARMONIC },
  {
    degrees: MELODIC_MINOR_UP_DEGREES,
    name: 'melodic minor, going up',
    raises: MELODIC,
  },
  { degrees: MAJOR_DEGREES, name: 'major', raises: null },
]

/** The staircase's scale in words, and its notes: "A harmonic minor" with A, B, C, D, E, F, G sharp, A. */
function scaleOfLook(look: Look): { name: string; tones: ChordTone[] } {
  const form =
    FORMS.find((f) => sameDegrees(f.degrees, look.degrees)) ?? FORMS[0]
  const tones =
    form.raises === null
      ? scaleOf(look.tonic, 'major')
      : minorScale(look.tonic, form.raises)
  return { name: `${letter(tones[0])} ${form.name}`, tones }
}

/** The staircase for a screen reader: its scale, its notes and its steps. */
export function lookSaid(look: Look): string {
  const { name, tones } = scaleOfLook(look)
  const notes = tones.map(letter).join(', ')
  return `${name}, do to do: ${notes}. Steps of ${risersSaid(look.degrees)} semitones.`
}

/**
 * The chord column's chord on so, on `tonic`'s minor key: "E3, G♯3, B3",
 * "E major". With `octave` false its names have none, "E, G♯, B": the
 * hero's column stands on its staircase's rows, an octave over the chord
 * its endings sound (cold-open.ts).
 */
export function columnChord(
  tonic: number,
  raised: boolean,
  octave = true,
): ColumnChord {
  const tones = chordOnSo(tonic, raised)
  return {
    notes: tones.map((n) => n.midi),
    names: tones.map((n) => signName(n.spelled, { octave })),
    label: `${signName(tones[0].spelled, { octave: false })} ${qualityOf(tones)}`,
  }
}

/** The chord on so in words: "E, G sharp, B: 4 and 3 semitones, E major." */
export function chordSaid(tonic: number, raised: boolean): string {
  const tones = chordOnSo(tonic, raised)
  const [low, high] = gapsOf(tones.map((n) => n.midi))
  return `${tones.map(letter).join(', ')}: ${low} and ${high} semitones, ${letter(tones[0])} ${qualityOf(tones)}.`
}

/** What a switch says as it moves: "Te raised to ti: G sharp 3." */
export function raiseSaid(
  which: 'te' | 'le',
  on: boolean,
  tonic: number,
): string {
  const stair = which === 'te' ? 6 : 5
  const natural = minorScale(tonic, NATURAL)[stair].spelled
  const raised = minorScale(tonic, MELODIC)[stair].spelled
  if (which === 'te')
    return on
      ? `Te raised to ti: ${wordName(raised)}.`
      : `Ti back down to te: ${wordName(natural)}.`
  return on
    ? `Le raised to la, going up: ${wordName(raised)}. Coming down, both fall back.`
    : `La back down to le: ${wordName(natural)}.`
}

/**
 * What a play says as each of its figures starts: what it sounds, and what
 * it changes on the staircase. The chord on so's line is the column's own
 * (`chordHomeSaid`), and Play the scale says the form the switches set, so
 * the toy picks those (minor-toy.ts `figureLine`).
 */
export const FIGURE_SAID: Readonly<
  Partial<Record<PlayId, readonly (string | null)[]>>
> = {
  'so-te-do': ['So, te, do: te a tone under do.'],
  'so-ti-do': ['So, ti, do: te lifts to ti, a semitone under do.'],
  harmonic: ['A harmonic minor: te raised to ti, and le to ti is 3 semitones.'],
  'le-pairs': [
    'Le to te, F to G: 2 semitones.',
    'Le to ti, F to G sharp: 3 semitones.',
  ],
  melodic: [
    'A melodic minor, going up: le and te lift to la and ti.',
    'Coming down, la and ti fall back to le and te.',
  ],
  'major-melodic': [
    'A major: its third stair is mi, C sharp.',
    'A melodic minor, going up: me, C, where major has mi.',
  ],
  relative: [
    'C major, do on C.',
    'A minor on the same white piano keys: do moves from C down to A, which was la.',
  ],
  'c-minor': [
    'C minor: E flat, A flat and B flat, each written with its own sign.',
  ],
}

/** Play the scale, up and down, in the form the switches set: natural minor's line. */
export const NATURAL_SCALE_SAID = 'A natural minor, up and down.'

/** The chord on so, then home: its column's chord, then home's. */
export const chordHomeSaid = (tonic: number, raised: boolean): string =>
  `${chordSaid(tonic, raised)} Then home: A, C, E, A minor.`
