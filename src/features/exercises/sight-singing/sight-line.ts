// ============================================================
// Sight-Singing's line: the notes to sing, as the staff writes them
// ============================================================
//
// The drill's notes come from a random walk in the singer's range or from a
// launch's phrase (use-sight-singing-controller.ts, App.tsx). This writes
// them on the singer's staff, in the key (sight-key.ts):
//
// - Where the staff reads them best. A line is written at the pitch it is
//   sung at when every note sits within two ledger lines of the staff, and
//   otherwise moved by whole octaves to where it does: a tenor's low line
//   on the treble staff is written an octave up, as tenor parts are. The
//   drill's own notes are then sung where they are written, unless that
//   leaves the singer's range; a launch's phrase is sung where the launch
//   put it. Scoring folds the octave (any octave counts), so a line sung
//   an octave from the page is right.
// - Spelled by the key, with a sign before a note only where its letter
//   differs from the key signature. A sign holds to the end of the line,
//   as in one bar, so a note on the same line or space that goes back to
//   the signature's letter gets its natural; and a note that differs from
//   the signature is signed every time, so no reader has to remember.
// - Named under the head by its letter ("B♭", no octave, since any octave
//   counts), by its syllable in the key ("te"), or not at all (`names`).
//
// Pure: no page, no sound.

import { getComfortableMidiRange, octaveShiftIntoRange, } from '@/lib/vocal-range'
import type { VocalRangePreset } from '@/stores/settings-store'
import type { Clef, Spelled } from '../note-reading/staff-kit'
import { keyAlter, keyWords, placeOf, placeWords, signName, wordName, } from '../note-reading/staff-kit'
import type { SightKey } from './sight-key'
import { keyLabel, spellIn, syllableIn, triadOf } from './sight-key'

/** What is printed under each note: its letter, its syllable, or nothing. */
export type SightNames = 'letters' | 'solfege' | 'off'

export const isSightNames = (value: unknown): value is SightNames =>
  value === 'letters' || value === 'solfege' || value === 'off'

export interface SightNote {
  /** The note sung, and what the run listens for (MIDI). */
  readonly midi: number
  /** The note as written on the staff. */
  readonly written: Spelled
  /** Its place on the staff, in letters above the bottom line. */
  readonly place: number
  /** The sign drawn before its head: 1 a sharp, -1 a flat, 0 a natural, ±2 a double; null for none. */
  readonly sign: number | null
  /** Its letter and sign, no octave: "B♭". */
  readonly letter: string
  /** Its syllable in the key: "te". */
  readonly syllable: string
}

export interface SightLine {
  readonly key: SightKey
  readonly clef: Clef
  /** Semitones from the notes sung to the notes written: 12 where a line is sung an octave under the page. */
  readonly shift: number
  readonly notes: readonly SightNote[]
}

/** The places a staff writes without a third ledger line: two below it to two above it. */
const LOWEST_PLACE = -4
const HIGHEST_PLACE = 12

/** How many places past two ledger lines the furthest note of a line sits. */
function outside(places: readonly number[]): number {
  if (places.length === 0) return 0
  return (
    Math.max(0, LOWEST_PLACE - Math.min(...places)) +
    Math.max(0, Math.max(...places) - HIGHEST_PLACE)
  )
}

const placesAt = (
  midis: readonly number[],
  key: SightKey,
  clef: Clef,
): number[] => midis.map((m) => placeOf(spellIn(key, m), clef))

/**
 * Semitones, whole octaves, from the notes as sung to the notes as written:
 * none where the line reads within two ledger lines at its pitch, else the
 * nearest octave that needs fewest past them.
 */
export function writtenShift(
  midis: readonly number[],
  key: SightKey,
  clef: Clef,
): number {
  let best = 0
  let bestCost = Infinity
  for (const shift of [0, 12, -12, 24, -24]) {
    const cost =
      outside(
        placesAt(
          midis.map((m) => m + shift),
          key,
          clef,
        ),
      ) *
        100 +
      Math.abs(shift) / 12
    if (cost < bestCost) {
      bestCost = cost
      best = shift
    }
  }
  return best
}

