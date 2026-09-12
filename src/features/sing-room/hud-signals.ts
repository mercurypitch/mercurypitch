// ============================================================
// HUD signals — what the Sing room's three chips say, as data
// ============================================================
//
// The room's HUD is one row of glass chips: the note you are on and how far
// from it you are, the key, and what the microphone is doing. None of that
// is a rendering decision, so none of it lives in the component: this module
// turns a `PitchResult` into the note chip's four fields and the kit's
// variant name, and the room's state into the state chip's one word.
//
// WHY THE CENTS COME FROM TWO PLACES. The detector's own `cents` is the
// distance to the nearest CHROMATIC note, which is exactly what the chip
// wants — "A3, +2 cents" means you are two cents above A3. The end card's
// "held within N cents" is a different question: it measures against the
// nearest note OF THE SCALE (a free run) or against the target (a melody
// run), because being dead on a note that is not in the key is not being in
// tune. `centsToNearestScaleNote` is that second measurement, and the room
// feeds it to the take summary rather than the chip.

import { freqToMidi, midiToFreq } from '@/lib/scale-data'
import type { PitchResult } from '@/types'

/** Inside this, the chip reads as on the note (kit `note-chip--in`). */
export const IN_TUNE_CENTS = 15

export type NoteChipVariant = 'in' | 'flat' | 'sharp' | 'quiet'

export interface NoteChipSignal {
  /** `A` — the letter, or an em dash when nothing is heard. */
  note: string
  /** `3` — the octave, rendered as the kit's subscript. Empty when quiet. */
  octave: string
  /** `+2 cents`, or `No voice` when quiet. */
  cents: string
  variant: NoteChipVariant
  /** One line for the live region, spoken rather than read. */
  announce: string
}

const QUIET: NoteChipSignal = {
  note: '—',
  octave: '',
  cents: 'No voice',
  variant: 'quiet',
  announce: 'No voice',
}

/** `+2 cents` / `-12 cents`. Always signed: zero is `0 cents`, never blank. */
export function formatCents(cents: number): string {
  const rounded = Math.round(cents)
  const sign = rounded > 0 ? '+' : ''
  return `${sign}${rounded} cents`
}

/** The note chip, from the one live pitch the room already has. */
export function noteChipSignal(pitch: PitchResult | null): NoteChipSignal {
  if (pitch === null || pitch.frequency <= 0 || pitch.noteName === '') {
    return QUIET
  }
  const cents = Math.round(pitch.cents)
  const variant: NoteChipVariant =
    Math.abs(cents) <= IN_TUNE_CENTS ? 'in' : cents < 0 ? 'flat' : 'sharp'
  const octave = Number.isFinite(pitch.octave) ? String(pitch.octave) : ''
  const words =
    variant === 'in'
      ? 'in tune'
      : `${Math.abs(cents)} cents ${variant === 'flat' ? 'flat' : 'sharp'}`
  return {
    note: pitch.noteName,
    octave,
    cents: formatCents(cents),
    variant,
    announce: `${pitch.noteName}${octave}, ${words}`,
  }
}

/** `C major` / `A natural minor` — the key chip's whole text. */
export function keyChipLabel(keyName: string, scaleType: string): string {
  return `${keyName} ${scaleType.replace(/-/gu, ' ')}`
}

export type MicChipState = 'listening' | 'muted' | 'paused' | 'off'

/** The state chip's one word. Never a sentence, never a percentage. */
export function stateChipLabel(state: MicChipState): string {
  switch (state) {
    case 'listening':
      return 'Listening'
    case 'paused':
      return 'Paused'
    case 'muted':
    case 'off':
      return 'Mic off'
  }
}

/**
 * How far a frequency sits from the nearest note of a scale, in cents.
 *
 * `pitchClasses` is `scaleDegreeSet(key, scaleType)` — the seven (or so)
 * pitch classes the key is made of. Search two semitones either side of the
 * rounded note: further than that and the nearest scale note is not the note
 * anybody was aiming at.
 *
 * Returns null for silence, so a caller can tell "no voice" from "dead on".
 */
export function centsToNearestScaleNote(
  freq: number,
  pitchClasses: ReadonlySet<number>,
): { cents: number; midi: number } | null {
  if (!(freq > 0) || !Number.isFinite(freq) || pitchClasses.size === 0) {
    return null
  }
  const rounded = freqToMidi(freq)
  let bestMidi = rounded
  let bestCents = Number.POSITIVE_INFINITY
  for (let candidate = rounded - 2; candidate <= rounded + 2; candidate++) {
    const pitchClass = ((candidate % 12) + 12) % 12
    if (!pitchClasses.has(pitchClass)) continue
    const cents = 1200 * Math.log2(freq / midiToFreq(candidate))
    if (Math.abs(cents) < Math.abs(bestCents)) {
      bestCents = cents
      bestMidi = candidate
    }
  }
  if (!Number.isFinite(bestCents)) {
    return { cents: 0, midi: rounded }
  }
  return { cents: bestCents, midi: bestMidi }
}
