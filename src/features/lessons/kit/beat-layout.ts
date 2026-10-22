// ============================================================
// Beat layout — where each part of the beat machine sits, in each state
// ============================================================
//
// Pure, so the machine's targets are unit-tested at every width (Lesson 8
// WEB-SPEC, Toys 1, Layout and targets; FACTS 80). Every part is a box in
// the figure's own pixels, and the machine moves each part to its box for
// the state it is in, so the morph from one state to the next is each part
// gliding between its two boxes:
//
// - metronome and tempo: the metronome tall at the right, its lamp under
//   its foot, the readouts at the left; the pads folded into the lamp.
// - bars: the metronome shrunk to 44 px in the top-left corner, its lamp
//   unrolled into a row of pads, one a beat, in the grid's columns.
// - grid, patterns and free: the pads become the number strip over three
//   lanes of cells, labelled in a 56 px column, the cells 4 px apart and
//   44 px tall: a bar label band, the strip and the lanes take 182 px.
//   Under a 182 px figure (a phone held sideways) the grid drops the band,
//   puts each number in its column's first cell's corner, and fits 140 px.
//   Free play keeps its taps readout under the grid's right end, so there
//   the grid leaves the readout's 44 px free at the figure's foot.

/** A box in the figure's pixels. */
export interface Rect {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
}

export type MachineState =
  | 'metronome'
  | 'tempo'
  | 'bars'
  | 'grid'
  | 'patterns'
  | 'free'

/** The grid's measures, px (WEB-SPEC, Toys 1; FACTS 80). */
export const GRID = {
  /** The figure's inner margin. */
  pad: 8,
  /** The lane labels' column. */
  label: 56,
  gap: 4,
  /** A lane's height: every cell is a 44 px target. */
  lane: 44,
  /** The number strip over the cells. */
  numbers: 20,
  /** The bar label band over the strip. */
  band: 18,
  /** The space between the band, the strip and the lanes. */
  between: 2,
  /** No cell grows wider than this, on a wide stage. */
  maxCell: 120,
  /** The small metronome's height. */
  smallMetro: 44,
  /** The tall metronome's height, at most. */
  tallMetro: 190,
  /** The readouts' column at the left of the tall metronome: "tap four times" at 18 px. */
  readW: 150,
  /** The lamp under the metronome's foot. */
  lamp: 12,
  /** The bars state's pads. */
  padH: 64,
  /** Free play's taps readout, under the grid at the figure's foot. */
  read: 44,
} as const

/** The metronome drawing's proportions (its viewBox, 170 x 220). */
const METRO_ASPECT = 170 / 220

/** The grid's height: the band, the strip and the lanes. */
export const lanesHeight = (lanes: number): number =>
  lanes * GRID.lane + (lanes - 1) * GRID.gap
export const FULL_GRID_H =
  GRID.band + GRID.between + GRID.numbers + GRID.between + lanesHeight(3)
/** Under this the grid takes its compact layout. */
export const COMPACT_UNDER = FULL_GRID_H

export interface MachineLayout {
  readonly state: MachineState
  /** True when the grid has dropped its band and moved its numbers into its cells. */
  readonly compact: boolean
  readonly metro: Rect
  readonly lamp: Rect
  /** One a beat: the bars state's pads, the grid's number strip. */
  readonly pads: readonly Rect[]
  /** One a lane. */
  readonly labels: readonly Rect[]
  /** By lane, then beat. */
  readonly cells: readonly (readonly Rect[])[]
  /** The bar label band, where a readout sits beside the grid. */
  readonly band: Rect
}

/** The grid's columns: x and width of each beat's cells, centred where they cannot grow. */
function columns(w: number, beats: number): { x: number; w: number }[] {
  const room = w - 2 * GRID.pad - GRID.label - GRID.gap * beats
  const cellW = Math.min(GRID.maxCell, room / beats)
  const used = GRID.label + beats * (cellW + GRID.gap)
  const x0 = GRID.pad + Math.max(0, (w - 2 * GRID.pad - used) / 2)
  return Array.from({ length: beats }, (_, i) => ({
    x: x0 + GRID.label + GRID.gap + i * (cellW + GRID.gap),
    w: cellW,
  }))
}

/** The grid's top-left, where its label column starts. */
function labelX(w: number, beats: number): number {
  return columns(w, beats)[0].x - GRID.gap - GRID.label
}

