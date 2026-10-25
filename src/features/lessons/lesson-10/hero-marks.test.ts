// ============================================================
// Lesson 10 hero marks tests — the bead slide in time, and nothing gold before the reveal
// ============================================================
//
// WEB-SPEC, Tests 5: the bead slide's place along the ring at each moment
// of a move, from its own bead to the one a semitone below over the glide,
// and home after; at once under reduced motion (FACTS 73). And End to end
// 2's figure clause at unit level: until the reveal no halo is gold and the
// ring shows no chord name (FACTS 1a); after it, so's move draws a dashed
// triangle (FACTS 41b). While the chord sounds the three halos light
// alike, the moving one where its slide has it, so the light follows the
// glide. The frames are the kit's own spiral from above, drawn by
// `drawSpiral`, and the marks go to a context that records them.

import { describe, expect, it } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { COLOR } from '@/features/lessons/kit/notes'
import type { SpiralFrame } from '@/features/lessons/kit/spiral'
import type { BeadHit } from '@/features/lessons/kit/spiral-draw'
import { drawSpiral } from '@/features/lessons/kit/spiral-draw'
import { LO } from '@/features/lessons/kit/spiral-keys'
import type { MarksState } from './hero-marks'
import { drawMarks, SLIDE_END_SEC, slideAt } from './hero-marks'
import type { MoveId } from './sounds'
import { MOVE_IDS } from './sounds'

// -------------------------------------------------------------- a context that records

interface Call {
  readonly name: string
  readonly args: readonly unknown[]
  readonly fill: string
  readonly stroke: string
  readonly dash: readonly number[]
}

interface Recording {
  readonly ctx: CanvasRenderingContext2D
  readonly calls: Call[]
  /** Every colour the marks used: each style set, and each gradient stop. */
  readonly colours: string[]
}

function recorder(): Recording {
  const calls: Call[] = []
  const colours: string[] = []
  const props: Record<string, unknown> = { fillStyle: '', strokeStyle: '' }
  let dash: number[] = []
  const methods: Record<string, unknown> = {
    measureText: (text: string) => ({ width: text.length * 7 }),
    createRadialGradient: () => ({
      addColorStop: (_at: number, colour: string) => colours.push(colour),
    }),
    setLineDash: (d: number[]) => {
      dash = [...d]
    },
  }
  const ctx = new Proxy(props, {
    get: (target, k) => {
      if (typeof k !== 'string') return undefined
      if (k in methods) return methods[k]
      if (k in target) return target[k]
      return (...args: unknown[]) => {
        calls.push({
          name: k,
          args,
          fill: String(target.fillStyle),
          stroke: String(target.strokeStyle),
          dash,
        })
      }
    },
    set: (target, k, v: unknown) => {
      if ((k === 'fillStyle' || k === 'strokeStyle') && typeof v === 'string')
        colours.push(v)
      target[k as string] = v
      return true
    },
  }) as unknown as CanvasRenderingContext2D
  return { ctx, calls, colours }
}

interface Arc {
  readonly x: number
  readonly y: number
  readonly r: number
}

/** A stroke as drawn: its style, dash, and the arcs and line ends in its path. */
interface Stroke {
  readonly style: string
  readonly dash: readonly number[]
  readonly arcs: readonly Arc[]
  readonly ends: readonly { x: number; y: number }[]
}

function strokesOf(calls: readonly Call[]): Stroke[] {
  const out: Stroke[] = []
  let arcs: Arc[] = []
  let ends: { x: number; y: number }[] = []
  for (const c of calls) {
    const [x, y, r] = c.args as number[]
    if (c.name === 'beginPath') {
      arcs = []
      ends = []
    } else if (c.name === 'arc') arcs.push({ x, y, r })
    else if (c.name === 'moveTo' || c.name === 'lineTo') ends.push({ x, y })
    else if (c.name === 'stroke')
      out.push({ style: c.stroke, dash: c.dash, arcs, ends })
  }
  return out
}

