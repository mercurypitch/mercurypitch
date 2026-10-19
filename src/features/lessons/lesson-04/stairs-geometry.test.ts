// ============================================================
// Lesson 4 staircase geometry tests — rows, stairs, tap zones and the strip
// ============================================================

import { describe, expect, it } from 'vitest'
import { fullMode, overlaps, stairAt, stairsLayout, stripWindow, TARGET, } from './stairs-geometry'

const STARTS = Array.from({ length: 12 }, (_, k) => 60 + k)

/** The desktop stage's figure, and the phone's at 390 x 844 (WEB-SPEC, Contract). */
const wide = (start: number) => stairsLayout('wide', 650, 476, start)
const narrow = (start: number) => stairsLayout('narrow', 356, 424, start)
/** The steps' stage beside the text, which keeps the whole stage to about 550 px: at 1024 and at 1366 px wide. */
const short = (start: number) => stairsLayout('narrow', 479, 270, start)
const shortWide = (start: number) => stairsLayout('narrow', 651, 270, start)

describe('fullMode', () => {
  it('takes the narrow layout on a phone, on a touch screen too narrow for fifteen 44 px keys, and on a short canvas', () => {
    expect(fullMode(356, 424, true)).toBe('narrow')
    expect(fullMode(650, 476, false)).toBe('wide')
    expect(fullMode(650, 476, true)).toBe('narrow')
    expect(fullMode(702, 476, true)).toBe('wide')
    expect(fullMode(650, 400, false)).toBe('narrow')
  })
})

describe('the wide layout', () => {
  it('shows all 25 rows from C4 to C6, one per semitone', () => {
    // Act
    const L = wide(60)

    // Assert
    expect(L.rows).toEqual(Array.from({ length: 25 }, (_, k) => 60 + k))
    expect(L.rowH).toBe(12)
    expect(L.yOfRow(60) - L.yOfRow(72)).toBe(12 * 12)
  })

  it('climbs the rows as it slides, keeping its shape', () => {
    // Act
    const onC = wide(60).stairs.map((s) => s.top)
    const onD = wide(62).stairs.map((s) => s.top)

    // Assert: two rows higher, every stair
    onC.forEach((top, i) => expect(top - onD[i]).toBeCloseTo(24, 9))
  })

  it('lays the fifteen white keys of C4 to C6 under the stairs', () => {
    expect(wide(60).strip?.keys.filter((k) => k.white)).toHaveLength(15)
  })
})

describe('the narrow layout', () => {
  it("shows the scale's thirteen rows, the stairs standing still while the rows scroll", () => {
    // Act
    const onC = narrow(60)
    const onD = narrow(62)

    // Assert
    expect(onD.rows).toEqual(Array.from({ length: 13 }, (_, k) => 62 + k))
    expect(onD.stairs.map((s) => s.top)).toEqual(onC.stairs.map((s) => s.top))
    expect(onD.yOfRow(62)).toBe(onC.yOfRow(60))
  })

  it('gives every stair a column of 44.5 px', () => {
    expect(narrow(60).stairs.map((s) => s.w)).toEqual(Array(8).fill(44.5))
  })

  it("fills the strip with the scale's octave, and pans it a semitone at a time", () => {
    // Act
    const keysOf = (start: number): number[] =>
      (narrow(start).strip?.keys ?? [])
        .filter((k) => k.zone !== null)
        .map((k) => k.midi)
        .sort((a, b) => a - b)

    // Assert: every note of the scale is on the strip and takes a tap
    for (const start of STARTS)
      for (const d of [0, 2, 4, 5, 7, 9, 11, 12])
        expect(keysOf(start), `${start}`).toContain(start + d)
    expect(stripWindow(62)).toBe(1)
    expect(stripWindow(66)).toBe(3.5)
    expect(stripWindow(62.5)).toBe(1.25)
  })
})

describe('tap zones', () => {
  for (const [name, layout] of [
    ['wide', wide],
    ['narrow', narrow],
    ['short', short],
    ['short and wide', shortWide],
  ] as const) {
    it(`gives every stair at least 44 px square in the ${name} layout, at every start, overlapping nothing`, () => {
      for (const start of STARTS) {
        // Act
        const L = layout(start)
        const zones = [
          ...L.stairs.map((s) => s.zone),
          ...L.brackets.map((b) => b.zone),
        ]

        // Assert
        for (const z of zones) {
          expect(z.w, `${start}`).toBeGreaterThanOrEqual(TARGET)
          expect(z.h, `${start}`).toBeGreaterThanOrEqual(TARGET)
          expect(z.y, `${start}`).toBeGreaterThanOrEqual(0)
        }
        zones.forEach((a, i) =>
          zones.forEach((b, j) => {
            if (i < j)
              expect(overlaps(a, b), `${name} ${start}: ${i} and ${j}`).toBe(
                false,
              )
          }),
        )
      }
    })
  }

  it("lands a tap on the stair whose column it falls in, and on nothing above a stair's zone", () => {
    // Arrange
    const L = narrow(60)
    const mi = L.stairs[2]

    // Act
    const onMi = stairAt(L, mi.x + 10, mi.top + 4)
    const aboveMi = stairAt(L, mi.x + 10, mi.zone.y - 2)

    // Assert
    expect(onMi).toBe(2)
    expect(aboveMi).toBeNull()
  })
})

describe('the short narrow layout', () => {
  it("keeps the scale's thirteen rows at 8 px or more under tighter margins", () => {
    // Act
    const L = short(62)

    // Assert
    expect(L.rows).toEqual(Array.from({ length: 13 }, (_, k) => 62 + k))
    expect(L.rowH).toBeGreaterThanOrEqual(8)
    expect(L.rowsTop).toBe(60)
  })

  it('centres eight 64 px columns, and their keys, on a figure wider than that', () => {
    // Act
    const L = shortWide(60)
    const whites = (L.strip?.keys ?? []).filter(
      (k) => k.white && k.zone !== null,
    )

    // Assert
    expect(L.x0).toBeCloseTo((651 - 512) / 2, 9)
    expect(L.stairs.map((st) => st.w)).toEqual(Array(8).fill(64))
    expect(Math.min(...whites.map((k) => k.x))).toBeCloseTo(L.x0, 9)
  })

  it('keeps every black key of the strip 44 px deep, so it still takes a fingertip', () => {
    for (const start of STARTS)
      for (const k of short(start).strip?.keys ?? [])
        if (!k.white && k.zone !== null)
          expect(k.zone.h, `${start} ${k.midi}`).toBeGreaterThanOrEqual(TARGET)
  })
})

describe('the compact layout', () => {
  it('fits a scale on C and one on D in its fifteen rows, C4 to D5, with no strip', () => {
    // Act
    const onC = stairsLayout('compact', 320, 220, 60)
    const onD = stairsLayout('compact', 320, 220, 62)

    // Assert
    expect(onC.rows).toEqual(Array.from({ length: 15 }, (_, k) => 60 + k))
    expect(onC.strip).toBeNull()
    expect(onD.stairs[7].top).toBeCloseTo(onC.rowsTop, 9)
    expect(onC.stairs[0].bottom).toBeCloseTo(220 - 6, 9)
  })
})
