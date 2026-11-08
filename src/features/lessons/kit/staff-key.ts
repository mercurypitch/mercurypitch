// ============================================================
// Key signatures — where each sign of a key's signature sits, and what a reader calls it
// ============================================================
//
// A key signature writes a key's sharps or flats once, after the clef,
// so a note its letter covers needs no sign of its own, in any octave
// (Lesson 21 FACTS 15). The signs come in a fixed order, the sharps F, C,
// G, D, A, E, B and the flats the same backwards (FACTS 17, 19), each on
// its own letter's line or space at a fixed place in each clef: in the
// treble clef F sharp on the top line, C sharp in the third space, G sharp
// in the space above the staff, B flat on the middle line, E flat in the
// top space and A flat in the second space; in the bass clef each a line
// lower (FACTS 21). The places are the app's notation library's (VexFlow
// 5's `Tables.keySignature` lines, half a line a place from the top line,
// and `convertAccLines`, a line lower for the bass clef), as is the
// spacing: each sign right after the one before, its own width and a
// tenth of a space apart.
//
// Pure: no DOM, no sound. The staff toy draws a signature from these places
// (staff-draw.ts) and says it in words (`keyWords`).

import type { Letter, Spelled } from './notes'
import type { Clef } from './staff-places'

export type KeySign = 'sharp' | 'flat'

/** A key signature: so many sharps or flats, taken in their order. */
export interface KeySig {
  readonly sign: KeySign
  /** 0 to 7. */
  readonly count: number
}

/** No sharps or flats: C major's. */
export const NO_KEY: KeySig = { sign: 'sharp', count: 0 }

/** The order of sharps, each a fifth above the one before (FACTS 17). */
export const SHARP_ORDER: readonly Letter[] = [
  'F',
  'C',
  'G',
  'D',
  'A',
  'E',
  'B',
]
/** The order of flats: the sharps', backwards (FACTS 19). */
export const FLAT_ORDER: readonly Letter[] = ['B', 'E', 'A', 'D', 'G', 'C', 'F']

/**
 * Each sign's place on the treble staff, in letters above its bottom line
 * (staff-places.ts `placeOf`): VexFlow's lines from the top line down,
 * sharps 0, 1.5, -0.5, 1, 2.5, 0.5, 2 and flats 2, 0.5, 2.5, 1, 3, 1.5,
 * 3.5, are places 8 - 2 × line.
 */
const TREBLE_PLACES: Readonly<Record<KeySign, readonly number[]>> = {
  sharp: [8, 5, 9, 6, 3, 7, 4],
  flat: [4, 7, 3, 6, 2, 5, 1],
}

/** The letters a signature covers, in its order. */
export const keyLetters = (key: KeySig): Letter[] =>
  (key.sign === 'sharp' ? SHARP_ORDER : FLAT_ORDER).slice(0, key.count)

/** Each sign's place on `clef`'s staff, in its order: the bass clef's a line, two places, lower. */
export function keyPlaces(key: KeySig, clef: Clef): number[] {
  const drop = clef === 'bass' ? 2 : 0
  return TREBLE_PLACES[key.sign].slice(0, key.count).map((p) => p - drop)
}

/** The alteration a signature gives a letter: 1 for a sharp, -1 for a flat, 0 for none. */
export function keyAlter(key: KeySig, letter: Letter): number {
  if (!keyLetters(key).includes(letter)) return 0
  return key.sign === 'sharp' ? 1 : -1
}

/** Whether a written note needs no sign of its own under `key`: its letter's alteration is the signature's. */
export const covered = (note: Spelled, key: KeySig): boolean =>
  note.alter !== 0 && note.alter === keyAlter(key, note.letter)

/**
 * The key signature of a major key, from its spelled scale: its sharps or
 * its flats, counted (a scale holds one or the other, never both).
 */
export function keyOfScale(scale: readonly Spelled[]): KeySig {
  const notes = scale.slice(0, 7)
  const sharps = notes.filter((n) => n.alter > 0).length
  const flats = notes.filter((n) => n.alter < 0).length
  if (sharps > 0 && flats > 0)
    throw new Error('A major scale holds sharps or flats, not both')
  return flats > 0
    ? { sign: 'flat', count: flats }
    : { sign: 'sharp', count: sharps }
}

const COUNT = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven']

/** A list in words: "F sharp", "F sharp and C sharp", "F sharp, C sharp and G sharp". */
function listed(items: readonly string[]): string {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

/** A signature in words, for the staff's live region: "Key signature: two sharps, F sharp and C sharp". */
export function keyWords(key: KeySig): string {
  if (key.count === 0) return 'No key signature'
  const signs = keyLetters(key).map((l) => `${l} ${key.sign}`)
  const plural = key.count === 1 ? '' : 's'
  return `Key signature: ${COUNT[key.count]} ${key.sign}${plural}, ${listed(signs)}`
}