const textsOf = (calls: readonly Call[]): string[] =>
  calls.filter((c) => c.name === 'fillText').map((c) => String(c.args[0]))

const isGold = (colour: string): boolean =>
  colour.toLowerCase() === COLOR.gold ||
  colour.replace(/\s/g, '').startsWith('rgba(255,216,77,')

/** The halos: strokes of one circle each. */
const halosOf = (calls: readonly Call[]): Stroke[] =>
  strokesOf(calls).filter((s) => s.arcs.length === 1 && s.ends.length === 0)

/** The triangle: the stroke of line ends. */
const triangleOf = (calls: readonly Call[]): Stroke | undefined =>
  strokesOf(calls).find((s) => s.ends.length > 0)

/** The halos' lights: fills of one circle each in a colour, not the moving bead's gradient. */
function lightsOf(calls: readonly Call[]): { style: string; arc: Arc }[] {
  const out: { style: string; arc: Arc }[] = []
  let arcs: Arc[] = []
  for (const c of calls) {
    const [x, y, r] = c.args as number[]
    if (c.name === 'beginPath') arcs = []
    else if (c.name === 'arc') arcs.push({ x, y, r })
    else if (
      c.name === 'fill' &&
      arcs.length === 1 &&
      !c.fill.startsWith('[object')
    )
      out.push({ style: c.fill, arc: arcs[0] })
  }
  return out
}

// -------------------------------------------------------------- the hero's spiral, from above

const W = 420
const H = 360

/** One frame of the kit's spiral from above, on C4's turn, its black keys lit and named by flats (WEB-SPEC, Toys 2). */
function frameAt(now: number): SpiralFrame {
  const { hits } = drawSpiral(recorder().ctx, W, H, now, {
    yaw: 0,
    u: 0,
    labels: 'letter',
    lit: new Set([61, 63, 66, 68, 70]),
    narrow: false,
    pan: 0,
    focused: false,
    sel: 15,
    pulses: new Map(),
    keyLabels: 'landmarks',
    span: null,
    spelling: 'flats',
    top: 1,
    ringFrom: 60 - LO,
  })
  return { ctx: recorder().ctx, W, H, now, u: 0, beads: hits, keys: [] }
}

const bead = (f: SpiralFrame, midi: number): BeadHit => {
  const b = f.beads.find((h) => h.s === midi - LO)
  if (b === undefined) throw new Error(`no bead for ${midi}`)
  return b
}

function centreOf(f: SpiralFrame): { x: number; y: number } {
  const ring = f.beads.filter((h) => h.s >= 60 - LO && h.s < 72 - LO)
  return {
    x: ring.reduce((n, h) => n + h.x, 0) / ring.length,
    y: ring.reduce((n, h) => n + h.y, 0) / ring.length,
  }
}

const still: MarksState = { revealedAt: null, move: null, reduced: false }

function marks(now: number, state: MarksState): Recording {
  const rec = recorder()
  drawMarks(rec.ctx, frameAt(now), state)
  return rec
}

/** A move begun at 0 ms, drawn `t` seconds in. */
const during = (
  id: MoveId,
  t: number,
  over: Partial<MarksState> = {},
): Recording => marks(t * 1000, { ...still, move: { id, at: 0 }, ...over })

// -------------------------------------------------------------- the tests

