// ============================================================
// Staircase geometry — where the rows, the stairs and the keys sit
// ============================================================
//
// Pitch is height (playbook rule 20): eight stairs, do to do, left to right,
// each one row per semitone above do (0, 2, 4, 5, 7, 9, 11, 12), on faint
// semitone rows; a page may draw fewer, from do up (Lesson 16's five, do to
// so), or another scale's (Lesson 20's six of a pentatonic, do to do,
// stairs-scales.ts), whose rows on a phone run only from do to the top
// stair, each the taller, and whose columns keep to the narrow layout's
// widest, the strip below them showing the white keys from do to the top
// stair. Three layouts of the one drawing:
//
// - wide: the stage on a desktop. All 25 rows from the floor, the C at or
//   below the lowest start, stay put and the staircase climbs them as it
//   slides; the keyboard strip below spans the same two octaves. On Lesson
//   4, whose starts run C4 to B4, both are C4 to C6.
// - narrow: a phone, and any stage too narrow for the wide strip's keys or
//   too short for its rows. The scale's own thirteen rows, the staircase
//   fixed in them while the pitch ruler at the left scrolls; the strip shows
//   the scale's octave at full width and pans with it. Eight columns of
//   44.5 px on a 356 px figure, under a top margin that holds the readout.
//   A figure shorter than 380 px (the steps' stage beside the text, which
//   keeps the whole stage to about 550 px) takes tighter margins, and a
//   figure wider than eight 64 px columns centres the stairs and their keys,
//   so the staircase keeps its slope.
// - compact: Lesson 4's cold open and hero. Fifteen rows from the floor, C4
//   to D5 there, so a scale on C and one on D both fit unscaled; no strip,
//   nothing that takes taps.
//
// Every stair is a block from its tread down to a foot below do, and its
// tap zone is its column, at least 44 px tall: columns never overlap, so no
// two stairs' zones do. Group's two bracket zones sit above their stairs,
// clear of every stair's zone. All of it is a function of the canvas size,
// the floor and the start, which is fractional while a slide is travelling.

import type { Strip } from './key-strip'
import { stripLayout, whiteRange } from './key-strip'
import { MAJOR_DEGREES } from './major-scale'
import { isBlack } from './notes'
import type { Degrees } from './stairs-scales'

export type StairsMode = 'wide' | 'narrow' | 'compact'

/** The starts a staircase takes, do's lowest and highest: Lesson 4's run C4 to B4. */
export interface StairsRange {
  readonly lo: number
  readonly hi: number
}

export interface Rect {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
}

/** A stair as drawn: its column and its block. */
export interface StairBox {
  /** The column's left edge and width. */
  readonly x: number
  readonly w: number
  /** The tread (the block's top) and the block's foot. */
  readonly top: number
  readonly bottom: number
  /** Where a tap plays it: the column, at least 44 px tall. */
  readonly zone: Rect
}

export interface StairsLayout {
  readonly mode: StairsMode
  readonly W: number
  readonly H: number
  readonly rowH: number
  /** A row's centre (in narrow mode the rows scroll with the start). */
  yOfRow(midi: number): number
  /** The pitches whose rows show, low to high. */
  readonly rows: readonly number[]
  /** The rows' top and bottom edges. */
  readonly rowsTop: number
  readonly rowsBottom: number
  /** The stairs' area, left and right. */
  readonly x0: number
  readonly x1: number
  readonly stairs: readonly StairBox[]
  /** Group's two brackets: the line's height and each bracket's tap zone. */
  readonly brackets: readonly { readonly y: number; readonly zone: Rect }[]
  /** The keyboard strip, or null (compact). */
  readonly strip: Strip | null
}

/** A tap target's least side, px. */
export const TARGET = 44

/** The gap left between neighbouring blocks, px. */
export const BLOCK_GAP = 3

