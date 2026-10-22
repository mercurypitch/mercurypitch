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
// summary only when the words change.

import { afterEach, describe, expect, it, vi } from 'vitest'
import './browser-doubles.test-fixtures'
import { mountRangeChart, span } from './range-chart'
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
