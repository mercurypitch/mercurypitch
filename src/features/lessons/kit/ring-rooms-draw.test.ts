// ============================================================
// Ring of rooms drawing tests — the ring from the lit turn's beads, a place on it, a room's edges and halos
// ============================================================
//
// The frames are the kit's own spiral seen from above, drawn by
// `drawSpiral` on C4's turn with its black keys lit, and the drawing goes to
// a context that records its calls. The ring is found from the lit turn's
// twelve beads, whatever octave a note sounds in; a place between two beads
// sits on the ring; a room's edges stop at its corners' halos, its fill only
// when lit; a corner two rooms share carries one halo, bright when either
// room is lit; and the centre names the lit room (Lesson 27's WEB-SPEC,
// What the kit and the app still need, item 4).

import { describe, expect, it } from 'vitest'
import './browser-doubles.test-fixtures'
import { RING_BLACK } from './ring-rooms'
import type { Point } from './ring-rooms-draw'
import { drawCentre, drawHalos, drawRoom, onRing, pcOf, ringOf, } from './ring-rooms-draw'
import type { BeadHit } from './spiral-draw'
import { drawSpiral } from './spiral-draw'
import { LO } from './spiral-keys'

interface Call {
  readonly name: string
  readonly args: readonly unknown[]
  readonly style: { fill: string; stroke: string }
}

/** A context that records every call, with the styles set when it was made. */
function recorder(): { ctx: CanvasRenderingContext2D; calls: Call[] } {
  const calls: Call[] = []
  const style = { fillStyle: '', strokeStyle: '' } as Record<string, unknown>
  const ctx = new Proxy(style, {
    get: (t, k) => {
      if (typeof k !== 'string') return undefined
      if (k in t) return t[k]
      if (k === 'createRadialGradient' || k === 'createLinearGradient')
        return () => ({ addColorStop: () => undefined })
      if (k === 'measureText') return () => ({ width: 10 })
      return (...args: unknown[]) =>
        calls.push({
          name: k,
          args,
          style: { fill: String(t.fillStyle), stroke: String(t.strokeStyle) },
        })
    },
    set: (t, k, v: unknown) => {
      t[k as string] = v
      return true
    },
  }) as unknown as CanvasRenderingContext2D
  return { ctx, calls }
}

const W = 420
const H = 360

/** The lit turn's beads, C4 to B4 from above, as the spiral drew them. */
function beadsFromAbove(): BeadHit[] {
  return drawSpiral(recorder().ctx, W, H, 0, {
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
}

const BEADS = beadsFromAbove()
const bead = (pc: number): BeadHit => {
  const b = BEADS.find((h) => h.s === 60 + pcOf(pc) - LO)
  if (b === undefined) throw new Error(`no bead ${pc}`)
  return b
}
const dist = (p: Point, q: Point): number => Math.hypot(p.x - q.x, p.y - q.y)

describe('the ring of rooms', () => {
  it("finds the ring from the lit turn's twelve beads, at 30 degrees a semitone, whatever octave a note is in", () => {
    // Act
    const ring = ringOf(BEADS)

    // Assert
    expect(ring).not.toBeNull()
    if (ring === null) return
    for (let pc = 0; pc < 12; pc++) {
      expect(dist(bead(pc), ring.c)).toBeCloseTo(ring.radius, 6)
      // G3, G4 and G5 are one bead
      expect(ring.beadAt(pc + 48)).toBe(bead(pc))
      expect(ring.beadAt(pc + 72)).toBe(bead(pc))
    }
    const angle = (pc: number): number =>
      Math.atan2(bead(pc).y - ring.c.y, bead(pc).x - ring.c.x)
    // B and F straight across: 180 degrees (Lesson 27 FACTS 31)
    expect(Math.abs(Math.cos(angle(11) - angle(5)))).toBeCloseTo(1, 6)
    expect(Math.cos(angle(1) - angle(0))).toBeCloseTo(Math.cos(Math.PI / 6), 6)
    // under three beads drawn there is no ring yet
    expect(ringOf(BEADS.slice(0, 2))).toBeNull()
  })

  it('puts a place between two beads on the ring, the short way round, and a whole place on its bead', () => {
    // Arrange
    const ring = ringOf(BEADS)
    if (ring === null) throw new Error('no ring')

    // Act
    const half = onRing(ring, 11.5)
    const whole = onRing(ring, 7)

    // Assert: between B and C, on the circle, as far from each
    expect(whole).toBe(bead(7))
    expect(half).toBeDefined()
    if (half === undefined) return
    expect(dist(half, ring.c)).toBeCloseTo(ring.radius, 6)
    expect(dist(half, bead(11))).toBeCloseTo(dist(half, bead(0)), 6)
    expect(dist(half, bead(11))).toBeLessThan(dist(bead(11), bead(0)))
  })

  it("draws a room's edges up to its corners' halos, of any number of corners, and fills it only when lit", () => {
    // Arrange
    const halo = 10
    const corners = [bead(7), bead(11), bead(2), bead(5)]
    const lit = recorder()
    const faint = recorder()

    // Act: V7's room, G, B, D and F, round the ring
    drawRoom(lit.ctx, corners, halo, true)
    drawRoom(faint.ctx, corners, halo, false)

    // Assert: four edges, each a halo short of its two corners
    const ends = lit.calls.filter((c) => c.name === 'lineTo')
    const starts = lit.calls.filter((c) => c.name === 'moveTo')
    expect(lit.calls.filter((c) => c.name === 'fill')).toHaveLength(1)
    expect(faint.calls.filter((c) => c.name === 'fill')).toHaveLength(0)
    const edges = starts.slice(1)
    expect(edges).toHaveLength(4)
    edges.forEach((m, i) => {
      const [x, y] = m.args as number[]
      expect(dist({ x, y }, corners[i])).toBeCloseTo(halo, 6)
    })
    // the fill's path runs round all four corners
    expect(ends.length).toBeGreaterThanOrEqual(4 + 3)
  })

  it('rings a corner two rooms share once, bright when either room is lit', () => {
    // Arrange: I's room and V's share G
    const r = recorder()
    const one = [bead(0), bead(4), bead(7)]
    const five = [bead(7), bead(11), bead(2)]

    // Act
    drawHalos(
      r.ctx,
      [
        { at: one, lit: false },
        { at: five, lit: true },
      ],
      10,
    )

    // Assert
    const arcs = r.calls.filter((c) => c.name === 'arc')
    expect(arcs).toHaveLength(5)
    const atG = r.calls.findIndex(
      (c) =>
        c.name === 'arc' &&
        (c.args[0] as number) === bead(7).x &&
        (c.args[1] as number) === bead(7).y,
    )
    expect(r.calls[atG].style.stroke).toMatch(/0\.85\)$/)
  })

  it("names the lit room in the ring's centre, or in the top-left corner in a compact layout", () => {
    // Arrange
    const ring = ringOf(BEADS)
    if (ring === null) throw new Error('no ring')
    const full = recorder()
    const compact = recorder()

    // Act
    drawCentre(full.ctx, ring, 'V · G major')
    drawCentre(compact.ctx, ring, 'V7', true)

    // Assert
    expect(full.calls.find((c) => c.name === 'fillText')?.args).toEqual([
      'V · G major',
      ring.c.x,
      ring.c.y,
    ])
    expect(compact.calls.find((c) => c.name === 'fillText')?.args).toEqual([
      'V7',
      10,
      14,
    ])
  })
})