interface ModeSpec {
  /** Room above the top row: brackets, the arrow from ti, labels. */
  readonly top: number
  /** The stairs' left edge (past the ruler) and the margin at the right. */
  readonly left: number
  readonly right: number
  /** How far the blocks reach below do's row. */
  readonly depth: number
  /** Below the blocks: the hairlines' drop, the strip and the bottom margin. */
  readonly drop: number
  readonly stripH: number
  readonly pad: number
  /** Rows shown: 25 (two octaves from the floor), the scale's 13, or 15 (a ninth from the floor). */
  readonly rows: number
}

const SPEC: Readonly<Record<StairsMode, ModeSpec>> = {
  wide: {
    top: 54,
    left: 46,
    right: 10,
    depth: 16,
    drop: 22,
    stripH: 74,
    pad: 10,
    rows: 25,
  },
  narrow: {
    top: 96,
    left: 0,
    right: 0,
    depth: 16,
    drop: 18,
    stripH: 76,
    pad: 8,
    rows: 13,
  },
  compact: {
    top: 30,
    left: 6,
    right: 6,
    depth: 12,
    drop: 0,
    stripH: 0,
    pad: 6,
    rows: 15,
  },
}

/** The narrow layout on a figure under `SHORT_BELOW` px: room for the readout and Group's brackets, and a strip still 44 px deep in its black keys. */
const SHORT: ModeSpec = {
  top: 60,
  left: 0,
  right: 0,
  depth: 12,
  drop: 12,
  stripH: 74,
  pad: 6,
  rows: 13,
}

const SHORT_BELOW = 380

/** The narrow layout's widest column: past it the stairs and keys centre. */
const MAX_COLUMN = 64

const specFor = (mode: StairsMode, H: number): ModeSpec =>
  mode === 'narrow' && H < SHORT_BELOW ? SHORT : SPEC[mode]

/** The stairs' and the strip's left and right edges, for `count` stairs. */
function spanOf(
  mode: StairsMode,
  W: number,
  count: number,
): { x0: number; x1: number } {
  const s = SPEC[mode]
  if (mode !== 'narrow') return { x0: s.left, x1: W - s.right }
  const span = Math.min(W, count * MAX_COLUMN)
  const x0 = (W - span) / 2
  return { x0, x1: x0 + span }
}

/**
 * A range's floor, the C at or below its lowest start: the lowest row of a
 * layout that does not scroll, and the strip's lowest key. Every start sits
 * in the octave above it, or on the C that closes it (Lesson 20's Step 2,
 * A2 and C3 over C2), so a scale's top do keeps to the 25 rows.
 */
export function floorOf(range: StairsRange): number {
  const floor = range.lo - (range.lo % 12)
  if (range.hi < range.lo || range.hi > floor + 12)
    throw new Error(
      `A staircase's starts run within one octave from C: not ${range.lo} to ${range.hi}`,
    )
  return floor
}

/**
 * Which layout a full staircase takes on a W by H canvas: narrow below 520
 * px wide, on a touch screen wherever the wide strip's fifteen keys would be
 * narrower than a fingertip's 44 px, and on a canvas too short for 25 rows.
 */
export function fullMode(
  W: number,
  H: number,
  coarse: boolean,
): 'wide' | 'narrow' {
  if (W < 520 || H < 420) return 'narrow'
  return coarse && W < 15 * TARGET ? 'narrow' : 'wide'
}

/** A key's centre, counted in white keys from the floor's left edge. */
function keyCentre(midi: number, floor: number): number {
  const whites = whiteRange(floor, midi).length
  // a white key's centre is half a key in; a black key sits on the join above it
  return isBlack(midi) ? whites : whites - 0.5
}

/**
 * The narrow strip's window, in white keys from the floor: the scale's
 * octave at full width, do's key centred half a white key in, so a black do
 * shows whole. A fractional start (a pan in flight) interpolates.
 */
export function stripWindow(start: number, floor: number): number {
  const lo = Math.floor(start)
  const u = start - lo
  const at = (m: number): number => keyCentre(m, floor)
  return at(lo) + (at(lo + 1) - at(lo)) * u - 0.5
}

/**
 * The white keys the narrow strip shows: one a letter from do to the top
 * stair, as many as the stairs for the major scale and Lesson 16's five,
 * eight for a pentatonic's octave.
 */
