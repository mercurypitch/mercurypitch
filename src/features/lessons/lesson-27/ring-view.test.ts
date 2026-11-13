// ============================================================
// Lesson 27 ring view tests — what the ring draws each frame, and when it is still
// ============================================================
//
// The WEB-SPEC's Look and Tests 2, on frames of the kit's own spiral seen
// from above, drawn to a context that records its calls: the rooms, one
// lit and filled; a fourth corner growing out in 0.3 s, landed at once when
// still; the diagonal only when asked; the arrows drawing on in 0.4 s; the
// bass mark on its corner, moving round the ring the way the chord's
// corners go; the sounding notes' glow; and the frame loop asked for
// frames while something moves, and for the one after, landed.

import { describe, expect, it } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { RING_BLACK } from '@/features/lessons/kit/ring-rooms'
import { ringOf } from '@/features/lessons/kit/ring-rooms-draw'
import type { SpiralFrame } from '@/features/lessons/kit/spiral'
import type { BeadHit } from '@/features/lessons/kit/spiral-draw'
import { drawSpiral } from '@/features/lessons/kit/spiral-draw'
import { LO } from '@/features/lessons/kit/spiral-keys'
import type { RingView } from './ring-view'
import { drawRingFrame, drawRingView, EMPTY_VIEW, ringMoving, } from './ring-view'
import { CHORDS } from './sounds'

interface Call {
  readonly name: string
  readonly args: readonly unknown[]
}

/** A context that records every call. */
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
      return (...args: unknown[]) => calls.push({ name: k, args })
    },
    set: (t, k, v: unknown) => {
      t[k as string] = v
      return true
    },
  }) as unknown as CanvasRenderingContext2D
  return { ctx, calls }
}

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

/** The view drawn at `now` ms: its calls. */
function draw(view: RingView, now = 1000): Call[] {
  const r = recorder()
  const frame: SpiralFrame = {
    ctx: r.ctx,
    W: 420,
    H: 360,
    now,
    u: 0,
    beads: BEADS,
    keys: [],
  }
  drawRingView(frame, view)
  return r.calls
}

const V7_AND_I: RingView = {
  ...EMPTY_VIEW,
  rooms: [
    { chord: CHORDS.V7, lit: true },
    { chord: CHORDS.I, lit: false },
  ],
  centre: 'V7',
}

describe('the ring view', () => {
  it('draws each room, the lit one filled, with a halo a corner and the centre’s name', () => {
    // Act
    const calls = draw(V7_AND_I)

    // Assert: one fill, for the lit room; six halos, V7's four and I's C
    // and E, G shared
    expect(calls.filter((c) => c.name === 'fill')).toHaveLength(1)
    expect(calls.filter((c) => c.name === 'arc')).toHaveLength(6)
    expect(calls.find((c) => c.name === 'fillText')?.args[0]).toBe('V7')
  })

  it('grows a fourth corner out over 0.3 s, and lands it at once when still', () => {
    // Arrange
    const ring = ringOf(BEADS)
    if (ring === null) throw new Error('no ring')
    const f = ring.beadAt(5)
    if (f === undefined) throw new Error('no F')
    const growing: RingView = {
      ...V7_AND_I,
      growing: { id: 'V7', since: 1000 },
    }
    const fillPath = (calls: Call[]): number[][] => {
      const i = calls.findIndex((c) => c.name === 'fill')
      return calls
        .slice(0, i)
        .filter((c) => c.name === 'lineTo')
        .map((c) => c.args as number[])
    }

    // Act: just started, and landed
    const early = fillPath(draw(growing, 1000))
    const still = fillPath(draw({ ...growing, still: true }, 1000))

    // Assert: the fourth corner short of F's bead until it lands
    const at = (p: number[]): number => Math.hypot(p[0] - f.x, p[1] - f.y)
    expect(at(early[early.length - 1])).toBeGreaterThan(5)
    expect(at(still[still.length - 1])).toBeCloseTo(0, 6)
    expect(ringMoving(growing, 1100)).toBe(true)
    expect(ringMoving(growing, 1400)).toBe(false)
    expect(ringMoving({ ...growing, still: true }, 1100)).toBe(false)
  })

  it('draws the diagonal only when asked, and the arrows as they start', () => {
    // Act
    const plain = draw(V7_AND_I)
    const diagonal = draw({ ...V7_AND_I, diagonal: true })
    const arrows = draw({ ...V7_AND_I, arrows: 600 }, 1000)

    // Assert: the dashed line, and two arrows landed with their heads
    expect(plain.filter((c) => c.name === 'setLineDash')).toHaveLength(0)
    expect(diagonal.filter((c) => c.name === 'setLineDash')).toHaveLength(1)
    const fills = (calls: Call[]): number =>
      calls.filter((c) => c.name === 'fill').length
    expect(fills(arrows) - fills(plain)).toBe(2)
  })

  it('rings the bass’s corner, moving round the ring the way the corners go', () => {
    // Arrange: from F, the third inversion's bass, back to G, the way the
    // corners go
    const ring = ringOf(BEADS)
    if (ring === null) throw new Error('no ring')
    const view: RingView = {
      ...V7_AND_I,
      bass: { at: 7, from: 5, since: 1000 },
    }
    const mark = (calls: Call[]): number[] => {
      const word = calls.findIndex(
        (c) => c.name === 'fillText' && c.args[0] === 'bass',
      )
      const arcs = calls.slice(0, word).filter((c) => c.name === 'arc')
      return arcs[arcs.length - 1].args as number[]
    }

    // Act: on its way, and landed
    const early = mark(draw(view, 1050))
    const landed = mark(draw(view, 1400))

    // Assert
    const g = ring.beadAt(7)
    const fs = ring.beadAt(6)
    if (g === undefined || fs === undefined) throw new Error('no beads')
    expect(Math.hypot(landed[0] - g.x, landed[1] - g.y)).toBeCloseTo(0, 6)
    // on its way round from F to G it passes F sharp, not across the ring
    expect(Math.hypot(early[0] - fs.x, early[1] - fs.y)).toBeLessThan(
      Math.hypot(early[0] - g.x, early[1] - g.y),
    )
  })

  it('asks for the frame after the last that moved, which draws the arrows landed, heads and all', () => {
    // Arrange: the arrows started at 600 ms and land 0.4 s later
    const v: RingView = { ...V7_AND_I, arrows: 600 }
    const frameAt = (now: number): { again: boolean; fills: number } => {
      const r = recorder()
      const again = drawRingFrame(
        { ctx: r.ctx, W: 420, H: 360, now, u: 0, beads: BEADS, keys: [] },
        v,
      )
      return {
        again,
        fills: r.calls.filter((c) => c.name === 'fill').length,
      }
    }

    // Act: a frame just short of landing, and the next
    const short = frameAt(990)
    const landed = frameAt(1006)

    // Assert: the short frame asks again, though a frame's start may come
    // after the landing; the landed one draws both heads and asks for none
    expect(short.again).toBe(true)
    expect(landed.again).toBe(false)
    expect(landed.fills - short.fills).toBe(2)
  })

  it('draws nothing until the ring has drawn, or while it is unrolled', () => {
    // Arrange
    const r = recorder()

    // Act
    drawRingView(
      { ctx: r.ctx, W: 420, H: 360, now: 0, u: 1, beads: BEADS, keys: [] },
      V7_AND_I,
    )

    // Assert
    expect(r.calls).toHaveLength(0)
  })
})
