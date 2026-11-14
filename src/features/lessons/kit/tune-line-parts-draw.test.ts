// ============================================================
// Tune line parts painter tests — lanes, the house, a held chord, a part and its brackets
// ============================================================
//
// What a shape's dress adds to Lesson 6's tune line, drawn to a context
// that records its calls with the style each was made in: the key's lanes
// a step brighter and a held chord's in gold; the house on do in the
// gutter, and none without room for it; a chord's bar named under each
// band; a part's beads, a hollow one with no glow whatever lights it, the
// names inside its beads off the lanes, and a bracket at a note, a number
// centred and words beside it, to the left where the right runs out; each
// line's label above or below its first bead. Through the line's own
// painter: the dressed tune in its colour, one bead alone with no line,
// and a contrast case drawn on every band, each its own notes; and a line
// given no painter for its dress drawing none of it.

import { describe, expect, it, vi } from 'vitest'
import './browser-doubles.test-fixtures'
import { drawHome } from './home-glyph'
import { COLOR, rgba } from './notes'
import type { TuneScene } from './tune-line-draw'
import { paintTune } from './tune-line-draw'
import type { TuneLayout } from './tune-line-layout'
import { pitchY, tuneLayout } from './tune-line-layout'
import type { DressScene, PartScene } from './tune-line-parts'
import { CHORD_BAR, DRESS, paintChordBar, paintHouse, paintLabels, paintLanes, paintPairBrackets, paintParts, } from './tune-line-parts-draw'

vi.mock('./home-glyph', () => ({ drawHome: vi.fn() }))

interface Call {
  readonly name: string
  readonly args: readonly unknown[]
  /** The styles in force when it was made. */
  readonly fill: unknown
  readonly stroke: unknown
  readonly align: unknown
  readonly baseline: unknown
  readonly shadow: unknown
  readonly font: unknown
}

/**
 * A context that records every call with the styles it was made in, and
 * keeps its styles across save and restore as a canvas does; text 6.6 px
 * a character.
 */
function recorder(): { ctx: CanvasRenderingContext2D; calls: Call[] } {
  const calls: Call[] = []
  const style: Record<string, unknown> = {
    fillStyle: '',
    strokeStyle: '',
    textAlign: 'start',
    textBaseline: 'alphabetic',
    shadowColor: '',
    font: '',
  }
  const saved: Record<string, unknown>[] = []
  const ctx = new Proxy(style, {
    get: (t, k) => {
      if (typeof k !== 'string') return undefined
      if (k in t) return t[k]
      if (k === 'measureText')
        return (text: string) => ({ width: text.length * 6.6 })
      if (k === 'save') return () => saved.push({ ...t })
      if (k === 'restore')
        return () => {
          Object.assign(t, saved.pop() ?? {})
        }
      return (...args: unknown[]) =>
        calls.push({
          name: k,
          args,
          fill: t.fillStyle,
          stroke: t.strokeStyle,
          align: t.textAlign,
          baseline: t.textBaseline,
          shadow: t.shadowColor,
          font: t.font,
        })
    },
    set: (t, k, v: unknown) => {
      t[k as string] = v
      return true
    },
  }) as unknown as CanvasRenderingContext2D
  return { ctx, calls }
}

const named = (calls: readonly Call[], name: string): Call[] =>
  calls.filter((c) => c.name === name)
const texts = (calls: readonly Call[]): string[] =>
  named(calls, 'fillText').map((c) => String(c.args[0]))

const TWINKLE = [60, 60, 67, 67, 69, 69, 67]
const TWINKLE2 = [65, 65, 64, 64, 62, 62, 60]
const BEATS = [1, 1, 1, 1, 1, 1, 2]

/** One or two bands of C4 to D5 at 390 px, the gutter for the house. */
function layout(bands = 1, gutter = 24, width = 390, height = 350): TuneLayout {
  return tuneLayout({
    width,
    height,
    beats: Array.from({ length: bands }, () => BEATS),
    rows: 15,
    names: false,
    below: false,
    above: false,
    targets: false,
    gutter,
  })
}

const NO_DRESS: DressScene = {
  lanes: new Set(),
  house: null,
  label: null,
  color: COLOR.chrome,
  hollow: new Set(),
  only: null,
  chord: null,
  parts: [],
}

