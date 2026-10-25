// ============================================================
// Lesson 12 rooms tests — each room at its beads, the turn and the slide round the ring, the walk's gold
// ============================================================
//
// The frames are the kit's own spiral seen from above, drawn by
// `drawSpiral` on C4's turn with its black keys lit and named in sharps
// (WEB-SPEC, Toys 1 and 2), and the rooms go to a context that records
// every call. A room's corners sit at its notes' beads (FACTS 22); the key
// switch turns them 210 degrees round the ring in 0.6 s, and Play I, then vi
// slides G to A in the 0.3 s between (Toys 1; FACTS 21, 69); the walk puts
// gold only on a sounding note that is a corner of its chord, and the count
// ends on FACTS 35 and 36's (Toys 5); nothing is gold without a tune
// playing, so the hero cannot answer the predict (FACTS 1a; End to end 2's
// figure clause); under reduced motion everything lands at once (End to end
// 13); and at rest the painter reports nothing moving.
//
// Over TESTING.md's 600 lines: the rooms, the turn, the slide and the walk
// are one painter on one frame, and share the recorder and the ring's
// geometry above; split, each part would copy them.

import { describe, expect, it } from 'vitest'
import type { SpiralFrame } from '@/features/lessons/kit/spiral'
import type { BeadHit } from '@/features/lessons/kit/spiral-draw'
import { drawSpiral } from '@/features/lessons/kit/spiral-draw'
import { LO } from '@/features/lessons/kit/spiral-keys'
import type { KeyName, TuneId } from './music'
import { chordsOf, KEYS, LOOP_DEGREES, TUNE_IDS, tuneOf } from './music'
import type { Ease, RoomsState, WalkPlay } from './rooms-draw'
import { drawRooms, roomsAnimating, WALK_FADE_SEC } from './rooms-draw'

// -------------------------------------------------------------- a context that records

interface Pt {
  readonly x: number
  readonly y: number
}
/** A path as stroked or filled: its style, and the arcs and line ends in it. */
interface Path {
  readonly style: string
  readonly arcs: readonly Pt[]
  readonly ends: readonly Pt[]
}
interface Recording {
  readonly ctx: CanvasRenderingContext2D
  readonly strokes: Path[]
  readonly fills: Path[]
  readonly gradients: { at: Pt; stops: string[] }[]
  readonly texts: { text: string; at: Pt }[]
  /** Every colour used: each style set, and each gradient stop. */
  readonly colours: string[]
}

function recorder(): Recording {
  const strokes: Path[] = []
  const fills: Path[] = []
  const gradients: { at: Pt; stops: string[] }[] = []
  const texts: { text: string; at: Pt }[] = []
  const colours: string[] = []
  const style: Record<string, unknown> = { fillStyle: '', strokeStyle: '' }
  let arcs: Pt[] = []
  let ends: Pt[] = []
  const path = (s: unknown): Path => ({ style: String(s), arcs, ends })
  const methods: Record<string, (...a: never[]) => unknown> = {
    beginPath: () => {
      arcs = []
      ends = []
    },
    arc: (x: number, y: number) => arcs.push({ x, y }),
    moveTo: (x: number, y: number) => ends.push({ x, y }),
    lineTo: (x: number, y: number) => ends.push({ x, y }),
    stroke: () => strokes.push(path(style.strokeStyle)),
    fill: () => fills.push(path(style.fillStyle)),
    fillText: (text: string, x: number, y: number) =>
      texts.push({ text, at: { x, y } }),
    createRadialGradient: (...a: number[]) => {
      const g = { at: { x: a[3], y: a[4] }, stops: [] as string[] }
      gradients.push(g)
      return {
        addColorStop: (_at: number, c: string) => {
          g.stops.push(c)
          colours.push(c)
        },
      }
    },
  }
  const ctx = new Proxy(style, {
    get: (t, k) => {
      if (typeof k !== 'string') return undefined
      if (k in methods) return methods[k]
      return k in t ? t[k] : (): undefined => undefined
    },
    set: (t, k, v: unknown) => {
      if (typeof v === 'string' && /Style$/.test(String(k))) colours.push(v)
      t[k as string] = v
      return true
    },
  }) as unknown as CanvasRenderingContext2D
  return { strokes, fills, gradients, texts, colours, ctx }
}

