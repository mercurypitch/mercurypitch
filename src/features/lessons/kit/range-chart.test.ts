// ============================================================
// Range chart tests — its geometry at every width, and its mount
// ============================================================
//
// Lesson 7's WEB-SPEC, Tests 10, and its FACTS 88: at every viewport from
// 344 to 1440 px the six band columns stand at least 44 px wide side by
// side, and every row of controls under the canvas keeps its buttons at
// least 44 px wide with 8 px between them, the voice switch on its own row
// of two and free play's state switch three then two. Pitch is height, one
// equal row a semitone; a pointer's height reads back the note it stands
// on. The mounted chart paints only when told, and writes its spoken
// summary only when the words change. Lesson 11's options (its WEB-SPEC,
// Tests 4 and 5): a line in gears is 6 px wide in the lower gear and 2 px in
// the upper, a seam spans its jump and never stands under 2 px, slots and
// a caption are drawn only when asked, and a line with no gears is stroked
// as Lesson 7's always was.

import { afterEach, describe, expect, it, vi } from 'vitest'
import './browser-doubles.test-fixtures'
import { gearWidth, mountRangeChart, SEAM_MIN_PX, seamBox, span, } from './range-chart'
import type { DrawFrame } from './range-chart-draw'
import { drawLine, drawSeam } from './range-chart-draw'
import { bandColumns, buttonWidth, canvasWidth, CONTROL_GAP, midiAt, rangeFrame, rowHeight, stageInner, xOfT, yOf, } from './range-chart-layout'

afterEach(() => {
  vi.restoreAllMocks()
  document.body.textContent = ''
})

/** Every viewport width the layout must hold, 344 to 1440 px. */
const WIDTHS = Array.from({ length: 1440 - 344 + 1 }, (_, i) => 344 + i)

describe('the range chart at every width', () => {
  it('stands six band columns side by side, each at least 44 px wide', () => {
    for (const vw of WIDTHS) {
      // Arrange
      const f = rangeFrame(canvasWidth(vw), 288, {
        lo: 40,
        hi: 84,
        column: 'none',
        seconds: 6,
      })

      // Act
      const cols = bandColumns(f, 6)

      // Assert
      for (const [i, c] of cols.entries()) {
        expect(c.x1 - c.x0, `${vw} px, band ${i}`).toBeGreaterThanOrEqual(44)
        if (i > 0) expect(c.x0).toBeCloseTo(cols[i - 1].x1, 9)
      }
    }
  })

  it('keeps every button of every row at least 44 px wide, 8 px apart', () => {
    // Arrange: the rows under the canvas, two a row; the sounds and free
    // play's first row of states three a row
    const rows = [2, 3]

    for (const vw of WIDTHS) {
      for (const perRow of rows) {
        // Act
        const inner = stageInner(vw)
        const w = buttonWidth(inner, perRow)

        // Assert
        expect(w, `${vw} px, ${perRow} a row`).toBeGreaterThanOrEqual(44)
        expect(w * perRow + CONTROL_GAP * (perRow - 1)).toBeCloseTo(inner, 9)
      }
    }
  })

  it('measures 390 px as the stage CSS does: a 358 px card, its canvas 356 px edge to edge', () => {
    expect(stageInner(390) + 2 * 12 + 2).toBe(358)
    expect(canvasWidth(390)).toBe(356)
    expect(buttonWidth(stageInner(390), 2)).toBe(162)
    expect(buttonWidth(stageInner(344), 3)).toBe(90)
  })

  it('gives every semitone an equal row, and reads a height back as its note', () => {
    // Arrange: the lower voice's window on a phone's 288 px canvas
    const f = rangeFrame(354, 288, {
      lo: 40,
      hi: 72,
      column: 'bar',
      seconds: 6,
    })

    // Act
    const rows = [41, 52, 71].map((m) => yOf(f, m - 1) - yOf(f, m))

    // Assert
    expect(rowHeight(f)).toBeCloseTo((288 - 24) / 33, 9)
    for (const r of rows) expect(r).toBeCloseTo(rowHeight(f), 9)
    for (let m = 40; m <= 72; m++)
      expect(midiAt(f, yOf(f, m))).toBeCloseTo(m, 9)
    expect(xOfT(f, 0)).toBe(f.tX0)
    expect(xOfT(f, 99)).toBe(f.tX1)
  })

  it('puts a compact column across the plot, with room for the bracket at its right', () => {
    const f = rangeFrame(300, 200, {
      lo: 45,
      hi: 69,
      column: 'wide',
      seconds: 8,
      names: false,
    })
    expect(f.colX0).toBe(8)
    expect(f.x1 - f.colX1).toBe(22)
    expect(f.tX0).toBeGreaterThan(f.colX0)
    expect(f.tX1).toBeLessThan(f.colX1)
  })
})

