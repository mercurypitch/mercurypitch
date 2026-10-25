// ============================================================
// Band chart arcs — Merc's leaps, from one band to the next
// ============================================================
//
// Lesson 9's ladder chart (WEB-SPEC, Toys 1): Merc's leap is an amber arc
// from the end of one band to the start of the next, rising above the
// straight line between them; a drawing convention for a leap, not a
// timeline (FACTS 100), while a sung line is the violet trace and needs no
// arc. An arc draws part of itself, so that it draws as his second note
// sounds, and can carry a plain digit beside its apex once it is drawn that
// far: Step 4 numbers its five leaps, each in a column of its own
// (`columnArcs`). The rungs' painter draws the arcs over every band and
// under every lit edge (kit/band-chart-rungs.ts); like it, a module that
// only a lesson with rungs downloads.
//
// The arc is a parabola over its span, so it never runs back in time: at a
// fraction s of the way across it stands 4 rise s (1 - s) above the chord.
// A quarter of the climb in its rise brings it into a higher band about
// level, an eighth of its width lifts even a level leap, and it never rises
// past the plot's top.

import type { ChartFrame } from './band-chart-draw'
import { BAND_COLOR, MONO, xOf, yOf } from './band-chart-draw'

/** One end of an arc: seconds across the window and cents from do. */
export interface ArcEnd {
  readonly t: number
  readonly c: number
}

/** One of Merc's leaps on the chart. */
export interface Arc {
  /** Where it leaves, the end of one band, and where it lands, the start of the next. */
  readonly from: ArcEnd
  readonly to: ArcEnd
  /** How much of it is drawn from where it leaves, 0 to 1 (default whole): it draws as the note sounds. */
  readonly drawn?: number
  /** A plain number beside its apex, shown once it is drawn that far: Step 4's 1 to 5. */
  readonly digit?: number
}

/** The straight pieces a whole arc is drawn in. */
const STEPS = 24

/** How far the digit's centre stands out from the arc's middle, px. */
const DIGIT_OUT = 10

type Point = { readonly x: number; readonly y: number }

const clamp = (v: number, lo: number, hi: number): number =>
  Math.min(Math.max(v, lo), hi)

/** Where the arc stands at a fraction of the way across: 0 where it leaves, 1 where it lands. */
function shapeOf(f: ChartFrame, a: Arc): (s: number) => Point {
  const x0 = xOf(f, a.from.t)
  const x1 = xOf(f, a.to.t)
  // a note beyond the chart is pinned to its edge, as the trace's are
  const y0 = yOf(f, clamp(a.from.c, f.lo, f.hi))
  const y1 = yOf(f, clamp(a.to.c, f.lo, f.hi))
  // the highest rise whose top still touches the plot's at most
  const room = (Math.sqrt(y0 - f.top) + Math.sqrt(y1 - f.top)) ** 2 / 4
  const rise = Math.min(Math.abs(y1 - y0) / 4 + Math.abs(x1 - x0) / 8, room)
  return (s) => ({
    x: x0 + (x1 - x0) * s,
    y: y0 + (y1 - y0) * s - 4 * rise * s * (1 - s),
  })
}

/**
 * The digit, amber, centred out from the arc's middle along the chord's
 * normal on the side the arc bows to (up and back for a leap up, up and on
 * for a leap down), and kept inside the plot.
 */
function drawDigit(
  f: ChartFrame,
  at: (s: number) => Point,
  digit: number,
): void {
  const { ctx } = f
  const [start, mid, end] = [at(0), at(0.5), at(1)]
  const dx = end.x - start.x
  const dy = end.y - start.y
  const length = Math.hypot(dx, dy) || 1
  const words = String(digit)
  ctx.font = MONO
  const half = ctx.measureText(words).width / 2
  ctx.fillStyle = BAND_COLOR.target
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(
    words,
    clamp(mid.x + (dy / length) * DIGIT_OUT, f.x0 + half, f.x1 - half),
    clamp(mid.y - (dx / length) * DIGIT_OUT, f.top + 6, f.bottom - 6),
  )
}

/** One arc, as far as it is drawn, and its digit once it is drawn half way. */
function drawArc(f: ChartFrame, a: Arc): void {
  const drawn = clamp(a.drawn ?? 1, 0, 1)
  if (drawn <= 0) return
  const { ctx } = f
  const at = shapeOf(f, a)
  ctx.beginPath()
  for (let k = 0; k < STEPS * drawn; k++) {
    const p = at(k / STEPS)
    if (k === 0) ctx.moveTo(p.x, p.y)
    else ctx.lineTo(p.x, p.y)
  }
  const end = at(drawn)
  ctx.lineTo(end.x, end.y)
  ctx.stroke()
  if (a.digit !== undefined && drawn >= 0.5) drawDigit(f, at, a.digit)
}

/**
 * Merc's leaps, each in amber as far as it is drawn. The arcs set every
 * style their strokes take, so that nothing an earlier mark or frame left
 * (the line's round caps, a dash, an alpha) reaches them: butt ends stop
 * an arc where its bands do.
 */
export function drawArcs(f: ChartFrame, arcs: readonly Arc[]): void {
  const { ctx } = f
  ctx.strokeStyle = BAND_COLOR.target
  ctx.lineWidth = 2
  ctx.lineCap = 'butt'
  ctx.lineJoin = 'round'
  ctx.setLineDash([])
  ctx.globalAlpha = 1
  for (const a of arcs) drawArc(f, a)
}

/**
 * Leaps in rung mode (Step 4, where every rung spans the plot): the window
 * cut into equal columns in play order, one leap a column from its first
 * note to its second, numbered from 1, each keeping an eighth of its column
 * clear either side, so that two leaps sharing a note never join.
 */
export function columnArcs(
  leaps: readonly (readonly [from: number, to: number])[],
  window: number,
): Arc[] {
  const column = window / leaps.length
  return leaps.map(([from, to], i) => ({
    from: { t: (i + 1 / 8) * column, c: from },
    to: { t: (i + 7 / 8) * column, c: to },
    digit: i + 1,
  }))
}
