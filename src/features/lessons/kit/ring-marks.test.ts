// ============================================================
// Ring marks tests — a corner growing out, the diagonal and its arrows, the bass mark
// ============================================================
//
// The frames are the kit's own spiral seen from above, drawn by
// `drawSpiral` on C4's turn with its black keys lit, and the drawing goes to
// a context that records its calls. A new corner starts at the middle of the
// edge it splits and lands on its bead; the diagonal runs dashed from B
// straight across the centre to F, a halo short of each; an arrow runs just
// outside the ring from a bead towards the next and carries its head only
// once it lands; and the bass mark rings its corner, with its word inside
// the ring, clear of the black keys' names drawn outside their beads
// (Lesson 27's WEB-SPEC, Toys 1 and Look).

import { describe, expect, it } from 'vitest'
import './browser-doubles.test-fixtures'
import { bassLabelAt, drawArrow, drawBassMark, drawDiagonal, grownAt, } from './ring-marks'
import { RING_BLACK } from './ring-rooms'
import type { Point, Ring } from './ring-rooms-draw'
import { pcOf, ringOf } from './ring-rooms-draw'
import type { BeadHit } from './spiral-draw'
import { drawSpiral } from './spiral-draw'
import { LO } from './spiral-keys'

interface Call {
  readonly name: string
  readonly args: readonly unknown[]
  readonly dash: readonly number[]
}

/** A context that records every call, with the line dash set when it was made. */
function recorder(): { ctx: CanvasRenderingContext2D; calls: Call[] } {
  const calls: Call[] = []
  let dash: number[] = []
  const style = { fillStyle: '', strokeStyle: '' } as Record<string, unknown>
  const ctx = new Proxy(style, {
    get: (t, k) => {
      if (typeof k !== 'string') return undefined
      if (k in t) return t[k]
      if (k === 'createRadialGradient' || k === 'createLinearGradient')
        return () => ({ addColorStop: () => undefined })
      if (k === 'measureText') return () => ({ width: 10 })
      if (k === 'setLineDash')
        return (d: number[]) => {
          dash = [...d]
        }
      if (k === 'restore')
        return () => {
          dash = []
        }
      return (...args: unknown[]) => calls.push({ name: k, args, dash })
    },
    set: (t, k, v: unknown) => {
      t[k as string] = v
      return true
    },
  }) as unknown as CanvasRenderingContext2D
  return { ctx, calls }
}

/** The lit turn's beads, C4 to B4 from above, as the spiral drew them. */
const BEADS: BeadHit[] = drawSpiral(recorder().ctx, 420, 360, 0, {
  yaw: 0,
  u: 0,
  labels: 'letter',
  lit: new Set(RING_BLACK),
  narrow: false,
  pan: 0,
  focused: false,
  sel: 15,
  pulses: new Map(),
  keyLabels: 'landmarks',
  span: null,
  spelling: 'sharps',
  top: 1,
  ringFrom: 60 - LO,
}).hits

const RING = ((): Ring => {
  const ring = ringOf(BEADS)
  if (ring === null) throw new Error('no ring')
  return ring
})()

const bead = (pc: number): BeadHit => {
  const b = BEADS.find((h) => h.s === 60 + pcOf(pc) - LO)
  if (b === undefined) throw new Error(`no bead ${pc}`)
  return b
}
const dist = (p: Point, q: Point): number => Math.hypot(p.x - q.x, p.y - q.y)
const at = (c: Call): Point => ({
  x: c.args[0] as number,
  y: c.args[1] as number,
})

