// ============================================================
// Range chart layout — where every part of the chart sits, in CSS px
// ============================================================
//
// Pure geometry for kit/range-chart.ts (Lesson 7 WEB-SPEC, Toys 1, "Layout
// and targets"; its FACTS 88). Pitch is height: a window of notes, MIDI `lo`
// at the plot's bottom and `hi` at its top, one row a semitone. A 34 px
// gutter on the left names the C and A rows. The column, the two octaves a
// voice type is often given, stands at the plot's left as a bar, with time
// running left to right beside it for every line; or, in a compact figure,
// it fills the plot and a tune's beads lie across it. Band columns (the six
// voice types) share the plot side by side. Nothing here draws, so every
// width from 344 px up can be checked without a canvas.

import { clamp } from './dom'

/** The names gutter at the left, px. */
export const GUTTER = 34
/** Room above and below the plot, px. */
export const PAD_Y = 12
/** Room at the plot's right, px. */
export const PAD_RIGHT = 10
/** The column as a bar, and the gap between it and the time that runs beside it, px. */
export const BAR_W = 30
export const BAR_GAP = 14
/** Room at a compact column's right for the bracket, px. */
export const BRACKET_ROOM = 22

/** How the column stands: a bar at the plot's left, filling the plot, or not at all. */
export type ColumnForm = 'bar' | 'wide' | 'none'

export interface RangeWindow {
  /** The lowest and highest notes on the chart, MIDI. */
  readonly lo: number
  readonly hi: number
}

export interface RangeFrame extends RangeWindow {
  readonly w: number
  readonly h: number
  /** The plot, inside the gutter and the pads. */
  readonly x0: number
  readonly x1: number
  readonly top: number
  readonly bottom: number
  /** The column's left and right edges (equal for none). */
  readonly colX0: number
  readonly colX1: number
  /** Where time runs, left to right, across `seconds`. */
  readonly tX0: number
  readonly tX1: number
  readonly seconds: number
}

export interface FrameOptions extends RangeWindow {
  readonly column: ColumnForm
  /** Seconds across the time area. */
  readonly seconds: number
  /** The names gutter (default on). */
  readonly names?: boolean
}

/** The chart's frame inside a `w` by `h` canvas. */
export function rangeFrame(w: number, h: number, o: FrameOptions): RangeFrame {
  const x0 = o.names === false ? 8 : GUTTER
  const x1 = Math.max(x0 + 1, w - PAD_RIGHT)
  const top = PAD_Y
  const bottom = Math.max(top + 1, h - PAD_Y)
  let colX0 = x0
  let colX1 = x0
  let tX0 = x0
  let tX1 = x1
  if (o.column === 'bar') {
    colX0 = x0 + 4
    colX1 = colX0 + BAR_W
    tX0 = colX1 + BAR_GAP
  } else if (o.column === 'wide') {
    colX0 = x0
    colX1 = Math.max(x0 + 1, x1 - BRACKET_ROOM)
    // the beads lie across the column, inset from its edges
    tX0 = colX0 + 10
    tX1 = colX1 - 10
  }
  return {
    w,
    h,
    lo: o.lo,
    hi: o.hi,
    x0,
    x1,
    top,
    bottom,
    colX0,
    colX1,
    tX0,
    tX1: Math.max(tX0 + 1, tX1),
    seconds: o.seconds,
  }
}

/**
 * The height of a note (MIDI, fractional allowed) on the frame. Each note
 * of the window owns a row of equal height, its line through the row's
 * middle, so the window's lowest and highest notes sit half a row inside
 * the plot and a span of notes is drawn from half a row below its lowest
 * to half a row above its highest.
 */
export const yOf = (f: RangeFrame, midi: number): number =>
  f.bottom - ((midi - f.lo + 0.5) / (f.hi - f.lo + 1)) * (f.bottom - f.top)

/** The note a height stands for, unrounded: the inverse of `yOf`. */
export const midiAt = (f: RangeFrame, y: number): number =>
  f.lo - 0.5 + ((f.bottom - y) / (f.bottom - f.top)) * (f.hi - f.lo + 1)

/** A semitone's height on the frame, px. */
export const rowHeight = (f: RangeFrame): number =>
  (f.bottom - f.top) / (f.hi - f.lo + 1)

/** The top and bottom of a span of notes, a half row outside its two ends. */
export const spanY = (
  f: RangeFrame,
  lo: number,
  hi: number,
): { y0: number; y1: number } => ({
  y0: yOf(f, hi + 0.5),
  y1: yOf(f, lo - 0.5),
})

/** Where a moment sits across the time area; outside the window it holds to the edge. */
export const xOfT = (f: RangeFrame, t: number): number =>
  f.tX0 + (clamp(t, 0, f.seconds) / f.seconds) * (f.tX1 - f.tX0)

/** `count` columns sharing the plot side by side, each its left and right edge. */
export function bandColumns(
  f: Pick<RangeFrame, 'x0' | 'x1'>,
  count: number,
): { x0: number; x1: number }[] {
  const each = (f.x1 - f.x0) / count
  return Array.from({ length: count }, (_, i) => ({
    x0: f.x0 + i * each,
    x1: f.x0 + (i + 1) * each,
  }))
}

/** The gap between neighbouring buttons in a row of controls, px. */
export const CONTROL_GAP = 8

/** Each button's width in a row of `perRow` across `inner` px, with the kit's 8 px gaps. */
export const buttonWidth = (inner: number, perRow: number): number =>
  (inner - CONTROL_GAP * (perRow - 1)) / perRow

/**
 * The stage card's inner width at a viewport `vw` px wide, from the kit's
 * stage CSS (lesson-base.css, lesson-stage.css): up to 960 px the card
 * spans the page inside its gutters (16 px, 32 px from 760 px) with 12 px
 * of padding; wider, it stands beside the text in the steps grid's second
 * column (1.3 of 2.3 up to 1080 px, then 7 of 12) with 18 px of padding.
 */
export function stageInner(vw: number): number {
  const gutters = vw >= 760 ? 64 : 32
  if (vw <= 960) return vw - gutters - 2 * 12 - 2
  const content = Math.min(vw - 64, 1240)
  const gap = clamp(vw * 0.04, 28, 56)
  const share = vw <= 1080 ? 1.3 / 2.3 : 7 / 12
  return (content - gap) * share - 2 * 18 - 2
}

/** The canvas's width at a viewport `vw` px wide: all of the card on a phone (`.viz.wide`), else its inner width less the figure's border. */
export const canvasWidth = (vw: number): number =>
  vw <= 960 ? stageInner(vw) + 2 * 12 : stageInner(vw) - 2
