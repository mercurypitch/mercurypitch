// ============================================================
// Lesson 12 ring marks tests — the syllables beside the beads, the roots' line and pulse
// ============================================================
//
// On a frame of the kit's own spiral seen from above, C4's turn lit (as
// rooms-draw.test.ts draws it), the marks go to a context that records the
// calls they make. Under Do-re-mi each of the key's seven notes carries its
// syllable just past its bead's halo, away from the ring's centre, and C's
// sits under the kit's "C4" (WEB-SPEC, Toys 1, Slide); in G do is on G and
// ti on F♯ (Edge cases). Play the roots' line joins each root to the one
// before in chrome, full while the play runs and faint once it ends, and
// the sounding root's bead glows in ink (Toys 1, Loop). Nothing is drawn
// once the spiral unrolls, and nothing asks for frames once no root sounds.

import { describe, expect, it } from 'vitest'
import type { SpiralFrame } from '@/features/lessons/kit/spiral'
import type { BeadHit } from '@/features/lessons/kit/spiral-draw'
import { drawSpiral } from '@/features/lessons/kit/spiral-draw'
import { LO } from '@/features/lessons/kit/spiral-keys'
import type { RingMarks } from './rooms-marks'
import { drawMarks, marksAnimating, syllablesOf } from './rooms-marks'

interface Pt {
  readonly x: number
  readonly y: number
}
interface Recording {
  readonly ctx: CanvasRenderingContext2D
  readonly texts: { text: string; at: Pt }[]
  /** Each stroke's style and the line ends in it. */
  readonly strokes: { style: string; ends: Pt[] }[]
  /** Each glow's centre and its stops. */
  readonly glows: { at: Pt; stops: string[] }[]
}

/** A context that records the marks' calls, and nothing else. */
function recorder(): Recording {
  const texts: Recording['texts'] = []
  const strokes: Recording['strokes'] = []
  const glows: Recording['glows'] = []
  const style: Record<string, unknown> = { strokeStyle: '' }
  let ends: Pt[] = []
  const methods: Record<string, (...a: never[]) => unknown> = {
    beginPath: () => {
      ends = []
    },
    moveTo: (x: number, y: number) => ends.push({ x, y }),
    lineTo: (x: number, y: number) => ends.push({ x, y }),
    stroke: () => strokes.push({ style: String(style.strokeStyle), ends }),
    fillText: (text: string, x: number, y: number) =>
      texts.push({ text, at: { x, y } }),
    createRadialGradient: (...a: number[]) => {
      const g = { at: { x: a[0], y: a[1] }, stops: [] as string[] }
      glows.push(g)
      return { addColorStop: (_at: number, c: string) => g.stops.push(c) }
    },
  }
  const ctx = new Proxy(style, {
    get: (t, k) => {
      if (typeof k !== 'string') return undefined
      if (k in methods) return methods[k]
      return k in t ? t[k] : (): undefined => undefined
    },
    set: (t, k, v: unknown) => {
      t[k as string] = v
      return true
    },
  }) as unknown as CanvasRenderingContext2D
  return { ctx, texts, strokes, glows }
}

const W = 420
const H = 360

/** The ring from above, C4's turn lit and its black keys named, as the stage draws it; `u` unrolls it. */
function frameAt(now: number, u = 0): SpiralFrame {
  const { hits } = drawSpiral(recorder().ctx, W, H, 0, {
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
    spelling: 'sharps',
    top: 1,
    ringFrom: 60 - LO,
  })
  return { ctx: recorder().ctx, W, H, now, u, beads: hits, keys: [] }
}

const FRAME = frameAt(0)

/** The lit turn's bead for a pitch class, C = 0. */
function bead(pc: number): BeadHit {
  const b = FRAME.beads.find((h) => h.s === 60 + pc - LO)
  if (b === undefined) throw new Error(`no bead for ${pc}`)
  return b
}
const CENTRE: Pt = {
  x: [...Array(12).keys()].reduce((n, pc) => n + bead(pc).x, 0) / 12,
  y: [...Array(12).keys()].reduce((n, pc) => n + bead(pc).y, 0) / 12,
}
const dist = (p: Pt, q: Pt): number => Math.hypot(p.x - q.x, p.y - q.y)

const none: RingMarks = {
  syllables: [],
  roots: [],
  rootsPlaying: false,
  reduced: false,
}

function draw(marks: Partial<RingMarks>, f = FRAME): Recording {
  const rec = recorder()
  drawMarks(rec.ctx, f, { ...none, ...marks })
  return rec
}

