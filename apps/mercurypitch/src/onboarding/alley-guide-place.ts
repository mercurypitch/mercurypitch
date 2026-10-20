// ============================================================
// Where Merc stands in the alley for its welcome (S7b beat 1, pure)
// ============================================================
//
// On the road, in front of the middle door (owner, 20 Oct 2026): his feet
// on the floor line the picture has there (alley-plate.ts `guide`), under
// the middle of the door's sill, and sized to the alley: his figure, from
// the top of his head to his feet, FIGURE_OF_DOOR of the door's height.
// The share is the same on every screen, either way up, as the picture is
// one picture, and at it he stands clear of the doors either side of the
// middle one in both pictures. The door behind him shows over his head and
// takes taps through him: the guide takes none (alley-guide.css).
//
// Upright, his head stays under the headline; where it would not, he is
// smaller, and where that leaves less than GUIDE_MIN of him he is not
// there at all, and the alley is as it always was. On its side the
// headline stands beside the doors, so it bounds nothing here.
//
// His line goes under him, centred under his feet, on the cobbles in front
// of the doors: never over a door, and clear of the dock. A door that comes
// down past his feet there puts it under that door; where the dock leaves
// it no room, he has no line, and his hello is still read (AlleyGuide.tsx).
//
// His box is square, his feet at MERC_FEET of its height (MercView), his
// body MERC_BODY of it (tip-target.ts).

import { MERC_BODY } from '@/components/demo-kit/tip-target'
import { MERC_FEET } from '@/components/room-kit/MercView'
import type { DoorLayout } from '../alley/alley-geometry'
import type { Point, Quad } from '../alley/alley-plate'

/** The least of him worth showing, px. */
export const GUIDE_MIN = 64
/** His figure, from the top of his head to his feet, as a share of the door. */
export const FIGURE_OF_DOOR = 0.4
/** Between his head and the headline over him, px. */
const CLEAR = 8
/** His line's widest box: "Hi, I'm Merc." in one line, px. */
export const LINE_MAX = 150
/**
 * His line's height in one line, px: alley-guide.css's 16 px at 1.3, 8 px
 * of padding each side and its 1 px border, rounded up.
 */
export const LINE_H = 40
/** Between the light under his feet, or a door, and his line, px. */
const LINE_GAP = 6
/** Between his line and the screen's sides, px. */
const LINE_EDGE = 16
/** Between his line and the dock, px. */
const DOCK_GAP = 12
/**
 * How far below his feet the light on the cobbles under them reaches, as a
 * share of his box (alley-guide.css: 22% tall, centred on his feet).
 */
const GLOW_BELOW = 0.11

/** His figure, from the top of his head to his feet, as a share of his box. */
const FIGURE = MERC_FEET - MERC_BODY.y

export interface GuideInput {
  /** The screen. */
  readonly w: number
  readonly h: number
  readonly landscape: boolean
  /** The dock's top: nothing of his goes under it. */
  readonly floor: number
  /** Upright, the headline block's bottom: his head stays under it. */
  readonly top: number
  /** The door he stands in front of, as drawn. */
  readonly door: DoorLayout
  /** Where his feet stand: the floor line in front of that door, on screen. */
  readonly feet: Point
  /** Every door as drawn: his line keeps clear of each. */
  readonly doors: readonly DoorLayout[]
}

export interface GuidePlace {
  /** His box: its left, its top, its side. */
  readonly x: number
  readonly y: number
  readonly size: number
  /** His line under him: its middle, its top and its widest; null with no room. */
  readonly line: {
    readonly x: number
    readonly y: number
    readonly width: number
  } | null
}

/** A door's height at its middle: its two jambs, averaged. */
function heightOf(quad: Quad): number {
  const [a, b, c, d] = quad
  return (d[1] - a[1] + (c[1] - b[1])) / 2
}

/** His line under him, clear of every door and of the dock, or null. */
function lineUnder(input: GuideInput, size: number): GuidePlace['line'] {
  const width = Math.min(LINE_MAX, input.w - 2 * LINE_EDGE)
  const x = Math.round(
    Math.min(
      input.w - LINE_EDGE - width / 2,
      Math.max(LINE_EDGE + width / 2, input.feet[0]),
    ),
  )
  let y = Math.round(input.feet[1] + GLOW_BELOW * size + LINE_GAP)
  // A door that comes down past his feet where the line would be: under
  // it. Each moves the line down once at most, so this ends.
  for (let moved = true; moved; ) {
    moved = false
    for (const door of input.doors) {
      if (
        door.x0 < x + width / 2 &&
        door.x1 > x - width / 2 &&
        door.y0 < y + LINE_H &&
        door.y1 > y
      ) {
        y = Math.ceil(door.y1 + LINE_GAP)
        moved = true
      }
    }
  }
  return y + LINE_H <= input.floor - DOCK_GAP ? { x, y, width } : null
}

/** Where he stands for the welcome, or null where there is no room. */
export function guidePlace(input: GuideInput): GuidePlace | null {
  const [feetX, feetY] = input.feet
  const sized = (FIGURE_OF_DOOR * heightOf(input.door.quad)) / FIGURE
  // Upright, the most that keeps his head under the headline.
  const room = input.landscape
    ? Number.POSITIVE_INFINITY
    : (feetY - input.top - CLEAR) / FIGURE
  const size = Math.floor(Math.min(sized, room))
  if (size < GUIDE_MIN) return null
  return {
    x: Math.round(feetX - size / 2),
    y: Math.round(feetY - MERC_FEET * size),
    size,
    line: lineUnder(input, size),
  }
}
