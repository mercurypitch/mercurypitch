// ============================================================
// Studio kit hit — where a drum lane's hit is drawn, a compact square at its start sized to its row, and where a press takes it, never less than its row's height
// ============================================================
//
// A hit sounds the same however long it is, so a kit's roll draws it as a
// square at its start rather than a bar: as tall as its row less a margin,
// and stopping 2 px short of the next hit on its row, so hits on close
// steps never run together. A press takes a hit anywhere in a square as
// tall as its row, centred on the drawn one however small that is, and a
// finger reaches past it (edit-kit.ts). The drawing (note-roll-draw.ts) and
// the picking both read this, so a hit is taken where it is drawn.
import type { RollRect } from '@/lib/roll-geometry'

/** The least a hit's square draws, in CSS pixels. */
const LEAST_SIDE = 4
/** The room a square leaves before the next hit on its row. */
const GAP = 2

/** The square a hit draws: from `x`, its start, in the row from `top` that is `height` tall, short of `nextX`, where the next hit on its row starts. */
export function kitHitSquare(
  x: number,
  top: number,
  height: number,
  nextX = Infinity,
): RollRect {
  const margin = Math.max(2, Math.round(height * 0.18))
  const side = Math.max(
    LEAST_SIDE,
    Math.min(height - 2 * margin, nextX - x - GAP),
  )
  return {
    x: x + 0.5,
    y: top + (height - side) / 2,
    width: side,
    height: side,
  }
}

/** Where a press takes a hit: its row's height, and as wide, about its square. */
export function kitHitTarget(
  square: RollRect,
  top: number,
  height: number,
): RollRect {
  const size = Math.max(height, square.width)
  return {
    x: square.x + square.width / 2 - size / 2,
    y: top,
    width: size,
    height,
  }
}

/** Each row's hits' starts, in order: what finds the next hit on a row. */
export function kitRowStarts(
  hits: Iterable<{ readonly row: number; readonly start: number }>,
): ReadonlyMap<number, readonly number[]> {
  const rows = new Map<number, number[]>()
  for (const hit of hits) {
    const starts = rows.get(hit.row)
    if (starts === undefined) rows.set(hit.row, [hit.start])
    else starts.push(hit.start)
  }
  for (const starts of rows.values()) starts.sort((a, b) => a - b)
  return rows
}

/** Where the next hit on `row` after `start` starts; Infinity when none does. */
export function kitNextStart(
  rows: ReadonlyMap<number, readonly number[]>,
  row: number,
  start: number,
): number {
  const starts = rows.get(row) ?? []
  let low = 0
  let high = starts.length
  while (low < high) {
    const middle = (low + high) >> 1
    if (starts[middle] <= start) low = middle + 1
    else high = middle
  }
  return low < starts.length ? starts[low] : Infinity
}
