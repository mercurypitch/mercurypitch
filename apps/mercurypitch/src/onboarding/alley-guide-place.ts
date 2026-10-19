// ============================================================
// Where Merc stands in the alley for its welcome (S7b beat 1, pure)
// ============================================================
//
// Upright, on the cobbles at the bottom left, under the doors and over the
// dock, his line beside him to his right. Nothing of him or his line is
// over a door, so every door shows whole. On its side, in the headline's
// column under the headline, his line beside him in the column. He is as
// tall as the room there allows, from GUIDE_MIN up to a share of the
// screen's short side; where there is less room than GUIDE_MIN he is not
// there at all, and the alley is as it always was.
//
// His box is square, his feet at MERC_FEET of its height (MercView): the
// box can run on past his feet, over the dock, where nothing is drawn.

import { MERC_FEET } from '@/components/room-kit/MercView'

/** The least of him worth showing, px. */
export const GUIDE_MIN = 64
/** The most of him, px: a big moment, not a takeover. */
export const GUIDE_MAX = 180
/** His share of the screen's short side, at most. */
const GUIDE_SHARE = 0.3
/** Between him and a door over him, or the headline, px. */
const CLEAR = 8
/** His feet over the dock, px. */
const FEET_OVER_DOCK = 12
/** Between the edge of his body and his line, px. */
const LINE_GAP = 8
/** His line's widest box: "Hi, I'm Merc." in a line or two, px. */
export const LINE_MAX = 150
/** The narrowest line worth showing beside him, px. */
const LINE_MIN = 96
/** His body is narrower than his box: its right edge, as a share of it. */
const BODY_RIGHT = 0.82
/** The line's middle, as a share of his box from its top: his face. */
const LINE_AT = 0.42

export interface GuideInput {
  /** The screen. */
  readonly w: number
  readonly h: number
  readonly landscape: boolean
  /** The dock's top: the floor of the alley's picture. */
  readonly floor: number
  /** The headline block: its bottom, its left padding edge and its right. */
  readonly top: number
  readonly left: number
  readonly right: number
  /** The doors on screen, each by its box. */
  readonly doors: readonly {
    readonly x0: number
    readonly x1: number
    readonly y1: number
  }[]
}

export interface GuidePlace {
  /** His box: its left, its top, its side. */
  readonly x: number
  readonly y: number
  readonly size: number
  /** His line's box beside him (its middle at `y`), or null with no room. */
  readonly line: {
    readonly x: number
    readonly y: number
    readonly width: number
  } | null
}

/** His side for `room` px between his feet and what is over him, or null. */
function sideFor(room: number, most: number): number | null {
  const side = Math.min(most, Math.floor(room / MERC_FEET))
  return side >= GUIDE_MIN ? side : null
}

/** Where he stands for the welcome, or null where there is no room. */
export function guidePlace(input: GuideInput): GuidePlace | null {
  const most = Math.min(
    GUIDE_MAX,
    Math.round(GUIDE_SHARE * Math.min(input.w, input.h)),
  )
  const feet = input.floor - FEET_OVER_DOCK
  const x = input.left
  // The column on its side; upright, the screen less its gutter.
  const right = input.landscape ? input.right - 16 : input.w - 16
  // Upright, whatever door stands over him or his line at his biggest is
  // what he stands under; on his side only the headline is.
  const reach = x + most * BODY_RIGHT + LINE_GAP + LINE_MAX
  const over = input.landscape
    ? input.top
    : Math.max(
        input.top,
        ...input.doors
          .filter((door) => door.x1 > x && door.x0 < reach)
          .map((door) => door.y1),
      )
  const size = sideFor(feet - over - CLEAR, most)
  if (size === null) return null
  const y = Math.round(feet - MERC_FEET * size)
  const lineX = Math.round(x + size * BODY_RIGHT + LINE_GAP)
  const width = Math.min(LINE_MAX, right - lineX)
  return {
    x,
    y,
    size,
    line:
      width >= LINE_MIN
        ? { x: lineX, y: Math.round(y + size * LINE_AT), width }
        : null,
  }
}