describe('mountRangeChart', () => {
  function mount() {
    const root = document.createElement('div')
    root.innerHTML = '<canvas></canvas>'
    document.body.append(root)
    return mountRangeChart(root, {
      window: { lo: 40, hi: 72 },
      active: () => true,
    })
  }

  it('writes its spoken summary only when the words change', () => {
    // Arrange
    const chart = mount()
    const set = vi.spyOn(chart.canvas, 'setAttribute')

    // Act
    chart.describe("Merc's siren on the column")
    chart.describe("Merc's siren on the column")
    chart.describe('Your siren, drawn as a line')

    // Assert
    expect(set.mock.calls.filter(([name]) => name === 'aria-label')).toEqual([
      ['aria-label', "Merc's siren on the column"],
      ['aria-label', 'Your siren, drawn as a line'],
    ])
  })

  it('clears the scene back to the column alone', () => {
    // Arrange
    const chart = mount()
    chart.scene.column = { lo: 45, hi: 69, lit: span(51, 63) }
    chart.scene.beads = [{ t: 0, midi: 52 }]
    chart.scene.note = 50
    chart.scene.wash = { lo: 55, hi: 60, label: 'middle half of your siren' }

    // Act
    chart.clear()

    // Assert
    expect(chart.scene.column).toEqual({
      lo: 45,
      hi: 69,
      lit: { lo: 51, hi: 63 },
    })
    expect(chart.scene.beads).toEqual([])
    expect(chart.scene.note).toBeNull()
    expect(chart.scene.wash).toBeNull()
  })

  it('places a note for a handle laid over it at the column’s middle', () => {
    // Arrange
    const chart = mount()
    Object.defineProperty(chart.canvas, 'clientWidth', { value: 354 })
    Object.defineProperty(chart.canvas, 'clientHeight', { value: 288 })
    chart.scene.column = { lo: 45, hi: 69, lit: span(51, 63) }

    // Act
    const low = chart.pointOf(45)
    const high = chart.pointOf(69)
    const f = chart.frame()

    // Assert
    expect(low.x).toBe((f.colX0 + f.colX1) / 2)
    expect(low.y).toBeGreaterThan(high.y)
    expect(low.y).toBeCloseTo(yOf(f, 45), 9)
  })
})

/** A context that records each stroke's width and alpha, and each fill. */
function recorder(): {
  ctx: CanvasRenderingContext2D
  strokes: { width: number; alpha: number }[]
  fills: number
} {
  const out = { strokes: [] as { width: number; alpha: number }[], fills: 0 }
  const state: Record<string, unknown> = { lineWidth: 1, globalAlpha: 1 }
  const ctx = new Proxy(state, {
    get: (t, key) => {
      if (key === 'stroke')
        return () =>
          out.strokes.push({
            width: Number(t.lineWidth),
            alpha: Number(t.globalAlpha),
          })
      if (key === 'fillRect') return () => (out.fills += 1)
      if (key in t) return t[key as string]
      return () => ({ addColorStop: () => undefined })
    },
    set: (t, key, v: unknown) => {
      t[key as string] = v
      return true
    },
  }) as unknown as CanvasRenderingContext2D
  return {
    ctx,
    get strokes() {
      return out.strokes
    },
    get fills() {
      return out.fills
    },
  }
}

/** The steps' window, C3 to E5, on a figure `h` px tall and a phone's width. */
const stepsFrame = (h: number, ctx: CanvasRenderingContext2D): DrawFrame => ({
  ...rangeFrame(354, h, { lo: 48, hi: 76, column: 'none', seconds: 4 }),
  ctx,
})

