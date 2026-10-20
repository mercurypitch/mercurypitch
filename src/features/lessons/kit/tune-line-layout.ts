// ============================================================
// Tune line layout — where a tune's beads, gaps and brackets sit, and their targets
// ============================================================
//
// A tune drawn as the app's piano roll draws pitch: each note a bead on
// faint semitone rows, set left to right in time, a note's column as wide
// as its length (a minim twice a crotchet), the beads joined by a line
// (Lesson 6 WEB-SPEC, Toys 1). This file only measures; tune-line-draw.ts
// paints and tune-line.ts runs it.
//
// Every target is at least 44 px square and none overlaps another (FACTS
// 72 there). A bead's target is its column, the full height of its band of
// rows. A gap's target is as wide as a crotchet's column, centred under its
// gap in a strip below the names; brackets over named gaps take the same
// width in a strip above the line. Lines that are shown together stack,
// each on a band of its own, at every width: in one row their crotchets
// would get under 44 px even on a desktop. The move from one line's last
// note to the next line's first takes the last crotchet's width of the
// upper line's strip. Narrower than eight 44 px crotchets, a line's
// crotchets stay 44 px and its last note takes what is left, and once the
// last gap's button would meet the join's, every gap button shifts left
// together, never by more than half a crotchet, so each still lies under
// its own gap.

/** The smallest target, px (WCAG 2.5.5, the series' rule). */
export const MIN_TARGET = 44
/** The names strip under a line, the strip of gaps or marks under that, and the brackets' strip over it. */
export const NAMES_H = 20
export const STRIP_H = 44
/** Space between stacked lines, and above the first and below the last. */
export const LINE_SPACE = 12
export const PAD_Y = 8
/** A bead's height, and the most rows may sit apart before the drawing centres instead. */
export const BEAD_H = 16
export const ROW_MAX = 12

export interface Rect {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
}

export interface TuneLayoutSpec {
  readonly width: number
  readonly height: number
  /** Each line's note lengths, in crotchets, for the lines drawn. */
  readonly beats: readonly (readonly number[])[]
  /** Rows a band holds: 21 for one line on C4 to G♯5, 10 for a stacked line's do to la. */
  readonly rows: number
  readonly names: boolean
  /** A strip under each line's names, for contour marks or the gaps' numbers and buttons. */
  readonly below: boolean
  /** A strip over each line, for brackets over named gaps. */
  readonly above: boolean
  /** Spread the rows over the whole height (the compact line), rather than at most ROW_MAX apart. */
  readonly fill?: boolean
}

/** One drawn line: its band of rows, its columns and strips, and its targets. */
export interface LineBox {
  /** The band's top and bottom: the highest row's bead top and the lowest's bead bottom. */
  readonly bandTop: number
  readonly bandBottom: number
  /** Rows apart, px, and a bead's height. */
  readonly rowGap: number
  readonly bead: number
  /** Each note's column, left to right. */
  readonly cols: readonly { readonly x: number; readonly w: number }[]
  /** The middle of the names strip, or null without one. */
  readonly namesY: number | null
  readonly below: { readonly top: number; readonly bottom: number } | null
  readonly above: { readonly top: number; readonly bottom: number } | null
  /** Each note's target: its column, the band's height. */
  readonly beads: readonly Rect[]
}

/** A gap between two notes, counted across the lines: gap g runs from note g to note g + 1. */
export interface GapBox {
  /** The line whose strip holds it: the line of its first note. */
  readonly line: number
  /** Where the gap is: the boundary between the two notes' columns, or the end of the line for a join. */
  readonly x: number
  /** True for the move from one line's last note to the next line's first. */
  readonly join: boolean
  /** Its target in the strip under the names, null without that strip. */
  readonly target: Rect | null
  /** Its bracket's target in the strip over the line, null without that strip. */
  readonly bracket: Rect | null
}

export interface TuneLayout {
  readonly width: number
  readonly height: number
  readonly lines: readonly LineBox[]
  readonly gaps: readonly GapBox[]
  /** How far every gap button sits left of its gap, px (0 unless the line is narrow). */
  readonly shift: number
}

/** A line's crotchet width: the width over its crotchets, but never under MIN_TARGET. */
export function crotchetOf(width: number, beats: readonly number[]): number {
  const total = beats.reduce((s, b) => s + b, 0)
  return Math.max(MIN_TARGET, width / Math.max(1, total))
}

/** A line's columns: each note `beats` crotchets wide, the last taking what is left. */
export function columnsOf(
  width: number,
  beats: readonly number[],
): { x: number; w: number }[] {
  const c = crotchetOf(width, beats)
  const cols: { x: number; w: number }[] = []
  let x = 0
  beats.forEach((b, i) => {
    const w = i === beats.length - 1 ? width - x : b * c
    cols.push({ x, w })
    x += w
  })
  return cols
}

