// ============================================================
// Lesson 27 ring view — the rooms, a corner growing, the diagonal, the arrows and the bass mark, each frame
// ============================================================
//
// What the ring of rooms shows at a moment, drawn into the kit's spiral's
// overlay each frame from where its beads landed (kit/ring-rooms-draw.ts,
// kit/ring-marks.ts; WEB-SPEC, Look): the rooms, one lit with a brighter
// line and a faint fill, the others faint, each through its corners in
// their order round the ring; a fourth corner growing out to its bead in
// 0.3 s as a seventh joins; while V7 is lit in Step 3 and free play, the
// dashed diagonal from B across the centre to F; as I sounds after it, two
// arrows just outside the ring, B to C and F to E, drawing on in 0.4 s; in
// Step 4 and free play the bass mark on the corner in the bass, moving
// round the ring to the next corner in 0.3 s; the sounding notes' beads
// glowing; and the lit room's name in the centre. Under reduced motion,
// or with animations paused, every growth, arrow and move lands in place.
// The hero's ring and the steps' toy both draw through it.

import { TAU } from '@/features/lessons/kit/dom'
import { COLOR, rgba } from '@/features/lessons/kit/notes'
import { ARROW_SEC, BASS_SEC, drawArrow, drawBassMark, drawDiagonal, GROW_SEC, grownAt, } from '@/features/lessons/kit/ring-marks'
import type { Point, Ring } from '@/features/lessons/kit/ring-rooms-draw'
import { drawCentre, drawHalos, drawRoom, HALO, onRing, ringOf, } from '@/features/lessons/kit/ring-rooms-draw'
import type { SpiralFrame } from '@/features/lessons/kit/spiral'
import type { Chord } from './sounds'
import { cornersOf } from './sounds'

/** B and F, the diagonal's ends; C and E, where the arrows go (FACTS 31). */
const B = 11
const F = 5

/** A room drawn this frame: its chord, and whether it is the lit one. */
export interface ViewRoom {
  readonly chord: Chord
  readonly lit: boolean
}

/** What the ring shows: every time is ms on the frame's clock. */
export interface RingView {
  readonly rooms: readonly ViewRoom[]
  /** A room whose fourth corner is growing out: its chord's id, and when it started. */
  readonly growing: { readonly id: string; readonly since: number } | null
  /** The dashed diagonal from B to F, labelled in the readout. */
  readonly diagonal: boolean
  /** The arrows B to C and F to E, and when they started drawing. */
  readonly arrows: number | null
  /** The bass mark: its corner, semitones from C, the corner it left and when. */
  readonly bass: {
    readonly at: number
    readonly from: number
    readonly since: number
  } | null
  /** The notes sounding, by MIDI number: their beads glow. */
  readonly sounding: readonly number[]
  /** The lit room's name in the centre; none for nothing. */
  readonly centre: string
  /** Everything lands in place: reduced motion, or animations paused. */
  readonly still: boolean
}

/** A view with nothing drawn on the ring. */
export const EMPTY_VIEW: RingView = {
  rooms: [],
  growing: null,
  diagonal: false,
  arrows: null,
  bass: null,
  sounding: [],
  centre: '',
  still: false,
}

/** How far a move that started at `since` has gone, 0 to 1, in `sec`: all the way when still. */
const doneOf = (
  now: number,
  since: number,
  sec: number,
  still: boolean,
): number =>
  still ? 1 : Math.max(0, Math.min(1, (now - since) / (sec * 1000)))

/** Ease out: fast away, slow to land. */
const easeOut = (k: number): number => 1 - (1 - k) ** 3

/** Whether anything on the ring still moves at `now`, so the frame loop keeps drawing. */
export function ringMoving(v: RingView, now: number): boolean {
  if (v.still) return false
  const going = (since: number | null | undefined, sec: number): boolean =>
    since != null && now - since < sec * 1000
  return (
    going(v.growing?.since, GROW_SEC) ||
    going(v.arrows, ARROW_SEC) ||
    going(v.bass?.since, BASS_SEC)
  )
}

