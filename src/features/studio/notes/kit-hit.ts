// ============================================================
// Studio kit hit — where a drum lane's hit is drawn, a compact square at its start sized to its row, and where a press takes it, never less than its row's height
// ============================================================
//
// A hit sounds the same however long it is, so a kit's roll draws it as a
// square at its start rather than a bar: as tall as its row less a margin,
// and no wider than a sixteenth at the zoom shown, so hits on neighbouring
// sixteenths never run together. A press takes a hit anywhere in a square
// as tall as its row, centred on the drawn one however small that is, and
// a finger reaches past it (edit-kit.ts). The drawing (note-roll-draw.ts)
// and the picking both read this, so a hit is taken where it is drawn.
import type { RollRect, RollViewport } from '@/lib/roll-geometry'
import { STUDIO_PPQ } from '@/lib/studio/model/types'

/** A sixteenth: a kit's step, and the widest a hit's square is at a zoom that shows it narrow. */
const SIXTEENTH_TICKS = STUDIO_PPQ / 4
/** The least a hit's square draws, in CSS pixels. */
const LEAST_SIDE = 4

/** The square a hit draws: from `x`, its start, in the row from `top` that is `height` tall. */
export function kitHitSquare(
  x: number,
  top: number,
  height: number,
  viewport: Pick<RollViewport, 'start' | 'end' | 'width'>,
): RollRect {
  const span = viewport.end - viewport.start
  const step = span > 0 ? (SIXTEENTH_TICKS / span) * viewport.width : Infinity
  const margin = Math.max(2, Math.round(height * 0.18))
  const side = Math.max(LEAST_SIDE, Math.min(height - 2 * margin, step - 2))
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
