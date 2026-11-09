// ============================================================
// Studio MIDI drum rows — a drum lane's note editor shows a row per key of the kit, named as General MIDI names it, in the order a kit is read
// ============================================================
//
// A piano roll's rows are every semitone; a kit's are its pieces, and most
// keys of a drum lane are never played. The editor shows the kit a drum
// part is usually written for (crash, ride, the two hi-hats, two toms, the
// snare and the kick) and every other key the sequence plays, cymbals at
// the top and the kick at the foot. A key outside General MIDI's
// percussion, which plays nothing on the kit but is kept, gets a row below
// the kick.
import { generalMidiPercussionName, GM_PERCUSSION_MAX, GM_PERCUSSION_MIN, } from '@/lib/percussion'
import type { StudioNote } from '../model/types'

/** The kit's keys from the top down: cymbals, hi-hats, other percussion, toms high to low, snares and claps, kicks. */
const KIT_ORDER: readonly number[] = [
  49, 57, 55, 52, 51, 59, 53, 46, 44, 42, 54, 56, 58, 60, 61, 62, 63, 64, 65,
  66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 50, 48, 47,
  45, 43, 41, 40, 38, 37, 39, 36, 35,
]

/** The rows every drum editor shows, played or not. */
export const STUDIO_DRUM_KIT: readonly number[] = [
  49, 51, 46, 42, 50, 45, 38, 36,
]

/** A drum editor's row: its key and its name. */
export interface StudioDrumRow {
  readonly key: number
  readonly name: string
}

/** The name a drum row shows: General MIDI's, or the key's number outside it. */
export function studioDrumKeyName(key: number): string {
  return key >= GM_PERCUSSION_MIN && key <= GM_PERCUSSION_MAX
    ? generalMidiPercussionName(key)
    : `Key ${key}`
}

/** The rows of a drum lane's editor from the top: the usual kit and every key `notes` play. */
export function studioDrumRows(
  notes: readonly Pick<StudioNote, 'pitch'>[],
): StudioDrumRow[] {
  const keys = new Set([...STUDIO_DRUM_KIT, ...notes.map((note) => note.pitch)])
  const ordered = KIT_ORDER.filter((key) => keys.has(key))
  const others = [...keys]
    .filter((key) => !KIT_ORDER.includes(key))
    .sort((a, b) => b - a)
  return [...ordered, ...others].map((key) => ({
    key,
    name: studioDrumKeyName(key),
  }))
}