describe('drawMarks: the syllables under Do-re-mi', () => {
  it("puts each of C major's seven syllables just past its bead's halo, away from the centre", () => {
    // Arrange, Act
    const rec = draw({ syllables: syllablesOf('C') })

    // Assert: every one but C's, which goes under the kit's "C4"
    expect(rec.texts.map((t) => t.text)).toEqual([
      'do',
      're',
      'mi',
      'fa',
      'so',
      'la',
      'ti',
    ])
    const pcs = [0, 2, 4, 5, 7, 9, 11]
    rec.texts.slice(1).forEach((t, i) => {
      const b = bead(pcs[i + 1])
      expect(dist(t.at, b)).toBeCloseTo(b.r * 1.6 + 4, 6)
      expect(dist(t.at, CENTRE)).toBeGreaterThan(dist(b, CENTRE))
    })
  })

  it("puts do under C's own name, right of its bead and below it", () => {
    // Arrange
    const c = bead(0)

    // Act
    const rec = draw({ syllables: syllablesOf('C') })

    // Assert: right of the bead, as "C4" is, and a line lower than it
    expect(rec.texts[0].at.x).toBeGreaterThan(c.x + c.r)
    expect(rec.texts[0].at.y).toBeGreaterThanOrEqual(c.y + 6)
  })

  it('puts do beside G and ti beside F♯ in G major', () => {
    // Arrange, Act
    const rec = draw({ syllables: syllablesOf('G') })
    const nearest = (text: string): number => {
      const at = rec.texts.find((t) => t.text === text)?.at
      if (at === undefined) throw new Error(`no ${text}`)
      return [...Array(12).keys()].reduce((best, pc) =>
        dist(at, bead(pc)) < dist(at, bead(best)) ? pc : best,
      )
    }

    // Assert: WEB-SPEC, Edge cases, G major under Do-re-mi
    expect(nearest('do')).toBe(7)
    expect(nearest('ti')).toBe(6)
    expect(nearest('fa')).toBe(0)
  })

  it('draws no syllable under Letters, or once the spiral unrolls', () => {
    // Arrange, Act
    const letters = draw({})
    const unrolled = draw({ syllables: syllablesOf('C') }, frameAt(0, 0.5))

    // Assert
    expect(letters.texts).toEqual([])
    expect(unrolled.texts).toEqual([])
  })
})

describe("drawMarks: Play the roots' line", () => {
  const ROOTS = [60, 55, 57, 53].map((midi, i) => ({
    midi,
    from: i * 2000,
    to: (i + 1) * 2000,
  }))

  it('joins each root to the one before in chrome, full while the play runs and faint once it ends', () => {
    // Arrange, Act
    const playing = draw({ roots: ROOTS.slice(0, 3), rootsPlaying: true })
    const ended = draw({ roots: ROOTS, rootsPlaying: false })

    // Assert: two stretches, then three, each along its two beads
    expect(playing.strokes).toHaveLength(1)
    expect(playing.strokes[0].style).toMatch(/^rgba\(195,204,214,0\.8\)$/)
    expect(playing.strokes[0].ends).toHaveLength(4)
    expect(ended.strokes[0].style).toMatch(/^rgba\(195,204,214,0\.3\)$/)
    expect(ended.strokes[0].ends).toHaveLength(6)
    const [a, b] = ended.strokes[0].ends
    const [c4, g] = [bead(0), bead(7)]
    expect(dist(a, c4) + dist(a, g)).toBeCloseTo(dist(c4, g), 6)
    expect(dist(b, c4) + dist(b, g)).toBeCloseTo(dist(c4, g), 6)
  })

  it('glows in ink on the sounding root alone, and nowhere once none sounds', () => {
    // Arrange, Act
    const during = draw(
      { roots: ROOTS.slice(0, 2), rootsPlaying: true },
      frameAt(3000),
    )
    const after = draw({ roots: ROOTS, rootsPlaying: false }, frameAt(9000))

    // Assert: G3's bead, on G's place on the ring
    expect(during.glows).toHaveLength(1)
    expect(during.glows[0].at).toEqual({ x: bead(7).x, y: bead(7).y })
    expect(during.glows[0].stops[0]).toMatch(/^rgba\(/)
    expect(after.glows).toEqual([])
  })
})

describe('marksAnimating', () => {
  it('asks for frames only while a root sounds', () => {
    // Arrange
    const marks: RingMarks = {
      ...none,
      roots: [{ midi: 60, from: 0, to: 2000 }],
      rootsPlaying: true,
    }

    // Act, Assert
    expect(marksAnimating(marks, 1999)).toBe(true)
    expect(marksAnimating(marks, 2000)).toBe(false)
    expect(marksAnimating(none, 0)).toBe(false)
  })
})
