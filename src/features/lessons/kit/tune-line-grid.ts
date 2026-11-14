// ============================================================
// Tune line helpers — the lines' first notes, the screen's pixel ratio, and the buttons' grid
// ============================================================
//
// The small pure parts of the tune line's core (tune-line.ts), apart so the
// core keeps to its run, its scene and its buttons: each line's first
// note across the tune, a watch on the screen's pixel ratio, where a button
// sits over the drawing, and how the arrows, Home and End move the focus
// through a grid of buttons, as WAI-ARIA's layout grid has it.

import type { Rect } from './tune-line-layout'

/** The global index of each line's first note. */
export function firstsOf(
  tune: readonly (readonly { readonly beats: number }[])[],
): number[] {
  let n = 0
  return tune.map((line) => {
    const first = n
    n += line.length
    return first
  })
}

/** Calls `fn` whenever the screen's pixel ratio changes: a zoom, or another screen. */
export function watchPixelRatio(fn: () => void): void {
  const query = window.matchMedia(
    `(resolution: ${window.devicePixelRatio || 1}dppx)`,
  )
  query.addEventListener(
    'change',
    () => {
      fn()
      watchPixelRatio(fn)
    },
    { once: true },
  )
}

/** Places a button over a rectangle of the drawing. */
export function place(b: HTMLElement, r: Rect): void {
  b.style.left = `${r.x}px`
  b.style.top = `${r.y}px`
  b.style.width = `${r.w}px`
  b.style.height = `${r.h}px`
}

/** A cell of a grid: its row, and its place in that row. */
export interface GridCell {
  readonly row: number
  readonly col: number
}

/**
 * Where a key moves the focus in a grid whose rows are `lengths` long, from
 * `at`, as WAI-ARIA's layout grid has it: an arrow a cell at a time, staying
 * put at an edge, Up and Down to the same place in the next row or to its
 * last cell if it is shorter; Home and End to the row's ends, and with
 * Control to the grid's first and last cells. Null for any other key.
 */
export function gridMove(
  lengths: readonly number[],
  at: GridCell,
  key: string,
  ctrl = false,
): GridCell | null {
  const lastRow = lengths.length - 1
  const end = (row: number): number => lengths[row] - 1
  const inRow = (row: number): GridCell => ({
    row,
    col: Math.min(at.col, end(row)),
  })
  if (ctrl)
    return key === 'Home'
      ? { row: 0, col: 0 }
      : key === 'End'
        ? { row: lastRow, col: end(lastRow) }
        : null
  switch (key) {
    case 'ArrowLeft':
      return { row: at.row, col: Math.max(0, at.col - 1) }
    case 'ArrowRight':
      return { row: at.row, col: Math.min(end(at.row), at.col + 1) }
    case 'ArrowUp':
      return inRow(Math.max(0, at.row - 1))
    case 'ArrowDown':
      return inRow(Math.min(lastRow, at.row + 1))
    case 'Home':
      return { row: at.row, col: 0 }
    case 'End':
      return { row: at.row, col: end(at.row) }
    default:
      return null
  }
}