function part(over: Partial<PartScene> = {}): PartScene {
  return {
    band: 0,
    pitches: [64, 64, 71, 71, 72, 72, 71],
    label: 'copy',
    color: COLOR.chrome,
    beads: [0, 1, 2, 3, 4, 5, 6],
    joined: true,
    names: [],
    brackets: [],
    hollow: new Set(),
    light: () => null,
    ...over,
  }
}

function scene(
  over: Partial<TuneScene> = {},
  dress: Partial<DressScene> = {},
): TuneScene {
  return {
    lines: [TWINKLE],
    first: [0],
    windows: [[60, 74]],
    name: null,
    below: null,
    gapWords: () => ({ size: '', word: '' }),
    move: () => 'same',
    brackets: [],
    ghost: null,
    overlay: null,
    light: () => null,
    lift: 0,
    glow: 0,
    dress: { ...NO_DRESS, ...dress },
    ...over,
  }
}

describe('paintLanes', () => {
  it("draws the key's rows a step brighter, and a held chord's in gold", () => {
    // Arrange: C major's lanes on C4 to D5, the C major chord held
    const r = recorder()

    // Act
    paintLanes(
      r.ctx,
      layout(),
      scene(
        {},
        {
          lanes: new Set([0, 2, 4, 5, 7, 9, 11]),
          chord: { name: 'C major chord', pcs: [0, 4, 7] },
        },
      ),
    )

    // Assert: C4, E4, G4 and C5 gold; D4, F4, A4, B4 and D5 a step brighter; no black key
    const strokes = named(r.calls, 'stroke')
    expect(
      strokes.filter((c) => c.stroke === rgba(COLOR.gold, 0.38)),
    ).toHaveLength(4)
    expect(
      strokes.filter((c) => c.stroke === rgba(COLOR.chrome, 0.3)),
    ).toHaveLength(5)
    expect(strokes).toHaveLength(9)
  })

  it('draws nothing without lanes or a chord', () => {
    const r = recorder()
    paintLanes(r.ctx, layout(), scene())
    expect(r.calls).toHaveLength(0)
  })
})

describe('paintHouse', () => {
  it("draws the house in the gutter on do's row, in every band that holds it", () => {
    // Arrange
    const r = recorder()
    vi.mocked(drawHome).mockClear()
    const T = layout(2)

    // Act
    paintHouse(
      r.ctx,
      T,
      scene(
        {
          lines: [TWINKLE, TWINKLE2],
          first: [0, 7],
          windows: [
            [60, 74],
            [60, 74],
          ],
        },
        { house: 60 },
      ),
    )

    // Assert
    expect(drawHome).toHaveBeenCalledTimes(2)
    const [, x, y, size] = vi.mocked(drawHome).mock.calls[0]
    expect(x).toBe(12)
    expect(y).toBeCloseTo(pitchY(T.lines[0], 74, 60), 5)
    expect(size).toBe(16)
  })

  it('draws no house without room at the left, or off the band', () => {
    vi.mocked(drawHome).mockClear()
    paintHouse(recorder().ctx, layout(1, 0), scene({}, { house: 60 }))
    paintHouse(recorder().ctx, layout(), scene({}, { house: 48 }))
    expect(drawHome).not.toHaveBeenCalled()
  })
})

describe('paintChordBar', () => {
  it("names a held chord on a bar at each band's foot, from the first column to the last", () => {
    const r = recorder()
    const T = layout()
    paintChordBar(
      r.ctx,
      T,
      scene({}, { chord: { name: 'C major chord', pcs: [0, 4, 7] } }),
    )
    expect(texts(r.calls)).toEqual(['C major chord'])
    const bar = named(r.calls, 'roundRect')[0].args as number[]
    expect(bar[0]).toBe(T.lines[0].cols[0].x + 2)
    expect(bar[1]).toBe(T.lines[0].bandBottom + CHORD_BAR.gap)
    expect(bar[0] + bar[2]).toBe(390 - 2)
  })
})

