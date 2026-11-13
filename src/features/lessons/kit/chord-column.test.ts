// ============================================================
// Chord column tests — the chord on so beside the staircase
// ============================================================
//
// Lesson 25's WEB-SPEC, Look and Toys 1: three beads on the staircase's own
// rows, in the room it leaves at its right, each named one letter per
// chord tone, the gaps counted, "3" and "4", and the chord named under
// them; nothing drawn until it is shown, as before the cold open's choice,
// then drawn in over 0.4 s; a bead sliding a row as Raise te lifts G to G♯,
// the names, the counts and the chord's name changing as it lands; a bead
// lit while its note sounds; and every move landing at once under reduced
// motion. A context that keeps every call stands in for the canvas, and the
// page's clock is a fake one.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import './browser-doubles.test-fixtures'
import type { ChordColumn, ColumnChord } from './chord-column'
import { chordColumn, COLUMN_SEC, COLUMN_W } from './chord-column'
import { NATURAL_MINOR_DEGREES } from './chords'
import type * as MotionSwitch from './motion-switch'
import type { StairsLayout } from './stairs-geometry'
import { stairsLayout } from './stairs-geometry'

let still = false

vi.mock('./motion-switch', async (actual) => ({
  ...(await actual<typeof MotionSwitch>()),
  reducedMotion: () => still,
}))

interface Mark {
  readonly kind: 'text' | 'bead'
  readonly text: string
  readonly x: number
  readonly y: number
  /** A bead's radius; a word's fill. */
  readonly r: number
  readonly fill: string
}

/** A context that keeps the words it writes, with their fill, and the beads it draws. */
function marksContext(marks: Mark[]): CanvasRenderingContext2D {
  const props: Record<PropertyKey, unknown> = {}
  return new Proxy(props, {
    get: (target, key) =>
      key in target
        ? target[key]
        : (...args: unknown[]): unknown => {
            if (key === 'fillText')
              marks.push({
                kind: 'text',
                text: String(args[0]),
                x: Number(args[1]),
                y: Number(args[2]),
                r: 0,
                fill: String(target.fillStyle),
              })
            if (key === 'arc')
              marks.push({
                kind: 'bead',
                text: '',
                x: Number(args[0]),
                y: Number(args[1]),
                r: Number(args[2]),
                fill: '',
              })
            if (
              key === 'createRadialGradient' ||
              key === 'createLinearGradient'
            )
              return { addColorStop: () => undefined }
            if (key === 'measureText') return { width: 0 }
            return undefined
          },
    set: (target, key, value: unknown) => {
      target[key] = value
      return true
    },
  }) as unknown as CanvasRenderingContext2D
}

/** Lesson 25's steps' staircase for the lower voice: A minor on A2, rows A2 to C4, the column's room kept. */
const minorOnA = (H = 280): StairsLayout =>
  stairsLayout('compact', 420, H, 45, 36, NATURAL_MINOR_DEGREES, {
    right: COLUMN_W,
    rows: { lo: 45, hi: 60 },
  })

const E_MINOR: ColumnChord = {
  notes: [52, 55, 59],
  names: ['E3', 'G3', 'B3'],
  label: 'E minor',
}
const E_MAJOR: ColumnChord = {
  notes: [52, 56, 59],
  names: ['E3', 'G♯3', 'B3'],
  label: 'E major',
}

/** The page's clock, seconds, as the column reads it. */
const now = (): number => performance.now() / 1000

/** One frame now: the words written, in order, and the beads drawn, low to high. */
function frame(
  col: ChordColumn,
  L: StairsLayout = minorOnA(),
): { texts: Mark[]; beads: Mark[] } {
  const marks: Mark[] = []
  col.paint(marksContext(marks), L, now())
  return {
    texts: marks.filter((m) => m.kind === 'text'),
    beads: marks.filter((m) => m.kind === 'bead'),
  }
}

const words = (texts: readonly Mark[]): string[] => texts.map((t) => t.text)

/** A word's fill: white while its bead is lit. */
const fillOf = (texts: readonly Mark[], text: string): string | undefined =>
  texts.find((t) => t.text === text)?.fill

/** A column showing E minor, drawn in. */
function shownMinor(redraw: () => void = () => undefined): ChordColumn {
  const col = chordColumn(redraw)
  col.set(E_MINOR)
  col.show(true)
  vi.advanceTimersByTime(COLUMN_SEC * 1000 + 50)
  return col
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['performance'] })
})

afterEach(() => {
  vi.useRealTimers()
  still = false
})