/** A room's corners this frame: its fourth, while growing, between the two it splits and its bead. */
function cornersNow(
  ring: Ring,
  room: ViewRoom,
  v: RingView,
  now: number,
): Point[] | null {
  const at = cornersOf(room.chord).map((pc) => onRing(ring, pc))
  if (at.some((p) => p === undefined)) return null
  const points = at as Point[]
  const grow = v.growing
  if (grow === null || grow.id !== room.chord.id || points.length < 4)
    return points
  const k = easeOut(doneOf(now, grow.since, GROW_SEC, v.still))
  if (k >= 1) return points
  // the seventh, last in ring order, grows from the middle of the edge it
  // splits, between the fifth and the root
  return [...points.slice(0, 3), grownAt(points[2], points[3], points[0], k)]
}

/** A glow round each sounding note's bead, as Lesson 12's ring lights a sounding note. */
function drawSounding(
  ctx: CanvasRenderingContext2D,
  ring: Ring,
  sounding: readonly number[],
): void {
  for (const midi of sounding) {
    const b = ring.beadAt(midi)
    if (b === undefined) continue
    const r = ring.bead * 2.6
    const glow = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, r)
    glow.addColorStop(0, rgba(COLOR.ink, 0.55))
    glow.addColorStop(1, rgba(COLOR.ink, 0))
    ctx.fillStyle = glow
    ctx.beginPath()
    ctx.arc(b.x, b.y, r, 0, TAU)
    ctx.fill()
  }
}

/**
 * Draws `v` over the spiral's frame, and says whether the ring wants the
 * next one: while anything moved in this frame, so the frame after the
 * last that moved is drawn too, landed: an arrow with its head, a corner on
 * its bead, the bass mark on its corner. Asked only as a frame starts, the
 * ring would stop a frame short of landing, and an arrow would never get
 * its head.
 */
export function drawRingFrame(
  f: SpiralFrame,
  v: RingView,
  compact = false,
): boolean {
  drawRingView(f, v, compact)
  return ringMoving(v, f.now)
}

/**
 * Draws `v` over the spiral's frame: nothing until the ring has drawn,
 * or while it is unrolled. `compact` puts the centre's name in the
 * figure's top-left corner.
 */
export function drawRingView(
  f: SpiralFrame,
  v: RingView,
  compact = false,
): void {
  const ring = ringOf(f.beads)
  if (ring === null || f.u > 0.05) return
  const { ctx, now } = f
  const halo = ring.bead * HALO
  const placed = v.rooms
    .map((room) => ({ at: cornersNow(ring, room, v, now), lit: room.lit }))
    .filter((r): r is { at: Point[]; lit: boolean } => r.at !== null)
  drawSounding(ctx, ring, v.sounding)
  placed.forEach((r) => drawRoom(ctx, r.at, halo, r.lit))
  drawHalos(ctx, placed, halo)
  if (v.diagonal) drawDiagonal(ctx, ring, B, F, halo)
  if (v.arrows !== null) {
    const k = easeOut(doneOf(now, v.arrows, ARROW_SEC, v.still))
    drawArrow(ctx, ring, B, B + 1, k)
    drawArrow(ctx, ring, F, F - 1, k)
  }
  if (v.bass !== null) {
    const { at, from, since } = v.bass
    // round the ring the way the chord's corners go, root to seventh
    const ahead = (((at - from) % 12) + 12) % 12
    const k = easeOut(doneOf(now, since, BASS_SEC, v.still))
    // its word keeps clear of the centre's name, which a compact layout
    // puts in the figure's corner
    drawBassMark(ctx, ring, (from + ahead * k) % 12, {
      centre: compact ? '' : v.centre,
      to: at,
    })
  }
  if (v.centre !== '') drawCentre(ctx, ring, v.centre, compact)
}
