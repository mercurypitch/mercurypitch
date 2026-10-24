// ============================================================
// Band words — a gap in cents, said the way the band chart says it
// ============================================================
//
// One vocabulary for every figure that measures a sung or played note
// against Merc's: the gap ("12 cents below Merc's note"), the band it sits
// in by Voice Mirror's own edges (15 or less right in the middle, 35 or less
// in the band, 60 or less close, beyond that outside the band), and the
// nearest note, whose name changes past 50 cents (Lesson 2). The edges are
// imported from Voice Mirror's leaf (src/lib/mirror/match-bands.ts), never
// copied, so what a lesson calls "in the band" and what Voice Mirror counts
// as a hit cannot drift apart. Words only: no colour is ever the message.
//
// A live line folded into Merc's octave carries a small tag ("octave lower")
// while it sits within 50 cents of his note an octave or more away
// (`octaveTag`). It lives here, not beside the take reader (take.ts):
// Lesson 3's first paint imports the module that draws the tag, and the
// reader loads only with the listener, after Start.

import { BULLSEYE_TOLERANCE_CENTS, CLOSE_TOLERANCE_CENTS, HIT_TOLERANCE_CENTS, } from '@/lib/mirror/match-bands'
import type { Spelled } from './notes'
import { sharpOf, wordName } from './notes'

export { BULLSEYE_TOLERANCE_CENTS, CLOSE_TOLERANCE_CENTS, HIT_TOLERANCE_CENTS }

/** Where a gap sits: right in the middle, in the band, close, or outside the band. */
export type Band = 'middle' | 'band' | 'close' | 'outside'

export function bandOf(cents: number): Band {
  const d = Math.abs(cents)
  if (d <= BULLSEYE_TOLERANCE_CENTS) return 'middle'
  if (d <= HIT_TOLERANCE_CENTS) return 'band'
  if (d <= CLOSE_TOLERANCE_CENTS) return 'close'
  return 'outside'
}

/** True inside Merc's band, ±35 cents: the edge lights and says "in the band". */
export const inBand = (cents: number): boolean =>
  Math.abs(cents) <= HIT_TOLERANCE_CENTS

/** Each band in words, lower case, as a readout says it. */
export const BAND_WORDS: Readonly<Record<Band, string>> = {
  middle: 'right in the middle',
  band: 'in the band',
  close: 'close',
  outside: 'outside the band',
}

/** Whole cents, never "−0". */
export const wholeCents = (cents: number): number => {
  const r = Math.round(cents)
  return r === 0 ? 0 : r
}

/** "12 cents below Merc's note", "1 cent above Merc's note" or "on Merc's note". */
export function gapWords(cents: number, whose = "Merc's note"): string {
  const r = wholeCents(cents)
  if (r === 0) return `on ${whose}`
  const n = Math.abs(r)
  return `${n} ${n === 1 ? 'cent' : 'cents'} ${r > 0 ? 'above' : 'below'} ${whose}`
}

/** A signed gap for a readout: "+12", "−40", "0". */
export function signedCents(cents: number): string {
  const r = wholeCents(cents)
  if (r === 0) return '0'
  return r > 0 ? `+${r}` : `−${Math.abs(r)}`
}

/**
 * The note nearest a pitch `cents` from `target` (MIDI): the target itself
 * up to 50 cents either side, the next note past that, in the app's sharp
 * spelling.
 */
export function nearestNote(target: number, cents: number): Spelled {
  const steps = Math.max(0, Math.ceil((Math.abs(cents) - 50) / 100))
  return sharpOf(target + Math.sign(cents) * steps)
}

/**
 * The readout's spoken value: "20 cents below Merc's note: in the band;
 * nearest note A3", or "12 cents below Merc's note: right in the middle;
 * nearest note A3" (the band's own edges).
 */
export function bandValueText(target: number, cents: number): string {
  return `${gapWords(cents)}: ${BAND_WORDS[bandOf(cents)]}; nearest note ${wordName(nearestNote(target, cents))}`
}

/** Whole octaves between a pitch and Merc's note, by the folded distance. */
export const octavesOf = (raw: number, folded: number): number =>
  Math.round((raw - folded) / 1200)

/** The tag beside the live line: "octave lower", "two octaves higher", or none. */
export function octaveTag(octaves: number, folded: number): string | null {
  if (octaves === 0 || Math.abs(folded) > 50) return null
  const n = Math.abs(octaves)
  const size = n === 1 ? 'octave' : `${n === 2 ? 'two' : String(n)} octaves`
  return `${size} ${octaves < 0 ? 'lower' : 'higher'}`
}
