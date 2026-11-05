// ============================================================
// Staff places — where a written note sits on a staff, and what a reader calls it
// ============================================================
//
// The staff toy's arithmetic (staff.ts draws and plays it; Lesson 15's
// WEB-SPEC, Toys 1). A note's place is counted in letters from its staff's
// bottom line: on the treble staff E4 is 0 and F5 is 8, on the bass staff
// G2 is 0 and A3 is 8; even places are lines and odd ones spaces. The grand
// staff is the series' compact one, a bass staff under a treble staff with
// middle C between them: one column of places from G2 (0) to F5 (20), the
// bass staff's lines at 0 to 8, the treble's at 12 to 20 and middle C's
// ledger line at 10, so it writes the 21 white keys from G2 to F5 with no
// ledger line but middle C's (Lesson 15 FACTS 21).
//
// Ledger lines are drawn at the even places past a staff, only as far out as
// the note that needs them (FACTS 18). A black key is written on its
// letter's place with its sign, by its sharp unless spelled otherwise, as
// the app names it (FACTS 10, 24). Every place has words for a screen
// reader, its letter and octave first ("C4, one ledger line below"), and
// every sign is said as a word (kit/notes.ts `wordName`).
//
// Pure: no DOM, no sound. Lessons 16 to 28 read the staff the same way.

import type { Letter, Spelled } from './notes'
import { sharpOf, wordName } from './notes'
import type { Voice } from './voice-choice'

export type Clef = 'treble' | 'bass'
/** One staff in its clef, or the grand staff: treble above bass, meeting at middle C. */
export type StaffKind = Clef | 'grand'

const LETTERS: readonly Letter[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B']
const NATURAL: Readonly<Record<Letter, number>> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
}

/** A written note's letter step from C0: octave × 7 + its letter's place. E4 is 30. */
export const diatonicOf = (s: Spelled): number =>
  s.octave * 7 + LETTERS.indexOf(s.letter)

/** The plain note at letter step `d`: 30 is E4. */
export function spelledAt(d: number): Spelled {
  const letter = LETTERS[((d % 7) + 7) % 7]
  return { letter, alter: 0, octave: Math.floor(d / 7) }
}

/** The MIDI note a written note sounds: F♯4 is 66. */
export const midiOf = (s: Spelled): number =>
  12 * (s.octave + 1) + NATURAL[s.letter] + s.alter

/** A sounding note as the staff writes it: its letter, or a black key's sharp (FACTS 10). */
export const writtenOf = (midi: number): Spelled => sharpOf(midi)

/** Each staff's bottom line, as a letter step: E4 on the treble staff, G2 on the bass and the grand staff. */
export const BOTTOM: Readonly<Record<StaffKind, number>> = {
  treble: 30,
  bass: 18,
  grand: 18,
}

/** The places of a staff's lines: 0 to 8; on the grand staff the bass's 0 to 8 and the treble's 12 to 20. */
export const LINES: Readonly<Record<StaffKind, readonly number[]>> = {
  treble: [0, 2, 4, 6, 8],
  bass: [0, 2, 4, 6, 8],
  grand: [0, 2, 4, 6, 8, 12, 14, 16, 18, 20],
}

/** Middle C's place on the grand staff: the one ledger line between the staves. */
export const MIDDLE_C_PLACE = 10

/** A written note's place on `staff`, in letters above its bottom line; below it, negative. */
export const placeOf = (s: Spelled, staff: StaffKind): number =>
  diatonicOf(s) - BOTTOM[staff]

/** The plain note at `place` on `staff`: place 2 on the treble staff is G4. */
export const noteAt = (place: number, staff: StaffKind): Spelled =>
  spelledAt(BOTTOM[staff] + place)

/** Lines at even places, spaces at odd ones, below the staff too. */
export const isLine = (place: number): boolean => ((place % 2) + 2) % 2 === 0

/**
 * The ledger lines a note at `place` needs, as places: the even places
 * past the staff's edge out to the note, nearest first; on the grand staff
 * middle C's line between the staves, for middle C alone.
 */
export function ledgersOf(place: number, staff: StaffKind): number[] {
  const lines = LINES[staff]
  const lo = lines[0]
  const hi = lines[lines.length - 1]
  const out: number[] = []
  if (place < lo) for (let p = lo - 2; p >= place; p -= 2) out.push(p)
  else if (place > hi) for (let p = hi + 2; p <= place; p += 2) out.push(p)
  else if (isLine(place) && !lines.includes(place)) out.push(place)
  return out
}