describe('slideAt: Tests 5', () => {
  it.each(MOVE_IDS)(
    '%s: stays on its own bead until 1.2 s, reaches the one below by 1.6 s, holds until 3.1 s, and is home by 3.5 s',
    (move) => {
      // Arrange
      const at = [
        0, 1.19, 1.2, 1.3, 1.4, 1.5, 1.6, 2.4, 3.09, 3.2, 3.3, 3.4, 3.5, 5,
      ]
      const want = [0, 0, 0, 0.25, 0.5, 0.75, 1, 1, 1, 0.75, 0.5, 0.25, 0, 0]

      // Act
      const k = at.map((t) => slideAt(t, move, false).k)

      // Assert
      k.forEach((got, i) =>
        expect(got, `at ${at[i]} s`).toBeCloseTo(want[i], 9),
      )
      expect(SLIDE_END_SEC).toBeCloseTo(3.5, 9)
    },
  )

  it('slides mi from E4 to E flat 4 and so from G4 to G flat 4, the place a pitch between them', () => {
    // Arrange
    const t = 1.5

    // Act
    const mi = slideAt(t, 'mi', false)
    const so = slideAt(t, 'so', false)

    // Assert
    expect([mi.from, mi.to, so.from, so.to]).toEqual([64, 63, 67, 66])
    expect(mi.at).toBeCloseTo(63.25, 9)
    expect(so.at).toBeCloseTo(66.25, 9)
  })

  it.each(MOVE_IDS)(
    '%s: under reduced motion, lands at once as the glide begins and is home at once as the sound ends',
    (move) => {
      // Arrange
      const at = [1.19, 1.2, 1.3, 1.4, 1.59, 2.4, 3.09, 3.1, 3.2, 3.3, 3.49]
      const want = [0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0]

      // Act
      const k = at.map((t) => slideAt(t, move, true).k)

      // Assert
      expect(k).toEqual(want)
    },
  )
})

describe('drawMarks: the slide on the ring', () => {
  it('puts the moving halo on the ring, halfway round from E4 to E flat 4, halfway through the glide', () => {
    // Arrange
    const f = frameAt(1400)
    const c = centreOf(f)
    const e = bead(f, 64)
    const eb = bead(f, 63)
    const angle = (p: { x: number; y: number }): number =>
      Math.atan2(p.y - c.y, p.x - c.x)
    const ring = Math.hypot(e.x - c.x, e.y - c.y)

    // Act
    const halos = halosOf(during('mi', 1.4).calls)

    // Assert: one halo off every bead, on the ring, at the bisecting angle
    const off = halos
      .map((h) => h.arcs[0])
      .filter((a) => f.beads.every((b) => Math.hypot(a.x - b.x, a.y - b.y) > 1))
    expect(off).toHaveLength(1)
    expect(Math.hypot(off[0].x - c.x, off[0].y - c.y)).toBeCloseTo(ring, 6)
    expect(angle(off[0])).toBeCloseTo((angle(e) + angle(eb)) / 2, 6)
  })

  it("moves the triangle's corner with the bead", () => {
    // Arrange
    const f = frameAt(1400)
    const halos = halosOf(during('mi', 1.4).calls).map((h) => h.arcs[0])
    const moving = halos.find((a) =>
      f.beads.every((b) => Math.hypot(a.x - b.x, a.y - b.y) > 1),
    )

    // Act
    const triangle = triangleOf(during('mi', 1.4).calls)

    // Assert: two of its edges end a halo's radius from the moving halo's centre
    const near = (triangle?.ends ?? []).filter(
      (p) =>
        moving !== undefined &&
        Math.abs(Math.hypot(p.x - moving.x, p.y - moving.y) - moving.r) < 1e-6,
    )
    expect(near).toHaveLength(2)
  })

  it('lands the halo on the bead below and brings it home on its own bead', () => {
    // Arrange
    const f = frameAt(0)
    const centres = (t: number): string[] =>
      halosOf(during('so', t).calls).map(
        (h) => `${h.arcs[0].x.toFixed(3)},${h.arcs[0].y.toFixed(3)}`,
      )
    const at = (m: number): string =>
      `${bead(f, m).x.toFixed(3)},${bead(f, m).y.toFixed(3)}`

    // Act
    const landed = centres(2)
    const home = centres(SLIDE_END_SEC)

    // Assert
    expect(landed).toEqual([at(60), at(64), at(66)])
    expect(home).toEqual([at(60), at(64), at(67)])
  })
})