describe("the range chart's gears, seams and slots (Lesson 11)", () => {
  it('draws a line in gears 6 px wide in the lower gear, 2 px in the upper, and between them for a blend', () => {
    expect([gearWidth(1), gearWidth(0), gearWidth(0.5)]).toEqual([6, 2, 4])
  })

  it("strokes a line with no gears as Lesson 7's line: a 10 px glow, then 2.6 px", () => {
    // Arrange
    const r = recorder()

    // Act
    drawLine(stepsFrame(310, r.ctx), {
      points: [
        { t: 0, midi: 52 },
        { t: 2, midi: 57 },
        { t: 4, midi: 61 },
      ],
      color: '#f59e0b',
    })

    // Assert
    expect(r.strokes).toEqual([
      { width: 10, alpha: 0.13 },
      { width: 2.6, alpha: 1 },
    ])
  })

  it('strokes a line in gears stretch by stretch, thick below the switch and thin above it, each over its glow', () => {
    // Arrange
    const r = recorder()

    // Act: a lower-gear stretch, the switch, an upper-gear stretch
    drawLine(stepsFrame(310, r.ctx), {
      points: [
        { t: 0, midi: 52, share: 1 },
        { t: 1.7, midi: 55, share: 1 },
        { t: 1.74, midi: 57, share: 0 },
        { t: 4, midi: 61, share: 0 },
      ],
      color: '#f59e0b',
    })

    // Assert
    expect(r.strokes.map((s) => s.width)).toEqual([13, 11, 9, 6, 4, 2])
    expect(r.strokes.map((s) => s.alpha)).toEqual([0.13, 0.13, 0.13, 1, 1, 1])
  })

  it('spans a seam from the note a line jumps from to the note it jumps to', () => {
    // Arrange: a 310 px figure, Step 4's five jumps centred on G sharp 3
    const f = stepsFrame(310, recorder().ctx)
    const row = (f.bottom - f.top) / (f.hi - f.lo + 1)

    // Act
    const heights = [2, 1.5, 1, 0.5, 0.25].map((j) => {
      const b = seamBox(f, { lo: 56 - j / 2, hi: 56 + j / 2 })
      return b.y1 - b.y0
    })

    // Assert
    heights.forEach((h, i) =>
      expect(h).toBeCloseTo(
        Math.max(SEAM_MIN_PX, [2, 1.5, 1, 0.5, 0.25][i] * row),
        9,
      ),
    )
    expect(heights[0]).toBeGreaterThan(heights[4])
  })

  it("never draws a seam under 2 px, centred on its jump, even at the figure's 210 px floor", () => {
    // Arrange
    const f = stepsFrame(210, recorder().ctx)

    // Act
    const b = seamBox(f, { lo: 55.875, hi: 56.125 })

    // Assert
    expect(b.y1 - b.y0).toBeCloseTo(2, 9)
    expect((b.y0 + b.y1) / 2).toBeCloseTo(yOf(f, 56), 9)
  })

  it("draws a seam across its slot's time only, or across the whole plot", () => {
    // Arrange
    const f = stepsFrame(310, recorder().ctx)

    // Act
    const slot = seamBox(f, { lo: 55, hi: 57, t0: 1, t1: 2 })
    const whole = seamBox(f, { lo: 55, hi: 57 })

    // Assert
    expect([slot.x0, slot.x1]).toEqual([xOfT(f, 1), xOfT(f, 2)])
    expect([whole.x0, whole.x1]).toEqual([f.x0, f.x1])
  })

  it('paints a seam as a shaded band, edged above and below', () => {
    // Arrange
    const r = recorder()

    // Act
    drawSeam(stepsFrame(310, r.ctx), { lo: 55, hi: 57, label: "Merc's model" })

    // Assert: one fill, the hatch, and its two edges
    expect(r.fills).toBe(1)
    expect(r.strokes).toHaveLength(3)
  })

  it('mounts with none of these drawn: no slots, no caption and no seams', () => {
    // Arrange
    const root = document.createElement('div')
    root.innerHTML = '<canvas></canvas>'
    document.body.append(root)

    // Act
    const chart = mountRangeChart(root, {
      window: { lo: 48, hi: 76 },
      active: () => true,
    })

    // Assert
    expect([chart.scene.slots, chart.scene.caption, chart.scene.seams]).toEqual(
      [0, null, []],
    )
  })
})