describe('the ring marks', () => {
  it('grows a new corner from the middle of the edge it splits out to its bead', () => {
    // Arrange: V's room, G B D, grows F between D and G
    const d = bead(2)
    const f = bead(5)
    const g = bead(7)

    // Act
    const start = grownAt(d, f, g, 0)
    const half = grownAt(d, f, g, 0.5)
    const end = grownAt(d, f, g, 1)

    // Assert
    expect(start.x).toBeCloseTo((d.x + g.x) / 2, 9)
    expect(start.y).toBeCloseTo((d.y + g.y) / 2, 9)
    expect(dist(half, start)).toBeCloseTo(dist(half, f), 9)
    expect(end.x).toBeCloseTo(f.x, 9)
    expect(end.y).toBeCloseTo(f.y, 9)
  })

  it('draws the diagonal dashed from B straight across the centre to F, a halo short of each', () => {
    // Arrange
    const r = recorder()
    const halo = 10

    // Act
    drawDiagonal(r.ctx, RING, 11, 5, halo)

    // Assert
    const from = r.calls.find((c) => c.name === 'moveTo')
    const to = r.calls.find((c) => c.name === 'lineTo')
    if (from === undefined || to === undefined) throw new Error('no line')
    expect(from.dash.length).toBeGreaterThan(0)
    expect(dist(at(from), bead(11))).toBeCloseTo(halo, 6)
    expect(dist(at(to), bead(5))).toBeCloseTo(halo, 6)
    // through the centre: the centre sits on the line between its ends
    const a = at(from)
    const b = at(to)
    const cross =
      (b.x - a.x) * (RING.c.y - a.y) - (b.y - a.y) * (RING.c.x - a.x)
    expect(Math.abs(cross) / dist(a, b)).toBeLessThan(1)
    // the dash ends with the line, so the next stroke is solid
    r.ctx.stroke()
    expect(r.calls[r.calls.length - 1].dash).toEqual([])
  })

  it('draws an arrow outside the ring, from B towards C, its head only once it lands', () => {
    // Arrange
    const going = recorder()
    const landed = recorder()
    const none = recorder()

    // Act
    drawArrow(going.ctx, RING, 11, 12, 0.5)
    drawArrow(landed.ctx, RING, 11, 12, 1)
    drawArrow(none.ctx, RING, 11, 12, 0)

    // Assert: every point outside the ring, the head a filled triangle
    const points = landed.calls.filter(
      (c) => c.name === 'moveTo' || c.name === 'lineTo',
    )
    const shaft = points.slice(0, 9)
    shaft.forEach((c) =>
      expect(dist(at(c), RING.c)).toBeGreaterThan(RING.radius + RING.bead),
    )
    expect(dist(at(shaft[0]), bead(11))).toBeLessThan(
      dist(at(shaft[0]), bead(0)),
    )
    expect(dist(at(shaft[shaft.length - 1]), bead(0))).toBeLessThan(
      dist(at(shaft[shaft.length - 1]), bead(11)),
    )
    expect(landed.calls.filter((c) => c.name === 'fill')).toHaveLength(1)
    expect(going.calls.filter((c) => c.name === 'fill')).toHaveLength(0)
    expect(going.calls.filter((c) => c.name === 'stroke')).toHaveLength(1)
    expect(none.calls).toHaveLength(0)
  })

  it('rings the corner in the bass and writes "bass" inside the ring, on the ring between beads while it moves', () => {
    // Arrange
    const r = recorder()
    const moving = recorder()

    // Act: E in the bass, then on its way from G round to G sharp
    drawBassMark(r.ctx, RING, 4)
    drawBassMark(moving.ctx, RING, 7.5)

    // Assert
    const arc = r.calls.find((c) => c.name === 'arc')
    const word = r.calls.find((c) => c.name === 'fillText')
    if (arc === undefined || word === undefined) throw new Error('no mark')
    expect(arc.args[0]).toBeCloseTo(bead(4).x, 6)
    expect(arc.args[1]).toBeCloseTo(bead(4).y, 6)
    expect(word.args[0]).toBe('bass')
    const w = { x: word.args[1] as number, y: word.args[2] as number }
    expect(dist(w, RING.c)).toBeLessThan(RING.radius)
    expect(dist(w, RING.c)).toBeGreaterThan(RING.radius / 3)
    // on the line from the centre through the bead
    const label = bassLabelAt(RING, 4)
    if (label === undefined) throw new Error('no label')
    expect(label.x).toBeCloseTo(w.x, 9)
    const along =
      ((label.x - RING.c.x) * (bead(4).x - RING.c.x) +
        (label.y - RING.c.y) * (bead(4).y - RING.c.y)) /
      (dist(label, RING.c) * dist(bead(4), RING.c))
    expect(along).toBeCloseTo(1, 6)
    // while it moves it sits on the ring, between the two beads
    const half = moving.calls.find((c) => c.name === 'arc')
    if (half === undefined) throw new Error('no moving mark')
    expect(dist(at(half), RING.c)).toBeCloseTo(RING.radius, 6)
    expect(dist(at(half), bead(7))).toBeCloseTo(dist(at(half), bead(8)), 6)
  })
})