describe('paintParts', () => {
  it('paints each shown bead of a part, the line through them, and the names inside them', () => {
    // Arrange: the copy four semitones up, its notes off the lanes named
    const r = recorder()
    const names = [null, null, null, null, 'C♯', 'C♯', null]

    // Act
    paintParts(
      r.ctx,
      layout(),
      scene(
        {},
        { parts: [part({ pitches: [64, 64, 71, 71, 73, 73, 71], names })] },
      ),
    )

    // Assert
    expect(named(r.calls, 'roundRect')).toHaveLength(7)
    expect(named(r.calls, 'lineTo')).toHaveLength(6)
    expect(texts(r.calls)).toEqual(['C♯', 'C♯'])
  })

  it('paints one bead alone, with no line', () => {
    const r = recorder()
    paintParts(
      r.ctx,
      layout(),
      scene({}, { parts: [part({ beads: [3], joined: false })] }),
    )
    expect(named(r.calls, 'roundRect')).toHaveLength(1)
    expect(named(r.calls, 'lineTo')).toHaveLength(0)
  })

  it('draws a passing note hollow, with no glow whatever lights it, and a lit chord note glowing', () => {
    // Arrange: mi fa so, fa passing, every bead lit gold
    const r = recorder()
    const gold = { amount: 1, color: COLOR.gold }

    // Act
    paintParts(
      r.ctx,
      layout(),
      scene(
        {},
        {
          parts: [
            part({
              pitches: [64, 65, 67],
              beads: [0, 1, 2],
              hollow: new Set([1]),
              light: () => gold,
            }),
          ],
        },
      ),
    )

    // Assert: two glows, for mi and so; fa an outline on the background
    const glows = named(r.calls, 'fill').filter((c) => c.shadow === COLOR.gold)
    expect(glows).toHaveLength(2)
    expect(
      named(r.calls, 'fill').filter((c) => c.fill === COLOR.bg),
    ).toHaveLength(1)
  })
})

describe('paintPairBrackets', () => {
  it("centres a number between the tune's bead and the part's", () => {
    const r = recorder()
    const brackets = ['4', '4', '4', '4', '3', '3', '4']
    paintPairBrackets(
      r.ctx,
      layout(),
      scene({}, { parts: [part({ brackets })] }),
    )
    const labels = named(r.calls, 'fillText')
    expect(labels.map((c) => c.args[0])).toEqual(brackets)
    expect(labels.every((c) => c.align === 'center')).toBe(true)
  })

  it('writes words beside the bracket, to its left where the right runs out of room', () => {
    // Arrange: Step 1's pair at do, then at ti, alone on the band
    const at = (i: number): Call => {
      const r = recorder()
      const words = Array.from({ length: 7 }, () => 'C up to E: 4 semitones')
      paintPairBrackets(
        r.ctx,
        layout(),
        scene(
          { lines: [[60, 62, 64, 65, 67, 69, 71]] },
          {
            parts: [
              part({
                pitches: [64, 65, 67, 69, 71, 72, 74],
                beads: [i],
                joined: false,
                brackets: words,
              }),
            ],
          },
        ),
      )
      return named(r.calls, 'fillText')[0]
    }

    // Act
    const low = at(0)
    const high = at(6)

    // Assert
    expect(low.align).toBe('left')
    expect(high.align).toBe('right')
  })

  it('draws no bracket where the two beads touch, or where it has no label', () => {
    const r = recorder()
    paintPairBrackets(
      r.ctx,
      layout(),
      scene({}, { parts: [part({ pitches: TWINKLE, brackets: ['1'] })] }),
    )
    expect(named(r.calls, 'stroke')).toHaveLength(0)
  })
})

describe('paintLabels', () => {
  it('labels the higher line above its first bead and the lower below, an empty label not at all', () => {
    // Arrange
    const r = recorder()

    // Act
    paintLabels(r.ctx, layout(), scene({}, { label: 'tune', parts: [part()] }))
    paintLabels(r.ctx, layout(), scene({}, { parts: [part({ label: '' })] }))

    // Assert
    const labels = named(r.calls, 'fillText')
    expect(labels.map((c) => [c.args[0], c.baseline])).toEqual([
      ['copy', 'bottom'],
      ['tune', 'top'],
    ])
  })
})

