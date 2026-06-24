// ============================================================
// CAGED chord shape definitions
// ============================================================

import { OPEN_MIDI } from './constants'

export type CagedShapeName = 'C' | 'A' | 'G' | 'E' | 'D'

export interface CagedShape {
  name: CagedShapeName
  /** Index into OPEN_MIDI — which string carries the root */
  rootString: number
  /**
   * Fret offsets from the root fret (the fret on rootString where the
   * root sits).  null = muted string.  Offsets may be negative.
   */
  offsets: Array<number | null>
}

/**
 * CAGED shapes expressed as fret offsets from the root fret.
 * Index 0 = low E (6th), index 5 = high e (1st).
 *
 * Calibrated against C-major reference positions:
 *   C shape: root C on 5th string fret 3, offsets from fret 3
 *   A shape: root C on 5th string fret 3, offsets from fret 3
 *   G shape: root C on 6th string fret 8, offsets from fret 8
 *   E shape: root C on 6th string fret 8, offsets from fret 8
 *   D shape: root C on 4th string fret 10, offsets from fret 10
 */
export const CAGED_SHAPES: Record<CagedShapeName, CagedShape> = {
  C: {
    name: 'C',
    rootString: 1,
    offsets: [0, 0, -1, -3, -2, -3],
  },
  A: {
    name: 'A',
    rootString: 1,
    offsets: [0, 0, 2, 2, 2, 0],
  },
  G: {
    name: 'G',
    rootString: 0,
    offsets: [0, -3, -3, -3, -3, 0],
  },
  E: {
    name: 'E',
    rootString: 0,
    offsets: [0, 2, 2, 1, 0, 0],
  },
  D: {
    name: 'D',
    rootString: 2,
    offsets: [null, -2, 0, 2, 3, 2],
  },
}

export const CAGED_ORDER: CagedShapeName[] = ['C', 'A', 'G', 'E', 'D']

export interface FretNote {
  stringIndex: number
  fret: number
  midi: number
  role: 'root' | '3rd' | '5th'
}

/**
 * Compute the actual frets for a CAGED shape given a root MIDI note.
 * The root is placed on the shape's root string at the appropriate fret.
 * Returns only playable (fret >= 0) notes.
 */
export function computeShapeFrets(
  shape: CagedShape,
  rootMidi: number,
): FretNote[] {
  // fret on rootString where rootMidi sits
  const rootFret = rootMidi - OPEN_MIDI[shape.rootString]

  const notes: FretNote[] = []

  for (let s = 0; s < 6; s++) {
    const offset = shape.offsets[s]
    if (offset === null) continue
    const fret = rootFret + offset
    if (fret < 0 || fret > 15) continue
    const midi = OPEN_MIDI[s] + fret
    // Determine role by measuring interval from root (mod 12)
    const interval = (((midi - rootMidi) % 12) + 12) % 12
    let role: 'root' | '3rd' | '5th' = '5th'
    if (interval === 0) role = 'root'
    else if (interval === 4 || interval === 8) role = '3rd'
    else if (interval === 7) role = '5th'
    notes.push({ stringIndex: s, fret, midi, role })
  }

  return notes
}

/**
 * Find the best root MIDI for a shape in a given key, keeping the shape
 * within a reasonable fret range (0–15).
 */
export function findRootForShape(shape: CagedShape, keyMidi: number): number {
  // Try to put the root on the root string at a playable fret
  // The root note itself must be keyMidi (mod 12) in the right octave
  const open = OPEN_MIDI[shape.rootString]
  // Closest fret for keyMidi (mod 12) starting from open string
  const base = keyMidi % 12
  for (let octave = 0; octave <= 3; octave++) {
    const candidate = open + ((base - (open % 12) + 12) % 12) + octave * 12
    // Check all offsets produce playable frets
    const ok = shape.offsets.every((off, _s) => {
      if (off === null) return true
      const rootFret = candidate - OPEN_MIDI[shape.rootString]
      const fret = rootFret + off
      return fret >= 0 && fret <= 15
    })
    if (ok) return candidate
  }
  return keyMidi
}

/** Best-fit view range covering the shape frets + 1 fret padding on each side. */
export function viewRangeForFrets(frets: number[]): [number, number] {
  const min = Math.min(...frets)
  const max = Math.max(...frets)
  return [Math.max(0, min - 1), Math.min(15, max + 1)]
}