describe('drawMarks: while the chord sounds', () => {
  /** The chord sounding from 0 for a move's 3.1 s. */
  const sounding = { from: 0, to: 3100 }

  it('lights the three halos alike while their notes sound, and none once they have ended', () => {
    // Arrange
    const f = frameAt(0)

    // Act
    const on = lightsOf(during('mi', 0.5, { sounding }).calls)
    const after = lightsOf(during('mi', 3.4, { sounding }).calls)
    const never = lightsOf(during('mi', 0.5).calls)

    // Assert: round do, mi and so, one style and size, gone 0.3 s after the sound
    expect(on.map((l) => [l.arc.x, l.arc.y])).toEqual(
      [60, 64, 67].map((m) => [bead(f, m).x, bead(f, m).y]),
    )
    expect(new Set(on.map((l) => `${l.style} ${l.arc.r}`)).size).toBe(1)
    expect(after).toEqual([])
    expect(never).toEqual([])
  })

  it.each([
    ['mi', 64, 63],
    ['so', 67, 66],
  ] as const)(
    "lights %s's halo where its slide has it, so the light follows the glide down a semitone and home",
    (id, from, to) => {
      // Arrange
      const f = frameAt(0)
      const halos = (t: number): Arc[] =>
        halosOf(during(id, t, { sounding }).calls).map((h) => h.arcs[0])
      const lights = (t: number): Arc[] =>
        lightsOf(during(id, t, { sounding }).calls).map((l) => l.arc)
      const at = (m: number): [number, number] => [bead(f, m).x, bead(f, m).y]

      // Act
      const moments = [0.5, 1.4, 2.4, 3.15]

      // Assert: each light round its halo through the move, the moving one
      // on its own bead, on the way, on the bead below, and on its way home
      for (const t of moments) expect(lights(t)).toEqual(halos(t))
      expect(lights(0.5).map((a) => [a.x, a.y])).toContainEqual(at(from))
      expect(lights(2.4).map((a) => [a.x, a.y])).toContainEqual(at(to))
      expect(lights(2.4).map((a) => [a.x, a.y])).not.toContainEqual(at(from))
    },
  )
})

describe('drawMarks: the predict guard', () => {
  it('before the reveal, draws nothing gold and names no chord, at rest and through either move', () => {
    // Arrange
    const moments = [0.5, 1.2, 1.4, 1.6, 2.4, 3.1, 3.3, 4]
    const drawings = [
      marks(0, still),
      ...MOVE_IDS.flatMap((id) => moments.map((t) => during(id, t))),
      ...MOVE_IDS.flatMap((id) =>
        moments.map((t) => during(id, t, { reduced: true })),
      ),
    ]

    // Act
    const colours = drawings.flatMap((d) => d.colours)
    const texts = drawings.flatMap((d) => textsOf(d.calls))

    // Assert
    expect(colours.filter(isGold)).toEqual([])
    expect(new Set(texts)).toEqual(new Set(['do', 'mi', 'so']))
  })

  it('before the reveal, draws do, mi and so alike: three chrome halos of one size, each with its syllable', () => {
    // Arrange
    const rec = marks(0, still)

    // Act
    const halos = halosOf(rec.calls)

    // Assert
    expect(halos).toHaveLength(3)
    expect(new Set(halos.map((h) => `${h.style} ${h.arcs[0].r}`)).size).toBe(1)
    expect(textsOf(rec.calls)).toEqual(['do', 'mi', 'so'])
    expect(triangleOf(rec.calls)?.dash).toEqual([])
  })

  it("draws so's triangle solid chrome before the reveal, even with its bead landed on G flat 4", () => {
    // Arrange
    const t = 2

    // Act
    const triangle = triangleOf(during('so', t).calls)

    // Assert
    expect(triangle?.dash).toEqual([])
    expect(triangle?.style).not.toBe(COLOR.ink2)
  })
})