describe('paintTune, dressed', () => {
  it("draws the tune's beads in the dress's colour, once each", () => {
    const r = recorder()
    paintTune(r.ctx, layout(), scene({}, { color: COLOR.blue }), DRESS)
    const beads = named(r.calls, 'fill').filter(
      (c) => c.fill === rgba(COLOR.blue, 0.82),
    )
    expect(beads).toHaveLength(7)
  })

  it('draws one bead of the tune alone, with no line, where the dress asks', () => {
    const r = recorder()
    paintTune(r.ctx, layout(), scene({}, { only: 2 }), DRESS)
    expect(
      named(r.calls, 'fill').filter((c) => c.fill === rgba(COLOR.chrome, 0.82)),
    ).toHaveLength(1)
  })

  it('draws a contrast case on every band, each its own notes', () => {
    // Arrange: both of "Twinkle"'s lines, the copy four semitones up over both, every bead lit
    const r = recorder()
    const up4 = [...TWINKLE, ...TWINKLE2].map((p) => p + 4)

    // Act
    paintTune(
      r.ctx,
      layout(2),
      scene({
        lines: [TWINKLE, TWINKLE2],
        first: [0, 7],
        windows: [
          [60, 74],
          [60, 74],
        ],
        overlay: { pitches: up4, amount: 1, changed: [] },
        light: (_g, over) => (over ? { amount: 1, color: COLOR.chrome } : null),
      }),
      DRESS,
    )

    // Assert: fourteen lit beads of the case, seven on each band
    const lit = named(r.calls, 'fill').filter(
      (c) => c.fill === rgba(COLOR.ink2, 0.75),
    )
    expect(lit).toHaveLength(14)
  })

  it('sizes the contrast case\'s "?" to the room above its highest bead, never past the figure\'s top', () => {
    // Arrange: the copy four semitones up, its C sharp 5 a row under the
    // band's top, on the hero's compact two bands and on a roomy one
    const up4 = [...TWINKLE, ...TWINKLE2].map((p) => p + 4)
    const mark = (T: TuneLayout, windows: [number, number][]) => {
      const r = recorder()
      paintTune(
        r.ctx,
        T,
        scene({
          lines: [TWINKLE, TWINKLE2].slice(0, T.lines.length),
          first: [0, 7].slice(0, T.lines.length),
          windows,
          overlay: { pitches: up4, amount: 1, changed: [] },
        }),
        DRESS,
      )
      const call = named(r.calls, 'fillText').find((c) => c.args[0] === '?')
      const size = Number(/(\d+)px/.exec(String(call?.font))?.[1])
      const L = T.lines[0]
      const beadTop = pitchY(L, windows[0][1], 73) - L.bead / 2
      return { size, y: Number(call?.args[2]), beadTop }
    }

    // Act
    const tight = mark(layout(2, 24, 390, 250), [
      [60, 74],
      [60, 74],
    ])
    const roomy = mark(layout(1, 24, 390, 350), [[60, 86]])

    // Assert: inside the figure and clear of its bead; Lesson 6's 24 px with room
    expect(tight.size).toBeGreaterThanOrEqual(12)
    expect(tight.size).toBeLessThan(24)
    expect(tight.y - tight.size * 0.75).toBeGreaterThanOrEqual(0)
    expect(tight.y).toBeLessThanOrEqual(tight.beadTop)
    expect(roomy).toEqual({
      size: 24,
      y: roomy.beadTop - 4,
      beadTop: roomy.beadTop,
    })
  })

  it('draws none of a dress on a line given no painter for it: Lesson 6’s line as it was', () => {
    // Arrange: lanes, a part and labels, painted with and without the painter
    const dressed = scene(
      {},
      {
        lanes: new Set([0, 2, 4, 5, 7, 9, 11]),
        label: 'tune',
        color: COLOR.blue,
        parts: [part()],
      },
    )
    const withIt = recorder()
    const without = recorder()

    // Act
    paintTune(withIt.ctx, layout(), dressed, DRESS)
    paintTune(without.ctx, layout(), dressed)

    // Assert
    expect(texts(withIt.calls)).toEqual(['copy', 'tune'])
    expect(texts(without.calls)).toEqual([])
    expect(
      named(without.calls, 'fill').filter(
        (c) => c.fill === rgba(COLOR.chrome, 0.82),
      ),
    ).toHaveLength(7)
  })
})
