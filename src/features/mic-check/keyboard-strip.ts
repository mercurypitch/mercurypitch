// ============================================================
// Keyboard strip — where each sung note sits across the stage
// ============================================================
//
// The mic check's stage ends in a strip of piano keys, C2 to C6: low enough
// for a bass's bottom E, high enough for a soprano's top C. A held note
// lights its key, the falling notes land on it, and the ribbon leans
// towards it. All three need the same answer to "where is this note", which
// is this module.

/** C2, the lowest key on the strip. */
export const KEYBOARD_LOW = 36
/** C6, the highest. */
export const KEYBOARD_HIGH = 84

const BLACK_PITCH_CLASSES = new Set([1, 3, 6, 8, 10])
/** Black keys, as a share of a white key's width. */
const BLACK_WIDTH = 0.6

export const isBlackKey = (midi: number): boolean =>
  BLACK_PITCH_CLASSES.has(((midi % 12) + 12) % 12)

export interface KeyRect {
  midi: number
  x: number
  width: number
  black: boolean
}

/**
 * Key rectangles across `width` px, white keys first so a renderer can paint
 * the list in order and have the black keys land on top.
 */
export function layoutKeys(
  width: number,
  low = KEYBOARD_LOW,
  high = KEYBOARD_HIGH,
): KeyRect[] {
  let whiteCount = 0
  for (let midi = low; midi <= high; midi++) if (!isBlackKey(midi)) whiteCount++
  if (whiteCount === 0 || width <= 0) return []
  const whiteWidth = width / whiteCount

  const whites: KeyRect[] = []
  const blacks: KeyRect[] = []
  let whiteIndex = 0
  for (let midi = low; midi <= high; midi++) {
    if (isBlackKey(midi)) {
      // Centred on the seam between its neighbours: the seam is the left
      // edge of the next white key.
      const seam = whiteIndex * whiteWidth
      blacks.push({
        midi,
        x: seam - (whiteWidth * BLACK_WIDTH) / 2,
        width: whiteWidth * BLACK_WIDTH,
        black: true,
      })
    } else {
      whites.push({
        midi,
        x: whiteIndex * whiteWidth,
        width: whiteWidth,
        black: false,
      })
      whiteIndex++
    }
  }
  return [...whites, ...blacks]
}

const keyCentre = (key: KeyRect): number => key.x + key.width / 2

interface KeyIndex {
  low: number
  high: number
  centres: ReadonlyMap<number, number>
}

/** One index per layout: the stage asks where a pitch sits several times a
 *  frame, and the layout changes only on a resize. */
const indexes = new WeakMap<readonly KeyRect[], KeyIndex>()

function indexKeys(keys: readonly KeyRect[]): KeyIndex {
  const known = indexes.get(keys)
  if (known !== undefined) return known
  const centres = new Map(keys.map((key) => [key.midi, keyCentre(key)]))
  const index = {
    low: Math.min(...centres.keys()),
    high: Math.max(...centres.keys()),
    centres,
  }
  indexes.set(keys, index)
  return index
}

/**
 * The x position of a pitch on the strip. A fractional MIDI value lands
 * between its two neighbouring keys, so a slide moves smoothly instead of in
 * steps. Pitches off either end stay on the end key.
 */
export function pitchToX(midi: number, keys: readonly KeyRect[]): number {
  if (keys.length === 0) return 0
  const { low, high, centres } = indexKeys(keys)
  const clamped = Math.min(high, Math.max(low, midi))
  const below = Math.floor(clamped)
  const from = centres.get(below)
  const to = centres.get(Math.ceil(clamped))
  if (from === undefined || to === undefined) return 0
  return from + (to - from) * (clamped - below)
}