function keysOf(degrees: Degrees): number {
  const top = MAJOR_DEGREES.indexOf(degrees[degrees.length - 1])
  return top === -1 ? degrees.length : top + 1
}

function stripFor(
  mode: StairsMode,
  W: number,
  H: number,
  start: number,
  floor: number,
  degrees: Degrees,
): Strip | null {
  if (mode === 'compact') return null
  const s = specFor(mode, H)
  const wide = mode === 'wide'
  const { x0, x1 } = spanOf(mode, W, degrees.length)
  return stripLayout({
    lo: floor,
    hi: floor + 24,
    x0: wide ? 4 : x0,
    x1: wide ? W - 4 : x1,
    top: H - s.pad - s.stripH,
    height: s.stripH,
    window: wide
      ? undefined
      : { from: stripWindow(start, floor), keys: keysOf(degrees) },
  })
}

/**
 * The staircase on a W by H canvas, standing on `start` (do; fractional
 * while a slide travels) over `floor` (`floorOf`), its stairs `degrees`
 * semitones above do, the major scale's eight unless a page draws others.
 * In narrow mode the stairs never move: `start` scrolls the rows and pans
 * the strip instead.
 */
export function stairsLayout(
  mode: StairsMode,
  W: number,
  H: number,
  start: number,
  floor: number,
  degrees: Degrees = MAJOR_DEGREES,
): StairsLayout {
  const s = specFor(mode, H)
  const narrow = mode === 'narrow'
  const count = degrees.length
  // the top stair's degree: narrow rows run from do up to it
  const topDeg = degrees[count - 1]
  const rowCount = narrow ? topDeg + 1 : s.rows
  const rowH = (H - s.pad - s.stripH - s.drop - s.depth - s.top) / rowCount
  // the pitch at the top row's centre
  const high = narrow ? start + topDeg : floor + s.rows - 1
  const yOfRow = (midi: number): number =>
    s.top + rowH / 2 + (high - midi) * rowH
  const yOfStair = (deg: number): number =>
    narrow ? s.top + rowH / 2 + (topDeg - deg) * rowH : yOfRow(start + deg)
  const { x0, x1 } = spanOf(mode, W, count)
  const cw = (x1 - x0) / count
  const bottom = yOfStair(0) + rowH / 2 + s.depth
  const stairs = degrees.map((deg, i): StairBox => {
    const top = yOfStair(deg) - rowH / 2
    const zoneTop = Math.min(top - 6, bottom - TARGET)
    const x = x0 + i * cw
    return {
      x,
      w: cw,
      top,
      bottom,
      zone: { x, y: zoneTop, w: cw, h: bottom - zoneTop },
    }
  })
  // Group's two groups of four need the whole octave
  const brackets = (count < MAJOR_DEGREES.length ? [] : [0, 1]).map((g) => {
    const y = stairs[g * 4 + 3].top - 28
    return { y, zone: { x: x0 + g * 4 * cw, y: y - 30, w: 4 * cw, h: TARGET } }
  })
  const rowsTop = s.top
  const rowsBottom = s.top + rowCount * rowH
  const rows: number[] = []
  for (let m = Math.floor(high) - rowCount; m <= Math.ceil(high) + 1; m++) {
    // a row shows if any of it is inside the rows' band (a hair's tolerance for rounding)
    const y = yOfRow(m)
    if (y > rowsTop - rowH / 2 + 1e-6 && y < rowsBottom + rowH / 2 - 1e-6)
      rows.push(m)
  }
  return {
    mode,
    W,
    H,
    rowH,
    yOfRow,
    rows,
    rowsTop,
    rowsBottom,
    x0,
    x1,
    stairs,
    brackets,
    strip: stripFor(mode, W, H, start, floor, degrees),
  }
}

const inside = (r: Rect, x: number, y: number): boolean =>
  x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h

/** The stair a tap at (x, y) lands on, or null. */
export function stairAt(
  layout: StairsLayout,
  x: number,
  y: number,
): number | null {
  const i = layout.stairs.findIndex((st) => inside(st.zone, x, y))
  return i === -1 ? null : i
}

/** Whether two rectangles share any area. */
export const overlaps = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