describe('the chord column', () => {
  it("draws nothing until it is shown, as before the cold open's choice", () => {
    // Arrange
    const col = chordColumn(() => undefined)

    // Act
    col.set(E_MINOR)
    const { texts, beads } = frame(col)

    // Assert
    expect([texts, beads]).toEqual([[], []])
    expect(col.shown).toBe(false)
    expect(col.moving(now())).toBe(false)
  })

  it("draws in over 0.4 s: three beads on the staircase's rows in the room at its right, named, counted and named as a chord", () => {
    // Arrange
    const redraw = vi.fn()
    const col = chordColumn(redraw)
    col.set(E_MINOR)

    // Act
    col.show(true)
    const drawing = col.moving(now())
    vi.advanceTimersByTime(COLUMN_SEC * 1000 + 50)
    const L = minorOnA()
    const { texts, beads } = frame(col, L)

    // Assert
    expect(redraw).toHaveBeenCalled()
    expect(drawing).toBe(true)
    expect(col.moving(now())).toBe(false)
    expect(beads.map((b) => b.y)).toEqual([52, 55, 59].map(L.yOfRow))
    for (const m of [...beads, ...texts]) {
      expect(m.x).toBeGreaterThan(L.x1)
      expect(m.x + m.r).toBeLessThan(L.x1 + COLUMN_W)
    }
    expect(words(texts)).toEqual(['3', '4', 'E3', 'G3', 'B3', 'E minor'])
  })

  it('slides the middle bead a row up as te rises, its words changing as it lands', () => {
    // Arrange
    const col = shownMinor()
    const L = minorOnA()

    // Act: halfway through the 0.4 s slide, then past its end
    col.set(E_MAJOR)
    vi.advanceTimersByTime(200)
    const mid = frame(col, L)
    const sliding = col.moving(now())
    vi.advanceTimersByTime(250)
    const landed = frame(col, L)

    // Assert
    expect(mid.beads[1].y).toBeCloseTo((L.yOfRow(55) + L.yOfRow(56)) / 2, 9)
    expect(words(mid.texts)).toEqual(['3', '4', 'E3', 'G3', 'B3', 'E minor'])
    expect(sliding).toBe(true)
    expect(landed.beads[1].y).toBeCloseTo(L.yOfRow(56), 9)
    expect(words(landed.texts)).toEqual([
      '4',
      '3',
      'E3',
      'G♯3',
      'B3',
      'E major',
    ])
    expect(col.chord).toBe(E_MAJOR)
    expect(col.moving(now())).toBe(false)
  })

  it('takes a chord at once while hidden, and draws it in as it is', () => {
    // Arrange
    const col = chordColumn(() => undefined)
    col.set(E_MINOR)

    // Act
    col.set(E_MAJOR)
    col.show(true)
    vi.advanceTimersByTime(COLUMN_SEC * 1000 + 50)

    // Assert
    expect(words(frame(col).texts)).toEqual([
      '4',
      '3',
      'E3',
      'G♯3',
      'B3',
      'E major',
    ])
  })

  it('lights a bead while its note sounds and a moment after, its name in white, then rests', () => {
    // Arrange
    const col = shownMinor()
    const t = now()

    // Act: G3 sounds for half a second
    col.light(1, t, t + 0.5)
    const lit = frame(col)
    const lighting = col.moving(now())
    vi.advanceTimersByTime(800)
    const after = frame(col)

    // Assert
    expect(fillOf(lit.texts, 'G3')).toBe('#ffffff')
    expect(fillOf(lit.texts, 'E3')).not.toBe('#ffffff')
    expect(lighting).toBe(true)
    expect(fillOf(after.texts, 'G3')).not.toBe('#ffffff')
    expect(col.moving(now())).toBe(false)
  })

  it('puts every light out at once, and goes at once when hidden', () => {
    // Arrange
    const col = shownMinor()
    const t = now()
    col.light(0, t, t + 5)

    // Act
    col.clear()
    const cleared = col.moving(now())
    col.show(false)

    // Assert
    expect(cleared).toBe(false)
    expect(col.shown).toBe(false)
    expect(frame(col).beads).toEqual([])
  })

  it('draws in and slides at once under reduced motion', () => {
    // Arrange
    still = true
    const col = chordColumn(() => undefined)
    const L = minorOnA()

    // Act
    col.set(E_MINOR)
    col.show(true)
    const first = frame(col, L)
    col.set(E_MAJOR)
    const second = frame(col, L)

    // Assert
    expect(first.beads).toHaveLength(3)
    expect(second.beads[1].y).toBeCloseTo(L.yOfRow(56), 9)
    expect(words(second.texts)).toContain('E major')
    expect(col.moving(now())).toBe(false)
  })

  it("draws its beads smaller where the rows sit closer than Lesson 10's, so no two touch: a phone held sideways", () => {
    // Arrange: the figure at its 150 px floor
    const L = minorOnA(150)
    const col = shownMinor()

    // Act
    const { beads } = frame(col, L)

    // Assert
    const r = beads[0].r
    expect(r).toBeLessThan(11)
    expect(beads[0].y - beads[1].y).toBeGreaterThan(2 * r)
  })
})
