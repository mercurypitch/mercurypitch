// ============================================================
// Ring of rooms drawing — the ring from the lit turn's beads, a chord's notes joined as a room
// ============================================================
//
// Lesson 12's ring of rooms, moved into the kit so a later lesson draws its
// chords on the same ring (Lesson 27's WEB-SPEC, What the kit and the app
// still need, item 4); its mount is ring-rooms.ts. The ring is the kit's
// spiral seen from above, so one turn is a ring of twelve and C4 to B4 sit
// on it. A room is a chord's notes joined round the ring, drawn each frame
// in the spiral's overlay from where its beads landed, so it stays on the
// ring however a drag, Shift with an arrow or a flick has turned it. A
// note's bead is picked by its name on the lit turn, `s = m - LO` for m
// from 60 to 71, whatever octave sounds, since until the camera reaches the
// top the frame also holds the other turns' beads (`ringOf`, `onRing`).
// Every room is chrome, whatever its quality, with a halo round each
// corner; the lit room has a brighter line and a faint fill, the others
// are faint, and the ring's centre names the lit room (`drawRoom`,
// `drawHalos`, `drawCentre`). Pure drawing, with no spiral of its own, so a
// page's drawing and its tests load it alone. What moves on the ring, and
// why, is each page's own (Lesson 12's rooms-draw.ts).

import { lerp, TAU } from './dom'
import { COLOR, rgba } from './notes'
import type { BeadHit } from './spiral-draw'
import { LO } from './spiral-keys'

/** The turn lit from above starts on C4, so C4 to B4 sit on it. */
export const RING = 60
/** A corner's halo radius, against a bead's; a room's edges stop at it. */
export const HALO = 1.6

export interface Point {
  readonly x: number
  readonly y: number
}

/** A note's place on the ring, whatever its octave: C = 0 to B = 11. */
export const pcOf = (n: number): number => ((n % 12) + 12) % 12

export interface Ring {
  readonly c: Point
  readonly radius: number
  /** The largest of the ring's beads, for the halos. */
  readonly bead: number
  /** A note's bead on the lit turn, by its name: whole semitones from C. */
  readonly beadAt: (n: number) => BeadHit | undefined
}

/** The lit turn's bead for a place on the ring, semitones from C, in any octave. */
const beadFor = (beads: readonly BeadHit[], n: number): BeadHit | undefined =>
  beads.find((b) => b.s === RING + pcOf(n) - LO)

/** The ring this frame, from the lit turn's beads: null until it has drawn at least three. */
export function ringOf(beads: readonly BeadHit[]): Ring | null {
  const ring = beads.filter((b) => b.s >= RING - LO && b.s < RING - LO + 12)
  if (ring.length < 3) return null
  const c = {
    x: ring.reduce((n, b) => n + b.x, 0) / ring.length,
    y: ring.reduce((n, b) => n + b.y, 0) / ring.length,
  }
  const radius =
    ring.reduce((n, b) => n + Math.hypot(b.x - c.x, b.y - c.y), 0) / ring.length
  const bead = Math.max(...ring.map((b) => b.r))
  return { c, radius, bead, beadAt: (n) => beadFor(beads, n) }
}

/** A place on the ring, semitones from C: a bead, or round the centre between two neighbours. */
export function onRing(ring: Ring, at: number): Point | undefined {
  const lo = Math.floor(at)
  const f = at - lo
  const a = ring.beadAt(lo)
  const b = ring.beadAt(lo + 1)
  if (a === undefined || b === undefined) return undefined
  if (f < 1e-9) return a
  if (f > 1 - 1e-9) return b
  const { c } = ring
  const a0 = Math.atan2(a.y - c.y, a.x - c.x)
  const a1 = Math.atan2(b.y - c.y, b.x - c.x)
  // neighbours are a semitone apart, so the short way between them is the ring's
  const turn = ((((a1 - a0) % TAU) + TAU + Math.PI) % TAU) - Math.PI
  const angle = a0 + turn * f
  const r = lerp(
    Math.hypot(a.x - c.x, a.y - c.y),
    Math.hypot(b.x - c.x, b.y - c.y),
    f,
  )
  return { x: c.x + r * Math.cos(angle), y: c.y + r * Math.sin(angle) }
}

/** A room's outline: a faint fill when lit, then its edges, each stopping at the corners' halos. */
export function drawRoom(
  ctx: CanvasRenderingContext2D,
  at: readonly Point[],
  halo: number,
  lit: boolean,
): void {
  if (lit) {
    ctx.fillStyle = rgba(COLOR.chrome, 0.08)
    ctx.beginPath()
    ctx.moveTo(at[0].x, at[0].y)
    at.slice(1).forEach((p) => ctx.lineTo(p.x, p.y))
    ctx.closePath()
    ctx.fill()
  }
  ctx.strokeStyle = rgba(COLOR.chrome, lit ? 0.9 : 0.35)
  ctx.lineWidth = lit ? 1.5 : 1
  ctx.beginPath()
  at.forEach((a, i) => {
    const b = at[(i + 1) % at.length]
    const d = Math.hypot(b.x - a.x, b.y - a.y)
    if (d <= 2 * halo) return
    const ux = (b.x - a.x) / d
    const uy = (b.y - a.y) / d
    ctx.moveTo(a.x + ux * halo, a.y + uy * halo)
    ctx.lineTo(b.x - ux * halo, b.y - uy * halo)
  })
  ctx.stroke()
}

/** The halos round every corner drawn, each once, bright where a corner of the lit room. */
export function drawHalos(
  ctx: CanvasRenderingContext2D,
  placed: readonly { at: readonly Point[]; lit: boolean }[],
  halo: number,
): void {
  const halos = new Map<string, { p: Point; lit: boolean }>()
  for (const room of placed)
    for (const p of room.at) {
      const id = `${p.x.toFixed(1)},${p.y.toFixed(1)}`
      halos.set(id, { p, lit: room.lit || halos.get(id)?.lit === true })
    }
  ctx.lineWidth = 1.5
  for (const { p, lit } of halos.values()) {
    ctx.strokeStyle = rgba(COLOR.chrome, lit ? 0.85 : 0.35)
    ctx.beginPath()
    ctx.arc(p.x, p.y, halo, 0, TAU)
    ctx.stroke()
  }
}

/** The lit room's name in the ring's centre, or in the figure's top-left corner in a compact layout. */
export function drawCentre(
  ctx: CanvasRenderingContext2D,
  ring: Ring,
  text: string,
  compact = false,
): void {
  ctx.font = '600 14px Outfit, sans-serif'
  ctx.fillStyle = COLOR.ink
  ctx.textBaseline = 'middle'
  ctx.textAlign = compact ? 'left' : 'center'
  if (compact) ctx.fillText(text, 10, 14)
  else ctx.fillText(text, ring.c.x, ring.c.y)
}