export interface WriteOptions {
  /**
   * The notes are sung at their own pitch: a launch's phrase, whose octave
   * the launch chose (fitted to the range, or the voice's own). Only the
   * drill's own notes are moved to where they are written.
   */
  readonly fixed?: boolean
}

/**
 * The line for `midis` on `clef`'s staff in `key`, sung by `voice`: written
 * where the staff reads it, each note spelled, signed and named. The drill's
 * own notes are sung where they are written if the voice reaches that; a
 * launched phrase is sung where the launch put it (`fixed`).
 */
export function writeLine(
  midis: readonly number[],
  key: SightKey,
  clef: Clef,
  voice: VocalRangePreset,
  options: WriteOptions = {},
): SightLine {
  const up = writtenShift(midis, key, clef)
  const written = midis.map((m) => m + up)
  const { min, max } = getComfortableMidiRange(voice)
  const inRange =
    written.length === 0 ||
    (Math.min(...written) >= min && Math.max(...written) <= max)
  const back =
    options.fixed === true
      ? -up
      : inRange
        ? 0
        : octaveShiftIntoRange(
            Math.min(...written),
            Math.max(...written),
            voice,
          )

  // A sign holds to the end of the line, on its own line or space.
  const held = new Map<string, number>()
  const notes = written.map((w): SightNote => {
    const spelled = spellIn(key, w)
    const spot = `${spelled.letter}${spelled.octave}`
    const fromKey = keyAlter(key.sig, spelled.letter)
    const now = held.get(spot) ?? fromKey
    const signed = spelled.alter !== now || spelled.alter !== fromKey
    held.set(spot, spelled.alter)
    return {
      midi: w + back,
      written: spelled,
      place: placeOf(spelled, clef),
      sign: signed ? spelled.alter : null,
      letter: signName(spelled, { octave: false }),
      syllable: syllableIn(key, spelled),
    }
  })
  // `-0` would read as a shift to anything comparing with Object.is.
  return { key, clef, shift: back === 0 ? 0 : -back, notes }
}

/** What is printed under a note, or null with the names off. */
export function nameUnder(note: SightNote, names: SightNames): string | null {
  if (names === 'letters') return note.letter
  if (names === 'solfege') return note.syllable
  return null
}

/** What a screen reader hears for the staff: the clef, the key, and the notes as the names show them. */
export function lineWords(line: SightLine, names: SightNames): string {
  const clef = line.clef === 'treble' ? 'Treble' : 'Bass'
  const said = line.notes.map((n) =>
    names === 'letters'
      ? wordName(n.written, { octave: false })
      : names === 'solfege'
        ? n.syllable
        : placeWords(n.place, line.clef),
  )
  const signature = keyWords(line.key.sig)
  const lowered = signature.charAt(0).toLowerCase() + signature.slice(1)
  return `${clef} staff in ${keyLabel(line.key)}, ${lowered}. ${line.notes.length} notes: ${said.join(', ')}.`
}

/**
 * "Hear do": do, then do's triad up and down, do-mi-so-mi-do (do-me-so-me-do
 * in minor), as MIDI notes. Do is the one at or under the line's first
 * note, moved up an octave where it would sit under the singer's range and
 * the triad still fits above it.
 */
export function startNotes(line: SightLine, voice: VocalRangePreset): number[] {
  const first = line.notes[0]?.midi
  if (first === undefined) return []
  const pc = line.key.pc
  let home = first - ((((first - pc) % 12) + 12) % 12)
  const [, third, fifth] = triadOf(line.key)
  const { min, max } = getComfortableMidiRange(voice)
  if (home < min && home + 12 + fifth <= max) home += 12
  return [home, home, home + third, home + fifth, home + third, home]
}

/** The start's syllables after do: "do, mi, so, mi, do", or "do, me, so, me, do" in minor. */
export function startWords(line: SightLine): string {
  const [, third, fifth] = triadOf(line.key)
  const at = (semis: number): string =>
    syllableIn(line.key, spellIn(line.key, line.key.pc + 60 + semis))
  return ['do', at(third), at(fifth), at(third), 'do'].join(', ')
}