const GOLD = /^(#ffd84d|rgba\(255,216,77,)/i
const BLUE = /^rgba\(88,166,255,/
const CHROME = /^rgba\(195,204,214,/

const key = (p: Pt): string => `${p.x.toFixed(3)},${p.y.toFixed(3)}`
const dist = (p: Pt, q: Pt): number => Math.hypot(p.x - q.x, p.y - q.y)

/** Where the gold went: each gold ring's centre and each glow with a gold stop. */
function goldAt(r: Recording): string[] {
  const rings = r.strokes.filter((s) => GOLD.test(s.style))
  const glows = r.gradients.filter((g) => g.stops.some((c) => GOLD.test(c)))
  const at = [...rings.flatMap((s) => s.arcs), ...glows.map((g) => g.at)]
  return [...new Set(at.map(key))]
}
const halosOf = (r: Recording): string[] =>
  r.strokes
    .filter((s) => CHROME.test(s.style) && s.arcs.length === 1)
    .map((s) => key(s.arcs[0]))
    .sort()
const lineOf = (r: Recording): Path | undefined =>
  r.strokes.find((s) => BLUE.test(s.style))
const textsOf = (r: Recording): string[] => r.texts.map((t) => t.text)
/** The lit room's corners, root first: the points of its fill. */
const litCorners = (r: Recording): readonly Pt[] =>
  r.fills.find((f) => CHROME.test(f.style))?.ends ?? []
const litAt = (r: Recording): string[] => litCorners(r).map(key)

// -------------------------------------------------------------- the ring, from above

const W = 420
const H = 360

function spiralFrame(o: { yaw?: number; top?: number } = {}): SpiralFrame {
  const { hits } = drawSpiral(recorder().ctx, W, H, 0, {
    yaw: o.yaw ?? 0,
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
    top: o.top ?? 1,
    ringFrom: 60 - LO,
  })
  return { ctx: recorder().ctx, W, H, now: 0, u: 0, beads: hits, keys: [] }
}

const FRAME = spiralFrame()

/** The lit turn's bead for a pitch class, C = 0, in any octave. */
function bead(pc: number, f = FRAME): BeadHit {
  const b = f.beads.find((h) => h.s === 60 + (((pc % 12) + 12) % 12) - LO)
  if (b === undefined) throw new Error(`no bead for ${pc}`)
  return b
}
const beads = (...pcs: number[]): string[] => pcs.map((p) => key(bead(p)))
const pcsOf = (k: KeyName, d: number): number[] =>
  chordsOf(k)[d].midis.map((m) => m % 12)

const C: Pt = {
  x: [...Array(12).keys()].reduce((n, pc) => n + bead(pc).x, 0) / 12,
  y: [...Array(12).keys()].reduce((n, pc) => n + bead(pc).y, 0) / 12,
}
const RADIUS = dist(bead(0), C)
const angle = (p: Pt): number => Math.atan2(p.y - C.y, p.x - C.x)
/** The short way from angle a to b. */
const turnBy = (a: number, b: number): number =>
  ((((b - a) % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI)) - Math.PI
/** The angle of the place `f` of the way round from the bead of `pc` to the next. */
const between = (pc: number, f: number): number =>
  angle(bead(pc)) + f * turnBy(angle(bead(pc)), angle(bead(pc + 1)))
/** True when `p` sits on the ring at the place `f` of the way from `pc` to the next bead. */
const onRingAt = (p: Pt, pc: number, f: number): boolean =>
  Math.abs(dist(p, C) - RADIUS) < 1e-6 &&
  Math.abs(turnBy(between(pc, f), angle(p))) < 1e-6

const linear: Ease = (t) => t
const still: RoomsState = {
  key: 'C',
  turn: null,
  rooms: [],
  lit: null,
  label: 'none',
  compact: false,
  slide: null,
  walk: null,
  reduced: false,
}
const walking = (id: TuneId, o: Partial<WalkPlay> = {}): WalkPlay => ({
  id,
  key: 'C',
  at: 0,
  by: 1,
  stoppedAt: null,
  ...o,
})
const LOOP = [...LOOP_DEGREES]

function draw(
  now: number,
  over: Partial<RoomsState>,
  o: { f?: SpiralFrame; ease?: Ease } = {},
): Recording {
  const rec = recorder()
  const frame = { ...(o.f ?? FRAME), now }
  drawRooms(rec.ctx, frame, { ...still, ...over }, o.ease ?? linear)
  return rec
}

// -------------------------------------------------------------- the rooms

describe('drawRooms: each room at its beads', () => {
  const rooms = KEYS.flatMap((k) =>
    [0, 1, 2, 3, 4, 5, 6].map((d) => [k, d] as const),
  )

  it.each(rooms)(
    'in %s, puts the room on degree %d at its notes’ beads, a halo round each',
    (k, d) => {
      // Arrange
      const want = beads(...pcsOf(k, d))

      // Act
      const rec = draw(0, { key: k, rooms: [d], lit: d })

      // Assert
      expect(litAt(rec)).toEqual(want)
      expect(halosOf(rec)).toEqual([...want].sort())
    },
  )

  it("draws C major's seven rooms faint, their halos on the seven scale beads and no black key", () => {
    // Act
    const rec = draw(0, { rooms: [0, 1, 2, 3, 4, 5, 6] })

    // Assert
    expect(halosOf(rec)).toEqual(beads(0, 2, 4, 5, 7, 9, 11).sort())
    expect(rec.fills).toEqual([])
  })

  it('follows the beads wherever a drag has turned the ring', () => {
    // Arrange
    const f = spiralFrame({ yaw: 1.1 })

    // Act
    const rec = draw(0, { rooms: [5], lit: 5 }, { f })

    // Assert
    expect(litAt(rec)).toEqual([9, 0, 4].map((pc) => key(bead(pc, f))))
  })

  it("picks the lit turn's bead while the camera is still on its way to the top", () => {
    // Arrange
    const f = spiralFrame({ top: 0.5 })
    const lowC = f.beads.find((h) => h.s === 48 - LO)

    // Act
    const rec = draw(0, { rooms: [0], lit: 0 }, { f })

    // Assert
    expect(lowC).toBeDefined()
    expect(litAt(rec)).toEqual([0, 4, 7].map((pc) => key(bead(pc, f))))
  })

  it('draws every room in chrome, the lit one with a brighter line and the only fill', () => {
    // Act
    const rec = draw(0, { rooms: LOOP, lit: 4 })

    // Assert
    const edges = rec.strokes.filter((s) => s.ends.length > 0)
    const alpha = (s: Path): string => /,([\d.]+)\)$/.exec(s.style)?.[1] ?? ''
    expect(rec.colours.filter((c) => !CHROME.test(c))).toEqual([])
    expect(rec.fills).toHaveLength(1)
    expect(litAt(rec)).toEqual(beads(7, 11, 2))
    expect(edges.map(alpha).sort()).toEqual(['0.35', '0.35', '0.35', '0.9'])
  })

  it.each([
    ['name', 'C', 0, 'C major'],
    ['numeral', 'C', 5, 'vi · A minor'],
    ['numeral', 'G', 6, 'vii° · F♯ diminished'],
  ] as const)(
    'labels the lit room in the centre, under %s in %s: degree %d is %s',
    (label, k, d, want) => {
      // Act
      const rec = draw(0, { key: k, rooms: [d], lit: d, label })

      // Assert
      expect(textsOf(rec)).toEqual([want])
      expect(dist(rec.texts[0].at, C)).toBeCloseTo(0, 6)
    },
  )

  it("names nothing on the hero's ring, and puts the label top left in the compact layout", () => {
    // Act
    const hero = draw(0, { rooms: LOOP, lit: 0 })
    const compact = draw(0, {
      rooms: [0],
      lit: 0,
      label: 'name',
      compact: true,
    })

    // Assert
    expect(hero.texts).toEqual([])
    expect(compact.texts).toEqual([{ text: 'C major', at: { x: 10, y: 14 } }])
  })
})

// -------------------------------------------------------------- the key switch

describe("drawRooms: the key switch's turn", () => {
  const toG: Partial<RoomsState> = {
    key: 'G',
    rooms: [0],
    lit: 0,
    turn: { from: 'C', at: 0 },
  }
  const rootAt = (t: number, over: Partial<RoomsState> = {}, ease = linear) =>
    litCorners(draw(t, { ...toG, ...over }, { ease }))[0]

  it('turns every corner 210 degrees round the ring in 0.6 s, onto G major’s beads', () => {
    // Arrange
    const times = Array.from({ length: 61 }, (_, i) => i * 10)

    // Act
    const roots = times.map((t) => rootAt(t))

    // Assert
    const steps = roots
      .slice(1)
      .map((p, i) => turnBy(angle(roots[i]), angle(p)))
    const swept = steps.reduce((n, a) => n + a, 0)
    const way = turnBy(angle(bead(0)), angle(bead(1)))
    expect(Math.abs(swept)).toBeCloseTo((210 * Math.PI) / 180, 6)
    expect(Math.sign(swept)).toBe(Math.sign(way))
    expect(litAt(draw(600, toG))).toEqual(beads(7, 11, 2))
  })

  it('keeps each corner on the ring between beads mid-turn, never on the line joining them', () => {
    // Act
    const corners = litCorners(draw(300, toG))

    // Assert: three and a half semitones on from C, E and G
    const placed = corners.map((p, i) => onRingAt(p, [3, 7, 10][i], 0.5))
    expect(placed).toEqual([true, true, true])
  })

  it('turns them back seven semitones the other way when C is chosen again', () => {
    // Act
    const root = rootAt(150, { key: 'C', turn: { from: 'G', at: 0 } })

    // Assert: a quarter of the way back from G, at 5.25 semitones
    expect(onRingAt(root, 5, 0.25)).toBe(true)
  })

  it('turns nothing when the key already showing is chosen again', () => {
    // Act
    const rec = draw(300, { ...toG, key: 'C', turn: { from: 'C', at: 0 } })

    // Assert
    expect(litAt(rec)).toEqual(beads(0, 4, 7))
  })

  it('moves the corners on the easing it is given', () => {
    // Act
    const root = rootAt(300, {}, (t) => t * t)

    // Assert: half the time, a quarter of the way: 1.75 semitones on from C
    expect(onRingAt(root, 1, 0.75)).toBe(true)
  })

  it('is still turning at 0.55 s and has landed at 0.6 s', () => {
    // Act
    const late = rootAt(550)
    const landed = rootAt(600)

    // Assert
    expect(dist(late, bead(7))).toBeGreaterThan(10)
    expect(key(landed)).toBe(key(bead(7)))
  })
})

// -------------------------------------------------------------- the corner slide

describe('drawRooms: the corner slide', () => {
  const play = (k: KeyName, by = 1): Partial<RoomsState> => ({
    key: k,
    slide: { at: 0, by },
    label: 'numeral',
  })

  it('slides the corner on G round to A in the 0.3 s between I and vi, C and E holding', () => {
    // Act
    const before = litCorners(draw(1400, play('C')))
    const quarter = litCorners(draw(1475, play('C')))
    const half = litCorners(draw(1550, play('C')))

    // Assert
    expect(before.map(key)).toEqual(beads(0, 4, 7))
    expect(quarter.slice(0, 2).map(key)).toEqual(beads(0, 4))
    expect(onRingAt(quarter[2], 7, 0.5)).toBe(true)
    expect(key(half[2])).toBe(key(bead(8)))
  })

  it('lands vi’s room, A, C and E, at 1.7 s, the label turning from I to vi as it lands', () => {
    // Act
    const sliding = draw(1690, play('C'))
    const landed = draw(1700, play('C'))

    // Assert
    expect(textsOf(sliding)).toEqual(['I · C major'])
    expect(textsOf(landed)).toEqual(['vi · A minor'])
    expect(litAt(landed)).toEqual(beads(9, 0, 4))
  })

  it('slides D to E in G (FACTS 69a)', () => {
    // Act
    const rec = draw(1550, play('G'))

    // Assert
    expect(litAt(rec)).toEqual(beads(7, 11, 3))
  })

  it('takes the 0.6 s between the chords under Slow', () => {
    // Act
    const half = litCorners(draw(3100, play('C', 2)))

    // Assert
    expect(key(half[2])).toBe(key(bead(8)))
  })
})

// -------------------------------------------------------------- the walk

/** FACTS 35 and 36: the notes that fall between corners. */
const BETWEEN: Readonly<Record<TuneId, readonly number[]>> = {
  'tune-1': [1, 5, 9, 13],
  'tune-2': [3, 10],
  even: [3, 10],
}
const TUNE_1 = { walk: walking('tune-1') }

describe('drawRooms: the walk', () => {
  const tunes = TUNE_IDS.flatMap((id) => KEYS.map((k) => [id, k] as const))

  it.each(tunes)(
    '%s in %s: puts gold on each sounding corner note’s own bead, none on a note between',
    (id, k) => {
      // Arrange
      const notes = tuneOf(id, k)
      const s = { key: k, walk: walking(id, { key: k }) }

      // Act
      const golds = notes.map((n) => goldAt(draw((n.t + n.dur / 2) * 1e3, s)))

      // Assert
      const want = notes.map((n, i) =>
        BETWEEN[id].includes(i) ? [] : [key(bead(n.midi))],
      )
      expect(golds).toEqual(want)
    },
  )

  it('pulses a note between corners in ink on its own bead', () => {
    // Act
    const rec = draw(750, TUNE_1)

    // Assert: D5, over I
    expect(rec.gradients.map((g) => key(g.at))).toEqual(beads(2))
    expect(rec.gradients[0].stops[0]).toMatch(/^rgba\(230,237,243,/)
  })

  it.each([
    ['tune-1', 1, 2250, 'On a corner: 4 of 5'],
    ['tune-1', 1, 8500, 'On a corner: 11 of 15'],
    ['tune-2', 1, 8500, 'On a corner: 10 of 12'],
    ['even', 1, 8500, 'On a corner: 10 of 12'],
    ['tune-1', 2, 4500, 'On a corner: 4 of 5'],
    ['tune-1', 2, 8500, 'On a corner: 7 of 9'],
  ] as const)(
    'counts %s’s notes on a corner, under the ring, at %dx their lengths: at %d ms, %s',
    (id, by, t, want) => {
      // Act
      const rec = draw(t, { walk: walking(id, { by }) })

      // Assert
      expect(textsOf(rec)).toEqual([want])
      expect(rec.texts[0].at.y).toBeGreaterThan(C.y + RADIUS)
    },
  )

  it.each([
    [1, 1650],
    [2, 3300],
  ] as const)(
    'runs a blue line bead to bead, at %dx the lengths the newest stretch halfway on at %d ms',
    (by, t) => {
      // Arrange: tune 1's third and fourth notes, C5 and E5, 0.5 s apart
      const mid = {
        x: (bead(0).x + bead(4).x) / 2,
        y: (bead(0).y + bead(4).y) / 2,
      }

      // Act
      const line = lineOf(draw(t, { walk: walking('tune-1', { by }) }))

      // Assert
      expect(line?.ends).toHaveLength(6)
      expect(key(line?.ends.at(-1) ?? C)).toBe(key(mid))
    },
  )

  it('lands each stretch on its note’s bead 0.3 s after the note starts, and never runs ahead of the voice', () => {
    // Arrange: tune 1's notes are crotchets, 0.5 s apart
    const notes = tuneOf('tune-1', 'C')
    const tip = (t: number): Pt => lineOf(draw(t, TUNE_1))?.ends.at(-1) ?? C

    // Act
    const landed = notes.slice(1).map((n) => tip(n.t * 1e3 + 300))
    const waiting = notes.slice(2).map((n) => tip(n.t * 1e3 - 0.01))

    // Assert: on the bead's edge, its radius and 2 px from its centre; just
    // before a note starts, the line still ends at the note before it
    const edge = bead(0).r + 2
    landed.forEach((p, i) =>
      expect(dist(p, bead(notes[i + 1].midi))).toBeCloseTo(edge, 1),
    )
    waiting.forEach((p, i) =>
      expect(dist(p, bead(notes[i + 1].midi))).toBeCloseTo(edge, 1),
    )
  })

  it('lands the stretch into a short note as the next note starts: tune 2’s C5, 0.25 s long', () => {
    // Act: tune 2 is G4 for 0.75 s, C5 for 0.25 s, then E5
    const p = lineOf(draw(999.99, { walk: walking('tune-2') }))?.ends.at(-1)

    // Assert
    expect(dist(p ?? C, bead(0))).toBeCloseTo(bead(0).r + 2, 1)
  })

  it('lights the room of the chord under the tune: vi in the third bar', () => {
    // Act
    const rec = draw(5000, { rooms: LOOP, ...TUNE_1 })

    // Assert
    expect(litAt(rec)).toEqual(beads(9, 0, 4))
  })

  it('keeps the line, faded to faint, and the count once the tune ends, with no gold and no room lit', () => {
    // Act
    const rec = draw(8000 + WALK_FADE_SEC * 1e3, { rooms: LOOP, ...TUNE_1 })

    // Assert
    expect(lineOf(rec)?.style).toBe('rgba(88,166,255,0.3)')
    expect(lineOf(rec)?.ends).toHaveLength(28)
    expect(textsOf(rec)).toEqual(['On a corner: 11 of 15'])
    expect([goldAt(rec), rec.fills]).toEqual([[], []])
  })

  it('keeps a stopped walk and its count where they reached, with no line growing on', () => {
    // Act
    const rec = draw(2100, { walk: walking('tune-1', { stoppedAt: 2100 }) })

    // Assert
    expect(textsOf(rec)).toEqual(['On a corner: 4 of 5'])
    expect(lineOf(rec)?.ends).toHaveLength(8)
    expect(goldAt(rec)).toEqual([])
  })
})

// -------------------------------------------------------------- nothing gold before a choice

describe('drawRooms: the predict guard', () => {
  it('draws nothing gold, no walk and no count in any state without a tune playing', () => {
    // Arrange
    const all = [0, 1, 2, 3, 4, 5, 6]
    const states: [number, Partial<RoomsState>][] = [
      [0, { rooms: [0, 1, 2], lit: 2, label: 'name' }],
      [300, { key: 'G', rooms: all, lit: 4, turn: { from: 'C', at: 0 } }],
      [1550, { slide: { at: 0, by: 1 }, label: 'numeral' }],
      ...LOOP.map((d, bar): [number, Partial<RoomsState>] => [
        bar * 2000,
        { rooms: LOOP, lit: d },
      ]),
      [0, { rooms: LOOP, reduced: true, turn: { from: 'G', at: 0 } }],
    ]

    // Act
    const drawn = states.map(([t, s]) => draw(t, s))

    // Assert
    const golds = drawn.flatMap((r) => r.colours.filter((c) => GOLD.test(c)))
    const counts = drawn.flatMap(textsOf).filter((t) => t.includes('corner'))
    const lines = drawn.map(lineOf).filter((l) => l !== undefined)
    expect([golds, counts, lines]).toEqual([[], [], []])
  })
})

// -------------------------------------------------------------- reduced motion

describe('drawRooms: under reduced motion', () => {
  const reduced = { reduced: true }

  it('turns the rooms at once', () => {
    // Act
    const rec = draw(1, {
      key: 'G',
      rooms: [0],
      lit: 0,
      turn: { from: 'C', at: 0 },
      ...reduced,
    })

    // Assert
    expect(litAt(rec)).toEqual(beads(7, 11, 2))
  })

  it('lands the corner on A at once as the quiet begins', () => {
    // Act
    const rec = draw(1400, { slide: { at: 0, by: 1 }, ...reduced })

    // Assert
    expect(litAt(rec)).toEqual(beads(9, 0, 4))
  })

  it('draws each segment of the walk whole as its note starts, with no head travelling', () => {
    // Act: just after E5, tune 1's fourth note, starts at 1.5 s
    const line = lineOf(draw(1501, { ...TUNE_1, ...reduced }))

    // Assert: the three segments to E5, every end at a heard bead's edge
    const heard = [4, 2, 0].map((pc) => bead(pc))
    const off = (p: Pt): number =>
      Math.min(...heard.map((b) => Math.abs(dist(p, b) - b.r - 2)))
    expect(line?.ends).toHaveLength(6)
    expect(Math.max(...(line?.ends ?? []).map(off))).toBeLessThan(1e-6)
  })

  it('turns the line faint at once as the tune ends, and holds a sounding note’s light steady', () => {
    // Act
    const ended = draw(8001, { ...TUNE_1, ...reduced })
    const early = draw(510, { ...TUNE_1, ...reduced })
    const late = draw(990, { ...TUNE_1, ...reduced })

    // Assert
    expect(lineOf(ended)?.style).toBe('rgba(88,166,255,0.3)')
    expect(early.gradients[0].stops[0]).toBe(late.gradients[0].stops[0])
  })
})

// -------------------------------------------------------------- the frame loop's rest

describe('roomsAnimating', () => {
  const turn: Partial<RoomsState> = { key: 'G', turn: { from: 'C', at: 0 } }
  const slide = { slide: { at: 0, by: 1 } }
  const stopped = { walk: walking('tune-1', { stoppedAt: 3000 }) }
  const fade = WALK_FADE_SEC * 1e3
  const moving = (now: number, over: Partial<RoomsState>): boolean =>
    roomsAnimating({ ...still, ...over }, now)

  it.each([
    ['nothing playing', 0, {}],
    ['a turn landed', 600, turn],
    ['a key chosen again, with no switch', 10, { turn: { from: 'C', at: 0 } }],
    ['a slide landed', 1700, slide],
    ['a walk faded', 8000 + fade, TUNE_1],
    ['a stopped walk faded', 3000 + fade, stopped],
  ] as const)('reports nothing moving at rest: %s', (_, now, over) => {
    // Act
    const got = moving(now, over)

    // Assert
    expect(got).toBe(false)
  })

  it.each([
    ['mid-turn', 300, turn],
    ['before the slide, waiting for it', 1000, slide],
    ['mid-slide', 1550, slide],
    ['a walk playing', 4000, TUNE_1],
    ['a walk fading', 8000 + fade / 2, TUNE_1],
    ['a stopped walk fading', 3000 + fade / 2, stopped],
  ] as const)('reports something moving: %s', (_, now, over) => {
    // Act
    const got = moving(now, over)

    // Assert
    expect(got).toBe(true)
  })

  it('under reduced motion, reports no turn and no fade, only a walk while it plays', () => {
    // Act
    const got = [
      moving(1, { ...turn, reduced: true }),
      moving(1400, { ...slide, reduced: true }),
      moving(4000, { ...TUNE_1, reduced: true }),
      moving(8001, { ...TUNE_1, reduced: true }),
    ]

    // Assert
    expect(got).toEqual([false, false, true, false])
  })

  it('is what drawRooms returns', () => {
    // Act
    const got = [300, 600].map((now) =>
      drawRooms(
        recorder().ctx,
        { ...FRAME, now },
        { ...still, ...turn },
        linear,
      ),
    )

    // Assert
    expect(got).toEqual([true, false])
  })
})

// -------------------------------------------------------------- where it draws

describe('drawRooms: where it draws', () => {
  const s: RoomsState = {
    ...still,
    ...TUNE_1,
    rooms: [0],
    lit: 0,
    label: 'name',
  }

  it('draws only to the context it is given, never the frame’s own', () => {
    // Arrange
    const own = recorder()
    const given = recorder()

    // Act
    drawRooms(given.ctx, { ...FRAME, now: 600, ctx: own.ctx }, s, linear)

    // Assert
    expect([own.strokes, own.fills, own.texts]).toEqual([[], [], []])
    expect(given.strokes.length).toBeGreaterThan(0)
  })

  it("draws nothing until the frame has drawn the ring's beads, or once the spiral unrolls", () => {
    // Arrange
    const empty = recorder()
    const unrolled = recorder()

    // Act
    drawRooms(empty.ctx, { ...FRAME, now: 600, beads: [] }, s, linear)
    drawRooms(unrolled.ctx, { ...FRAME, now: 600, u: 0.5 }, s, linear)

    // Assert
    expect([empty.colours, unrolled.colours]).toEqual([[], []])
  })
})