interface Vertical {
  readonly top: number
  readonly band: number
  readonly perLine: number
  readonly bead: number
  readonly rowGap: number
}

/** The band's height and where the drawing starts, centred in the height. */
function vertical(spec: TuneLayoutSpec): Vertical {
  const count = spec.beats.length
  const fixed =
    (spec.above ? STRIP_H : 0) +
    (spec.names ? NAMES_H : 0) +
    (spec.below ? STRIP_H : 0)
  const room =
    (spec.height - 2 * PAD_Y - count * fixed - (count - 1) * LINE_SPACE) / count
  const rows = Math.max(2, spec.rows)
  const ideal = (rows - 1) * ROW_MAX + BEAD_H
  const band = Math.max(
    MIN_TARGET,
    spec.fill === true ? room : Math.min(room, ideal),
  )
  const bead = Math.min(BEAD_H, Math.max(8, (band / rows) * 1.8))
  const used = count * (fixed + band) + (count - 1) * LINE_SPACE
  return {
    top: Math.max(PAD_Y, (spec.height - used) / 2),
    band,
    perLine: fixed + band + LINE_SPACE,
    bead,
    rowGap: (band - bead) / (rows - 1),
  }
}

function lineBox(spec: TuneLayoutSpec, v: Vertical, k: number): LineBox {
  const y0 = v.top + k * v.perLine
  const aboveH = spec.above ? STRIP_H : 0
  const bandTop = y0 + aboveH
  const bandBottom = bandTop + v.band
  const namesY = spec.names ? bandBottom + NAMES_H / 2 : null
  const belowTop = bandBottom + (spec.names ? NAMES_H : 0)
  const cols = columnsOf(spec.width, spec.beats[k])
  return {
    bandTop,
    bandBottom,
    rowGap: v.rowGap,
    bead: v.bead,
    cols,
    namesY,
    below: spec.below ? { top: belowTop, bottom: belowTop + STRIP_H } : null,
    above: spec.above ? { top: y0, bottom: y0 + aboveH } : null,
    beads: cols.map((c) => ({ x: c.x, y: bandTop, w: c.w, h: v.band })),
  }
}

/**
 * How far the gap buttons shift left so the last 44 px of an upper line's
 * strip stay its join's: the overlap of its last inner gap's button with
 * the join's, at most half a crotchet.
 */
export function gapShift(width: number, beats: readonly number[]): number {
  const cols = columnsOf(width, beats)
  if (cols.length < 2) return 0
  const c = crotchetOf(width, beats)
  const lastInner = cols[cols.length - 1].x
  return Math.min(c / 2, Math.max(0, lastInner + c / 2 - (width - c)))
}

/** Lays a tune's lines out on a `width` by `height` canvas. */
export function tuneLayout(spec: TuneLayoutSpec): TuneLayout {
  const v = vertical(spec)
  const lines = spec.beats.map((_, k) => lineBox(spec, v, k))
  const joined = spec.beats.length > 1
  const shift = joined
    ? Math.max(
        0,
        ...spec.beats.slice(0, -1).map((b) => gapShift(spec.width, b)),
      )
    : 0
  const gaps: GapBox[] = []
  lines.forEach((L, k) => {
    const c = crotchetOf(spec.width, spec.beats[k])
    const strip = (
      at: { top: number; bottom: number } | null,
      x: number,
    ): Rect | null =>
      at === null ? null : { x, y: at.top, w: c, h: at.bottom - at.top }
    L.cols.slice(1).forEach((col) => {
      const x = col.x
      gaps.push({
        line: k,
        x,
        join: false,
        target: strip(L.below, x - c / 2 - shift),
        bracket: strip(L.above, x - c / 2 - shift),
      })
    })
    if (k < lines.length - 1)
      gaps.push({
        line: k,
        x: spec.width,
        join: true,
        target: strip(L.below, spec.width - c),
        bracket: null,
      })
  })
  return { width: spec.width, height: spec.height, lines, gaps, shift }
}

/** The y of a pitch on a band whose highest row is `hi`, `lo` its lowest. */
export function pitchY(L: LineBox, hi: number, pitch: number): number {
  return L.bandTop + L.bead / 2 + (hi - pitch) * L.rowGap
}

/** Whether two rectangles overlap (touching edges do not). */
export function overlaps(a: Rect, b: Rect): boolean {
  const e = 0.001
  return (
    a.x < b.x + b.w - e &&
    b.x < a.x + a.w - e &&
    a.y < b.y + b.h - e &&
    b.y < a.y + a.h - e
  )
}