describe('drawMarks: from the reveal', () => {
  it("turns mi's halo gold, glowing once, and names C major in the ring's centre", () => {
    // Arrange
    const revealed: MarksState = { ...still, revealedAt: 0 }

    // Act
    const rising = marks(60, revealed)
    const after = marks(5000, revealed)

    // Assert
    const golds = (r: Recording): number =>
      halosOf(r.calls).filter((h) => isGold(h.style)).length
    expect(golds(rising)).toBe(2)
    expect(golds(after)).toBe(1)
    expect(textsOf(after.calls)).toContain('C major')
  })

  it("under reduced motion, turns mi's halo gold with no glow", () => {
    // Arrange
    const revealed: MarksState = { ...still, revealedAt: 0, reduced: true }

    // Act
    const rec = marks(60, revealed)

    // Assert
    expect(halosOf(rec.calls).filter((h) => isGold(h.style))).toHaveLength(1)
  })

  it("puts the gold on mi's halo alone: round E4, and round E flat 4 once mi's move lands", () => {
    // Arrange
    const f = frameAt(0)
    const revealed = { revealedAt: 0 }
    const goldAt = (r: Recording): string[] =>
      halosOf(r.calls)
        .filter((h) => isGold(h.style))
        .map((h) => `${h.arcs[0].x.toFixed(3)},${h.arcs[0].y.toFixed(3)}`)
    const at = (m: number): string =>
      `${bead(f, m).x.toFixed(3)},${bead(f, m).y.toFixed(3)}`

    // Act
    const rest = goldAt(marks(5000, { ...still, ...revealed }))
    const miLanded = goldAt(during('mi', 2, revealed))
    const soLanded = goldAt(during('so', 2, revealed))

    // Assert
    expect(rest).toEqual([at(64)])
    expect(miLanded).toEqual([at(63)])
    expect(soLanded).toEqual([at(64)])
  })

  it("names C minor as mi's move lands, and C major until it does", () => {
    // Arrange
    const revealed = { revealedAt: 0 }

    // Act
    const gliding = textsOf(during('mi', 1.4, revealed).calls)
    const landed = textsOf(during('mi', 2, revealed).calls)

    // Assert
    expect(gliding).toContain('C major')
    expect(landed).toContain('C minor')
    expect(landed).not.toContain('C major')
  })

  it('draws so\'s triangle dashed ink-2 with a "?" and names C, E, G flat neither major nor minor as so\'s move lands', () => {
    // Arrange
    const revealed = { revealedAt: 0 }

    // Act
    const rec = during('so', 2, revealed)

    // Assert
    const triangle = triangleOf(rec.calls)
    const texts = textsOf(rec.calls)
    expect(triangle?.style).toBe(COLOR.ink2)
    expect(triangle?.dash.length).toBeGreaterThan(0)
    expect(texts).toContain('?')
    expect(texts.join(' ')).toContain('C, E, G♭: neither major nor minor')
  })

  it("keeps so's triangle solid while its bead is still on its way down", () => {
    // Arrange
    const revealed = { revealedAt: 0 }

    // Act
    const rec = during('so', 1.4, revealed)

    // Assert
    expect(triangleOf(rec.calls)?.dash).toEqual([])
    expect(textsOf(rec.calls)).not.toContain('?')
  })
})

describe('drawMarks: where it draws', () => {
  it('draws only to the context it is given, never the frame’s own', () => {
    // Arrange
    const frameCtx = recorder()
    const given = recorder()
    const f = { ...frameAt(0), ctx: frameCtx.ctx }

    // Act
    drawMarks(given.ctx, f, still)

    // Assert
    expect(frameCtx.calls).toEqual([])
    expect(given.calls.length).toBeGreaterThan(0)
  })

  it("draws nothing until the frame has drawn the ring's beads", () => {
    // Arrange
    const rec = recorder()
    const f = { ...frameAt(0), beads: [] }

    // Act
    drawMarks(rec.ctx, f, still)

    // Assert
    expect(rec.calls).toEqual([])
  })
})
