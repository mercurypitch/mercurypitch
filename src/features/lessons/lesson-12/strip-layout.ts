// ============================================================
// Lesson 12 strip layout — where the chord strip's seven chips and the step's buttons sit
// ============================================================
//
// Under the ring of rooms sits the chord strip, seven chips, one per degree
// from I to vii°, each a button 44 px tall (WEB-SPEC, Toys 1; FACTS 75).
// Where the figure is at least 440 px wide they make one row of seven,
// otherwise two rows, four and three. FACTS 75's widths, 71.5 to 83.0 px in
// rows of four on phones and 56.7 to 86.1 px in one row on a desktop, are
// what an 8 px space between chips gives: (310 - 3 x 8) / 4 is 71.5 and
// (445 - 6 x 8) / 7 is 56.7. So the chips share the figure's width with
// 8 px between them, and the row of three keeps the four's width, under
// the first three. The row for the step's own buttons, 44 px tall, sits
// under the chips: the stage holds the figure, the chips and that row
// (Toys 1, The stuck stage).
//
// Below 240 px of height, a phone held sideways, the toy draws its compact
// layout (Toys 1, The compact layout). The ring's letters and the centre's
// label are the page's to move; here the chips keep one row of seven and
// sit beside the step's buttons, so the figure and its first row of
// controls share the screen. The chips then take the narrowest one-row
// strip, 440 px, each 56 px wide, and the step's buttons the rest of the
// row, where the rest holds at least one 44 px target. A figure narrower
// than that keeps the rows above.
//
// This file only measures, from the figure's width and height. Each
// rectangle's x and y run from the strip's top-left corner, under the
// figure; the page lays the markup's chips and buttons on them.

import type { Rect } from '@/features/lessons/kit/tune-line-layout'
import { MIN_TARGET } from '@/features/lessons/kit/tune-line-layout'

/** The chips, one per degree, I to vii°. */
export const CHIPS = 7
/** A chip's height and the step's buttons' row: the series' 44 px target (FACTS 75). */
export const CHIP_H = MIN_TARGET
/** The space between chips, across and down: what gives FACTS 75's widths. */
export const SPACE = 8
/** The narrowest figure that holds one row of seven (FACTS 75). */
export const ONE_ROW_W = 440
/** Below this figure height, the compact layout (WEB-SPEC, Toys 1). */
export const COMPACT_H = 240
/** Narrower than one row: four chips, then three. */
const FIRST_ROW = 4

export interface StripSize {
  /** The figure's size, px. */
  readonly width: number
  readonly height: number
}

export interface StripLayout extends StripSize {
  /** The compact layout: the figure is under 240 px tall. */
  readonly compact: boolean
  /** Rows of chips: one of seven, or four then three. */
  readonly rows: 1 | 2
  /** The step's buttons share the chips' row: the compact layout, where the row holds both. */
  readonly beside: boolean
  /** The seven chips, I to vii°, in scale order. */
  readonly chips: readonly Rect[]
  /** The row for the step's own buttons. */
  readonly buttons: Rect
  /** The strip's height: the chips' rows and the buttons' row. */
  readonly used: number
}

/** Whether a figure `height` px tall draws the compact layout: below 240 px. */
export const compactFor = (height: number): boolean => height < COMPACT_H

/** The rows of chips under a figure `width` px wide: one from 440 px, two below. */
export const rowsFor = (width: number): 1 | 2 => (width >= ONE_ROW_W ? 1 : 2)

/** The seven chips sharing `strip` px, `perRow` to a row. */
function chipsOf(strip: number, perRow: number): Rect[] {
  const w = (strip - (perRow - 1) * SPACE) / perRow
  return Array.from({ length: CHIPS }, (_, i) => ({
    x: (i % perRow) * (w + SPACE),
    y: Math.floor(i / perRow) * (CHIP_H + SPACE),
    w,
    h: CHIP_H,
  }))
}

/** Lays the chord strip and the step's buttons out under a `width` by `height` figure. */
export function stripLayout(size: StripSize): StripLayout {
  const { width, height } = size
  const compact = compactFor(height)
  const besideX = ONE_ROW_W + SPACE
  if (compact && width - besideX >= MIN_TARGET)
    return {
      width,
      height,
      compact,
      rows: 1,
      beside: true,
      chips: chipsOf(ONE_ROW_W, CHIPS),
      buttons: { x: besideX, y: 0, w: width - besideX, h: CHIP_H },
      used: CHIP_H,
    }
  const rows = rowsFor(width)
  const buttonsY = rows * (CHIP_H + SPACE)
  return {
    width,
    height,
    compact,
    rows,
    beside: false,
    chips: chipsOf(width, rows === 1 ? CHIPS : FIRST_ROW),
    buttons: { x: 0, y: buttonsY, w: width, h: CHIP_H },
    used: buttonsY + CHIP_H,
  }
}