/** How many ledger lines a note at `place` needs. */
export const ledgerCount = (place: number, staff: StaffKind): number =>
  ledgersOf(place, staff).length

/** The places a toy reaches, two ledger lines each way past a staff (FACTS 19); the grand staff's G2 to F5. */
export function placeRange(staff: StaffKind): readonly [number, number] {
  return staff === 'grand' ? [0, 20] : [-4, 12]
}

/** The line a clef names: the treble clef's G4 and the bass clef's F3 (FACTS 13, 15). */
export const CLEF_NOTE: Readonly<Record<Clef, Spelled>> = {
  treble: { letter: 'G', alter: 0, octave: 4 },
  bass: { letter: 'F', alter: 0, octave: 3 },
}

/** The clef's line on `staff`: place 2 for the treble clef, 6 for the bass, 14 and 6 on the grand staff. */
export const clefPlace = (clef: Clef, staff: StaffKind): number =>
  placeOf(CLEF_NOTE[clef], staff)

/** The clef a voice reads: the bass clef for the lower voice, the treble for the higher (FACTS 8, 51). */
export const clefForVoice = (voice: Voice): Clef =>
  voice === 'lower' ? 'bass' : 'treble'

/** The grand staff's 21 white keys, G2 to F5, as MIDI notes (FACTS 21). */
export const GRAND_WHITE_KEYS: readonly number[] = Array.from(
  { length: 21 },
  (_, i) => midiOf(spelledAt(BOTTOM.grand + i)),
)

const COUNT = ['no', 'one', 'two', 'three', 'four', 'five', 'six'] as const
const counted = (n: number): string =>
  `${COUNT[n] ?? String(n)} ledger line${n === 1 ? '' : 's'}`

const LINE_WORDS: Readonly<Record<number, string>> = {
  0: 'the bottom line',
  2: 'the second line',
  4: 'the middle line',
  6: 'the fourth line',
  8: 'the top line',
}
const SPACE_WORDS: Readonly<Record<number, string>> = {
  1: 'the bottom space',
  3: 'the second space',
  5: 'the third space',
  7: 'the top space',
}

/** Where `place` sits on one five-line staff, in words: "the second line", "one ledger line below". */
function onOneStaff(place: number, of: string): string {
  const inside = LINE_WORDS[place] ?? SPACE_WORDS[place]
  if (inside !== undefined) return of === '' ? inside : `${inside} ${of}`
  const below = place < 0
  const edge = below ? 'below' : 'above'
  const n = ledgerCount(place, 'treble')
  const staff = of === '' ? '' : ` ${of.replace(/^of /, '')}`
  if (n === 0)
    return `just ${edge} the ${below ? 'bottom' : 'top'} line${of === '' ? '' : ` ${of}`}`
  return isLine(place)
    ? `${counted(n)} ${edge}${staff}`
    : `${edge} ${counted(n)}${staff}`
}

/**
 * Where a note at `place` sits, in words. On the grand staff a note names
 * its staff, and middle C the line between them; written on one of the two
 * (`on`), middle C is that staff's ledger line.
 */
export function placeWords(place: number, staff: StaffKind, on?: Clef): string {
  if (staff !== 'grand') return onOneStaff(place, '')
  if (place === MIDDLE_C_PLACE && on === undefined)
    return "middle C's ledger line, between the staves"
  const treble = on === 'treble' || (on === undefined && place > MIDDLE_C_PLACE)
  return treble
    ? onOneStaff(place - 12, 'of the treble staff')
    : onOneStaff(place, 'of the bass staff')
}

/** A note and its place, as the live region says it: "G4, the second line". */
export const sayPlace = (s: Spelled, staff: StaffKind, on?: Clef): string =>
  `${wordName(s)}, ${placeWords(placeOf(s, staff), staff, on)}`

/** A staff's name, for its group: "Treble staff, five lines and four spaces". */
export function staffName(staff: StaffKind): string {
  if (staff === 'grand')
    return 'Grand staff: a treble staff above a bass staff, joined by a brace, with middle C between them'
  return `${staff === 'treble' ? 'Treble' : 'Bass'} staff, five lines and four spaces`
}