/** The tall metronome of Steps 1 and 2, at the right, with its lamp under it. */
function tallMetro(w: number, h: number): { metro: Rect; lamp: Rect } {
  let mh = Math.max(
    40,
    Math.min(GRID.tallMetro, h - 2 * GRID.pad - GRID.lamp - 12),
  )
  let mw = mh * METRO_ASPECT
  let x = Math.min(w - GRID.pad - 16 - mw, w * 0.64 - mw / 2)
  // on the narrowest figures it keeps clear of the readouts, and shrinks to fit
  if (x < GRID.readW) {
    x = GRID.readW
    mw = Math.min(mw, w - GRID.pad - x)
    mh = mw / METRO_ASPECT
  }
  const y = Math.max(GRID.pad, (h - mh - GRID.lamp - 12) / 2)
  return {
    metro: { x, y, w: mw, h: mh },
    lamp: {
      x: x + mw / 2 - GRID.lamp / 2,
      y: y + mh + 8,
      w: GRID.lamp,
      h: GRID.lamp,
    },
  }
}

/** The lanes' boxes and labels from `top`. */
function lanes(
  w: number,
  beats: number,
  count: number,
  top: number,
): { labels: Rect[]; cells: Rect[][] } {
  const cols = columns(w, beats)
  const lx = labelX(w, beats)
  const labels: Rect[] = []
  const cells: Rect[][] = []
  for (let i = 0; i < count; i++) {
    const y = top + i * (GRID.lane + GRID.gap)
    labels.push({ x: lx, y, w: GRID.label, h: GRID.lane })
    cells.push(cols.map((c) => ({ x: c.x, y, w: c.w, h: GRID.lane })))
  }
  return { labels, cells }
}

/** The layout of a machine `w` by `h` px in `state`, with `beats` a bar and `laneCount` lanes. */
export function machineLayout(
  state: MachineState,
  w: number,
  h: number,
  beats: number,
  laneCount = 3,
): MachineLayout {
  const compact = h < COMPACT_UNDER
  const lanesH = lanesHeight(laneCount)
  const fullH = GRID.band + GRID.between + GRID.numbers + GRID.between + lanesH
  // the compact grid hides free play's readout, so only the full one makes room for it
  const read = state === 'free' && !compact ? GRID.read : 0
  const top = compact
    ? Math.max(0, (h - lanesH) / 2)
    : Math.max(0, (h - read - fullH) / 2)
  const lanesTop = compact
    ? top
    : top + GRID.band + GRID.between + GRID.numbers + GRID.between
  const grid = lanes(w, beats, laneCount, lanesTop)
  const cols = columns(w, beats)
  const lx = labelX(w, beats)
  const band: Rect = { x: lx, y: top, w: w - lx - GRID.pad, h: GRID.band }
  const small: Rect = {
    x: lx + (GRID.label - GRID.smallMetro * METRO_ASPECT) / 2,
    y: Math.max(0, lanesTop - GRID.smallMetro - GRID.between),
    w: GRID.smallMetro * METRO_ASPECT,
    h: GRID.smallMetro,
  }
  const base = { state, compact, labels: grid.labels, cells: grid.cells, band }
  if (state === 'metronome' || state === 'tempo') {
    const { metro, lamp } = tallMetro(w, h)
    return { ...base, metro, lamp, pads: cols.map(() => lamp) }
  }
  const lamp: Rect = { x: small.x, y: small.y, w: 0, h: 0 }
  if (state === 'bars') {
    const padH = compact ? GRID.lane : GRID.padH
    const y = lanesTop + (lanesH - padH) / 2
    return {
      ...base,
      metro: small,
      lamp,
      pads: cols.map((c) => ({ x: c.x, y, w: c.w, h: padH })),
    }
  }
  const pads = compact
    ? cols.map((c) => ({ x: c.x + 3, y: lanesTop + 2, w: 18, h: 14 }))
    : cols.map((c) => ({
        x: c.x,
        y: top + GRID.band + GRID.between,
        w: c.w,
        h: GRID.numbers,
      }))
  return { ...base, metro: small, lamp, pads }
}

/** Free play's taps readout: the right end of the figure's foot, `GRID.read` tall. */
export function freeReadBox(w: number, h: number): Rect {
  return { x: w * 0.55, y: h - GRID.read, w: w * 0.45, h: GRID.read }
}

/** Whether two boxes overlap (touching edges do not). */
export const overlaps = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
