// ============================================================
// Stopwatch strip — a written bar's lengths in seconds, cell by cell
// ============================================================
//
// The row under any written bar (Lesson 17 WEB-SPEC, Toys 6; SEASON-2
// § 6.2 item 3): one cell per sound or rest, each as wide as its symbol's
// place in the bar, a tied run's across all its notes, and in each the
// symbol's written length at the tempo it plays, 60 / BPM times its beats,
// "1 s", "0.5 s", "0.67 s" (kit/rhythm-model.ts `secondsText`, FACTS 16,
// 63). This module only plans where each reading goes, pure, for the
// rhythm bar to draw (kit/rhythm-draw.ts); when a reading shows is the
// toy's: as its symbol ends, never before its sound.
//
// A reading must fit its cell. At 390 px a sixteenth's cell is about 22 px,
// and so is an eighth's in a two-bar figure, too narrow for "0.25 s" or
// "0.5 s". So a run of equal notes inside one beat that does not fit reads
// once under its beat, "4 × 0.25 s", in the cells' row where the run has
// room; where it has not, as at 344 px, it closes up to "4×0.25 s", and only
// when even that does not fit goes to a second row under it; a lone note that
// does not fit, such as the eighth after Step 5's dotted quarter, reads on
// that second row, centred on its cell, where it has its neighbours' room. A
// strip can read only some of its cells (the rest strip's examples read only
// the rest's), and the others take no room. Second-row readings never
// overlap: one that would is moved right of the one before it, or, at the
// figure's right edge, the ones before it move left; a row too full for its
// runs' readings closes them up, "2×0.5 s". Every reading stays inside.

import type { PlacedSymbol, StripCell } from './rhythm-model'
import { runText, secondsText, stripCells, stripRuns } from './rhythm-model'

/** The strip's type: the mono face at 12 px, whose characters are 0.6 em wide. */
export const READ_CHAR_PX = 7.2

/** The room a reading keeps either side of its text, px in all. */
export const READ_PAD_PX = 6

/** A reading's width, px, its room included. */
export const readWidth = (text: string): number =>
  text.length * READ_CHAR_PX + READ_PAD_PX

/** The gap between two cells, px. */
export const CELL_GAP = 2

/** One cell of the strip, in the figure's pixels. */
export interface PlannedCell extends StripCell {
  readonly left: number
  readonly right: number
}

/** One reading: its text, where its centre sits, its row, and the cells it reads for. */
export interface Reading {
  readonly text: string
  /** Its centre, px. */
  readonly x: number
  readonly width: number
  /** 0 in the cells' row, 1 on the row under it. */
  readonly row: 0 | 1
  /** The cells it reads for, by index: one, or a run's. */
  readonly cells: readonly number[]
}

/** Where every cell and every reading of a strip goes. */
export interface StripPlan {
  readonly cells: readonly PlannedCell[]
  readonly readings: readonly Reading[]
}

export interface StripOptions {
  /** The figure's beats to pixels. */
  readonly x: (beat: number) => number
  /** The strip's room, px: no reading crosses either edge. */
  readonly left: number
  readonly right: number
  /** Which cells read; every cell when it is not given. */
  readonly reads?: (cell: StripCell, index: number) => boolean
}

const centreIn = (x: number, width: number, left: number, right: number) =>
  Math.min(Math.max(x, left + width / 2), right - width / 2)

/**
 * The strip of `placed` at `bpm`: each cell's box, and each reading's text
 * and place, in the cells' row where it fits and on the row under it where
 * it does not.
 */
export function planStrip(
  placed: readonly PlacedSymbol[],
  bpm: number,
  o: StripOptions,
): StripPlan {
  const strip = stripCells(placed)
  const cells: PlannedCell[] = strip.map((c) => ({
    ...c,
    left: o.x(c.at) + CELL_GAP / 2,
    right: o.x(c.at + c.beats) - CELL_GAP / 2,
  }))
  const reads = strip.map((c, i) => o.reads?.(c, i) ?? true)
  const runs = stripRuns(strip)
  const runOf = (i: number) => runs.find((r) => i >= r.from && i <= r.to)
  const readings: Reading[] = []
  const done = new Set<number>()
  cells.forEach((c, i) => {
    if (!reads[i] || done.has(i)) return
    const text = secondsText(c.beats, bpm)
    const width = readWidth(text)
    const mid = (c.left + c.right) / 2
    if (width <= c.right - c.left) {
      readings.push({ text, x: mid, width, row: 0, cells: [i] })
      return
    }
    const run = runOf(i)
    if (run !== undefined) {
      const members = Array.from(
        { length: run.count },
        (_, k) => run.from + k,
      ).filter((k) => reads[k])
      const from = cells[run.from]
      const to = cells[run.to]
      const room = to.right - from.left
      const full = runText(run, bpm)
      const close = full.replace(' × ', '×')
      const fits = [full, close].find((t) => readWidth(t) <= room)
      const reading = fits ?? full
      const runWidth = readWidth(reading)
      for (const k of members) done.add(k)
      readings.push({
        text: reading,
        x: centreIn((from.left + to.right) / 2, runWidth, o.left, o.right),
        width: runWidth,
        row: fits === undefined ? 1 : 0,
        cells: members,
      })
      return
    }
    readings.push({
      text,
      x: centreIn(mid, width, o.left, o.right),
      width,
      row: 1,
      cells: [i],
    })
  })
  return { cells, readings: spread(readings, o.left, o.right) }
}

/** A run's reading closed up, "2×0.5 s"; any other as it is. */
function closed(r: Reading): Reading {
  const text = r.text.replace(' × ', '×')
  return text === r.text ? r : { ...r, text, width: readWidth(text) }
}

/**
 * The second row's readings moved apart so none overlaps another: each
 * pushed right of the one before it, then, back from the right edge, left of
 * the one after it, its runs closed up first when the row cannot hold them.
 */
function spread(
  readings: readonly Reading[],
  left: number,
  right: number,
): Reading[] {
  const total = readings.reduce((w, r) => w + (r.row === 1 ? r.width : 0), 0)
  const fitted =
    total > right - left
      ? readings.map((r) => (r.row === 1 ? closed(r) : r))
      : readings
  const second = fitted.flatMap((r, i) => (r.row === 1 ? [i] : []))
  const xs = fitted.map((r) => r.x)
  let edge = left
  for (const i of second) {
    xs[i] = Math.max(xs[i], edge + fitted[i].width / 2)
    edge = xs[i] + fitted[i].width / 2
  }
  edge = right
  for (const i of second.reverse()) {
    xs[i] = Math.min(xs[i], edge - fitted[i].width / 2)
    edge = xs[i] - fitted[i].width / 2
  }
  return fitted.map((r, i) => (xs[i] === r.x ? r : { ...r, x: xs[i] }))
}
