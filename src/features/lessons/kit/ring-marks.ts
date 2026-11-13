// ============================================================
// Ring marks — a corner growing out to its bead, the diagonal across the centre, the bass mark
// ============================================================
//
// What a page draws on the kit's ring of rooms (ring-rooms-draw.ts) besides the
// rooms themselves, each a function of how far it has gone, 0 to 1, which
// the page takes from its own clock (Lesson 27's WEB-SPEC, Look):
// - a room's new corner grows out to its bead in 0.3 s: its place runs from
//   the middle of the edge it splits to its bead (`grownAt`), and the page
//   draws its halo as it lands;
// - the diagonal: a chrome line, dashed so no colour alone marks it, from
//   one bead straight across the ring's centre to another, B to F in V7
//   (`drawDiagonal`), and two short arrows just outside the ring, each from
//   a corner to the bead next to it, B to C and F to E, drawing on in 0.4 s
//   (`drawArrow`);
// - the bass mark: a chrome ring round the corner in the bass, with "bass"
//   beside it inside the ring, clear of the names the black keys carry
//   outside their beads and of the centre's, moving round the ring to the
//   next corner in 0.3 s (`drawBassMark`, at a place between beads while it
//   moves).

import { lerp, TAU } from './dom'
import { COLOR, rgba } from './notes'
import type { Point, Ring } from './ring-rooms-draw'
import { onRing } from './ring-rooms-draw'

/** A new corner grows out to its bead in this long, s. */
export const GROW_SEC = 0.3
/** The diagonal's arrows draw on in this long, s. */
export const ARROW_SEC = 0.4
/** The bass mark moves to the next corner in this long, s. */
export const BASS_SEC = 0.3

/** The bass mark's ring, against a bead's radius. */
const MARK = 2.25
/** How far outside the ring the arrows run, against a bead's radius. */
const ARROW_OUT = 2

/** A new corner's place as it grows, `k` from 0 to 1: from the middle of the edge it splits to its bead. */
export function grownAt(
  prev: Point,
  bead: Point,
  next: Point,
  k: number,
): Point {
  const from = { x: (prev.x + next.x) / 2, y: (prev.y + next.y) / 2 }
  return { x: lerp(from.x, bead.x, k), y: lerp(from.y, bead.y, k) }
}

/** A place on the ring, semitones from C, moved `out` px away from the centre, or towards it when negative. */
function outside(ring: Ring, at: number, out: number): Point | undefined {
  const p = onRing(ring, at)
  if (p === undefined) return undefined
  const d = Math.hypot(p.x - ring.c.x, p.y - ring.c.y) || 1
  return {
    x: ring.c.x + ((p.x - ring.c.x) * (d + out)) / d,
    y: ring.c.y + ((p.y - ring.c.y) * (d + out)) / d,
  }
}

/** The diagonal from bead `a` to bead `b`, straight across the centre, dashed, stopping at their halos. */
export function drawDiagonal(
  ctx: CanvasRenderingContext2D,
  ring: Ring,
  a: number,
  b: number,
  halo: number,
): void {
  const p = ring.beadAt(a)
  const q = ring.beadAt(b)
  if (p === undefined || q === undefined) return
  const d = Math.hypot(q.x - p.x, q.y - p.y)
  if (d <= 2 * halo) return
  const ux = (q.x - p.x) / d
  const uy = (q.y - p.y) / d
  ctx.save()
  ctx.strokeStyle = rgba(COLOR.chrome, 0.85)
  ctx.lineWidth = 1.5
  ctx.setLineDash([6, 5])
  ctx.beginPath()
  ctx.moveTo(p.x + ux * halo, p.y + uy * halo)
  ctx.lineTo(q.x - ux * halo, q.y - uy * halo)
  ctx.stroke()
  ctx.restore()
}

/**
 * A short arrow just outside the ring from bead `from` round to bead `to`,
 * one bead along, drawn on as far as `k` and its head drawn once it lands.
 */
export function drawArrow(
  ctx: CanvasRenderingContext2D,
  ring: Ring,
  from: number,
  to: number,
  k: number,
): void {
  if (k <= 0) return
  const out = ring.bead * ARROW_OUT
  const start = from + (to - from) * 0.15
  const end = from + (to - from) * (0.15 + 0.7 * Math.min(1, k))
  const steps = 8
  const pts: Point[] = []
  for (let i = 0; i <= steps; i++) {
    const p = outside(ring, lerp(start, end, i / steps), out)
    if (p !== undefined) pts.push(p)
  }
  if (pts.length < 2) return
  ctx.strokeStyle = rgba(COLOR.chrome, 0.9)
  ctx.fillStyle = rgba(COLOR.chrome, 0.9)
  ctx.lineWidth = 1.75
  ctx.beginPath()
  ctx.moveTo(pts[0].x, pts[0].y)
  pts.slice(1).forEach((p) => ctx.lineTo(p.x, p.y))
  ctx.stroke()
  if (k < 1) return
  // the head, along the arrow's last stretch
  const tip = pts[pts.length - 1]
  const back = pts[pts.length - 2]
  const a = Math.atan2(tip.y - back.y, tip.x - back.x)
  const size = Math.max(6, ring.bead * 0.7)
  ctx.beginPath()
  ctx.moveTo(tip.x, tip.y)
  ctx.lineTo(
    tip.x - size * Math.cos(a - 0.45),
    tip.y - size * Math.sin(a - 0.45),
  )
  ctx.lineTo(
    tip.x - size * Math.cos(a + 0.45),
    tip.y - size * Math.sin(a + 0.45),
  )
  ctx.closePath()
  ctx.fill()
}

/** Where the bass mark's word sits: inside the ring, just past the mark towards the centre. */
export function bassLabelAt(ring: Ring, at: number): Point | undefined {
  return outside(ring, at, -ring.bead * (MARK + 1.7))
}

/** The bass mark at `at`, semitones from C, between two beads while it moves: a ring and "bass" beside it. */
export function drawBassMark(
  ctx: CanvasRenderingContext2D,
  ring: Ring,
  at: number,
): void {
  const p = onRing(ring, at)
  const word = bassLabelAt(ring, at)
  if (p === undefined || word === undefined) return
  ctx.strokeStyle = rgba(COLOR.chrome, 0.95)
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(p.x, p.y, ring.bead * MARK, 0, TAU)
  ctx.stroke()
  ctx.font = '600 12px Outfit, sans-serif'
  ctx.fillStyle = COLOR.ink
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('bass', word.x, word.y)
}
