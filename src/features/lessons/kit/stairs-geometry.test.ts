// ============================================================
// Staircase geometry tests — rows, stairs, tap zones and the strip
// ============================================================

import { describe, expect, it } from 'vitest'
import { NATURAL_MINOR_DEGREES } from './chords'
import { MAJOR_DEGREES } from './major-scale'
import { floorOf, fullMode, overlaps, stairAt, stairsLayout, stripWindow, TARGET, } from './stairs-geometry'
import { MAJOR_FIVE, MINOR_FIVE } from './stairs-scales'

/** Lesson 4's floor, under its starts C4 to B4. */
const C4 = 60
/** Lesson 16's five stairs, do to so. */
const FIVE = MAJOR_DEGREES.slice(0, 5)
const STARTS = Array.from({ length: 12 }, (_, k) => C4 + k)

/** The desktop stage's figure, and the phone's at 390 x 844 (Lesson 4 WEB-SPEC, Contract). */
const wide = (start: number) => stairsLayout('wide', 650, 476, start, C4)
const narrow = (start: number) => stairsLayout('narrow', 356, 424, start, C4)
/** The steps' stage beside the text, which keeps the whole stage to about 550 px: at 1024 and at 1366 px wide. */
const short = (start: number) => stairsLayout('narrow', 479, 270, start, C4)
const shortWide = (start: number) => stairsLayout('narrow', 651, 270, start, C4)

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
    expect(stripWindow(62, C4)).toBe(1)
    expect(stripWindow(66, C4)).toBe(3.5)
    expect(stripWindow(62.5, C4)).toBe(1.25)
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
    const onC = stairsLayout('compact', 320, 220, 60, C4)
    const onD = stairsLayout('compact', 320, 220, 62, C4)

    // Assert
    expect(onC.rows).toEqual(Array.from({ length: 15 }, (_, k) => 60 + k))
    expect(onC.strip).toBeNull()
    expect(onD.stairs[7].top).toBeCloseTo(onC.rowsTop, 9)
    expect(onC.stairs[0].bottom).toBeCloseTo(220 - 6, 9)
  })

  it("lifts its rows for a scale that reaches past them, its top stair the top row: the minor five on A3 over C3 (Lesson 20's words)", () => {
    // Act
    const onA = stairsLayout('compact', 320, 220, 57, 48, MINOR_FIVE)

    // Assert
    expect(onA.rows).toEqual(Array.from({ length: 15 }, (_, k) => 55 + k))
    expect(onA.stairs[5].top).toBeCloseTo(onA.rowsTop, 9)
    expect(onA.stairs[0].bottom).toBeLessThanOrEqual(220 - 6 + 1e-9)
  })
})

describe('a staircase on other starts', () => {
  it('stands on the C at or below its lowest start, and takes no range wider than that octave', () => {
    expect(floorOf({ lo: 60, hi: 71 })).toBe(60)
    expect(floorOf({ lo: 48, hi: 59 })).toBe(48)
    expect(floorOf({ lo: 43, hi: 43 })).toBe(36)
    expect(floorOf({ lo: 67, hi: 67 })).toBe(60)
    expect(() => floorOf({ lo: 43, hi: 50 })).toThrow()
    expect(() => floorOf({ lo: 62, hi: 60 })).toThrow()
  })

  it("takes the C that closes the floor's octave as a start: Lesson 20's A2 and C3 over C2", () => {
    expect(floorOf({ lo: 45, hi: 48 })).toBe(36)
    expect(floorOf({ lo: 60, hi: 72 })).toBe(60)
    expect(() => floorOf({ lo: 45, hi: 49 })).toThrow()
  })

  it("keeps the major scale from C3 and the minor five from A2 on C2's 25 rows", () => {
    // Act: Lesson 20's Step 2 for the lower voice
    const major = stairsLayout('wide', 650, 476, 48, 36, MAJOR_FIVE)
    const minor = stairsLayout('wide', 650, 476, 45, 36, MINOR_FIVE)

    // Assert: each top do on its own row, inside the rows
    expect(major.stairs[5].top).toBeCloseTo(
      major.yOfRow(60) - major.rowH / 2,
      9,
    )
    expect(minor.stairs[5].top).toBeCloseTo(
      minor.yOfRow(57) - minor.rowH / 2,
      9,
    )
    expect(minor.rows).toEqual(Array.from({ length: 25 }, (_, k) => 36 + k))
  })

  it('draws G2 on two octaves from C2, the strip from C2 to C4 under it', () => {
    // Act
    const L = stairsLayout('wide', 650, 476, 43, 36)

    // Assert: the rows and the strip start on C2, and the top do, G3, sits on its own row
    expect(L.rows).toEqual(Array.from({ length: 25 }, (_, k) => 36 + k))
    const keys = (L.strip?.keys ?? []).map((k) => k.midi)
    expect([Math.min(...keys), Math.max(...keys)]).toEqual([36, 60])
    expect(L.stairs[7].top).toBeCloseTo(L.yOfRow(55) - L.rowH / 2, 9)
  })

  it('pans the narrow strip from its own floor, as from C4', () => {
    expect(stripWindow(43, 36)).toBe(stripWindow(67, C4))
    expect(stripWindow(50, 48)).toBe(stripWindow(62, C4))
  })
})

describe('a staircase of fewer stairs', () => {
  it('draws five, do to so, with no brackets for Group', () => {
    // Act: Lesson 16's, on G4 over C4, on a phone's figure
    const five = stairsLayout('narrow', 356, 424, 67, C4, FIVE)
    const eight = stairsLayout('narrow', 356, 424, 67, C4)

    // Assert: the short stair from mi to fa a row, the others two
    expect(five.stairs).toHaveLength(5)
    expect(
      five.stairs.map((st) =>
        Math.round((five.stairs[0].top - st.top) / five.rowH),
      ),
    ).toEqual([0, 2, 4, 5, 7])
    expect(five.brackets).toEqual([])
    expect(eight.brackets).toHaveLength(2)
  })

  it('runs its rows from do to so on a phone, each the taller, and keeps the widest column, centred', () => {
    // Act
    const five = stairsLayout('narrow', 356, 424, 67, C4, FIVE)
    const eight = stairsLayout('narrow', 356, 424, 67, C4)
    const narrowFive = stairsLayout('narrow', 300, 424, 67, C4, FIVE)

    // Assert: eight rows where eight stairs take thirteen
    expect(five.rowH).toBeCloseTo((eight.rowH * 13) / 8, 6)
    expect(five.rows[0]).toBeLessThanOrEqual(67)
    expect(five.rows[five.rows.length - 1]).toBeGreaterThanOrEqual(74)
    expect(five.rows.filter((m) => m > 75)).toEqual([])
    // the top stair's tread on the top row, as eight stairs' top do is
    expect(five.stairs[4].top).toBeCloseTo(eight.stairs[7].top, 6)
    // 64 px columns in the middle of a 356 px figure; all of a narrower one
    expect(five.stairs.map((st) => st.w)).toEqual(Array(5).fill(64))
    expect(five.x0).toBe(18)
    expect(five.x1).toBe(338)
    expect(narrowFive.stairs.map((st) => st.w)).toEqual(Array(5).fill(60))
  })

  it('keeps each stair over its own white key on a phone', () => {
    // Act: G4 to D4 over G, A, B, C, D
    const five = stairsLayout('narrow', 356, 424, 67, C4, FIVE)
    const whites = (five.strip?.keys ?? []).filter(
      (k) => k.white && k.cx > five.x0 && k.cx < five.x1,
    )

    // Assert
    expect(whites.map((k) => k.midi)).toEqual([67, 69, 71, 72, 74])
    whites.forEach((k, i) =>
      expect(k.cx).toBeCloseTo(five.stairs[i].x + five.stairs[i].w / 2, 6),
    )
  })
})

describe("a pentatonic's six stairs (Lesson 20)", () => {
  it('draws do, re, mi, so, la and do at their own heights, the risers 2, 2, 3, 2 and 3 rows', () => {
    // Act: on C4, on a phone's figure
    const L = stairsLayout('narrow', 356, 424, C4, C4, MAJOR_FIVE)

    // Assert
    expect(L.stairs).toHaveLength(6)
    expect(
      L.stairs.map((st) => Math.round((L.stairs[0].top - st.top) / L.rowH)),
    ).toEqual([0, 2, 4, 7, 9, 12])
    expect(L.brackets).toEqual([])
  })

  it("draws the minor five's first riser three rows, from la", () => {
    // Act
    const L = stairsLayout('narrow', 356, 424, 57, C4 - 12, MINOR_FIVE)

    // Assert
    expect(
      L.stairs.map((st) => Math.round((L.stairs[0].top - st.top) / L.rowH)),
    ).toEqual([0, 3, 5, 7, 10, 12])
  })

  it("shows the octave's eight white keys under six columns on a phone, each a fingertip wide", () => {
    // Act
    const L = stairsLayout('narrow', 356, 424, C4, C4, MAJOR_FIVE)
    const whites = (L.strip?.keys ?? []).filter(
      (k) => k.white && k.cx > L.x0 && k.cx < L.x1,
    )

    // Assert: C4 to C5, the scale's thirteen rows, six columns of 59 px
    expect(whites.map((k) => k.midi)).toEqual([60, 62, 64, 65, 67, 69, 71, 72])
    expect(L.rows[0]).toBeLessThanOrEqual(60)
    expect(L.rows.filter((m) => m > 73)).toEqual([])
    expect(L.stairs.every((st) => st.w >= TARGET)).toBe(true)
    expect(L.x1 - L.x0).toBe(356)
  })
})

describe("a compact staircase's own rows and room (Lesson 25)", () => {
  /** Lesson 25's steps' figure for the lower voice: rows A2 to C4, 104 px kept for the chord column. */
  const ROOM = { right: 104, rows: { lo: 45, hi: 60 } }
  const C2 = 36
  const minorOnA = stairsLayout(
    'compact',
    420,
    280,
    45,
    C2,
    NATURAL_MINOR_DEGREES,
    ROOM,
  )

  it('keeps 104 px at its right for the chord column, the stairs sharing the rest', () => {
    // Arrange
    const plain = stairsLayout(
      'compact',
      420,
      280,
      45,
      C2,
      NATURAL_MINOR_DEGREES,
    )
    const top = minorOnA.stairs[7]

    // Assert
    expect(plain.x1 - minorOnA.x1).toBe(104)
    expect(top.x + top.w).toBeCloseTo(minorOnA.x1, 9)
  })

  it("shows its own sixteen rows, A2 to C4, do on the lowest and the chord on so's B3 inside them", () => {
    // Assert
    expect(minorOnA.rows).toEqual(Array.from({ length: 16 }, (_, k) => 45 + k))
    expect(minorOnA.stairs[0].top).toBeCloseTo(
      minorOnA.yOfRow(45) - minorOnA.rowH / 2,
      9,
    )
    expect(minorOnA.yOfRow(59) - minorOnA.rowH / 2).toBeGreaterThan(
      minorOnA.rowsTop,
    )
  })

  it("holds C major on C3 and A minor on A2 on the same still rows, so do's house can glide between them (Step 4)", () => {
    // Act
    const majorOnC = stairsLayout(
      'compact',
      420,
      280,
      48,
      C2,
      MAJOR_DEGREES,
      ROOM,
    )

    // Assert: one row per pitch on both, do three rows apart, and C
    // major's la, A3, A minor's top do
    expect(majorOnC.yOfRow(57)).toBeCloseTo(minorOnA.yOfRow(57), 9)
    expect(minorOnA.stairs[0].top - majorOnC.stairs[0].top).toBeCloseTo(
      3 * minorOnA.rowH,
      9,
    )
    expect(majorOnC.stairs[5].top).toBeCloseTo(minorOnA.stairs[7].top, 9)
  })

  it('lifts its rows for a scale that reaches past them, as past the fifteen from its floor', () => {
    // Act: A minor on A3 over rows that stop at C4
    const L = stairsLayout(
      'compact',
      420,
      280,
      57,
      C2,
      NATURAL_MINOR_DEGREES,
      ROOM,
    )

    // Assert: its top do, A4, the top row
    expect(L.stairs[7].top).toBeCloseTo(L.rowsTop, 9)
  })

  it('takes no room in the wide and narrow layouts', () => {
    // Act
    const wideRoomy = stairsLayout(
      'wide',
      650,
      476,
      60,
      C4,
      MAJOR_DEGREES,
      ROOM,
    )
    const narrowRoomy = stairsLayout(
      'narrow',
      356,
      424,
      60,
      C4,
      MAJOR_DEGREES,
      ROOM,
    )

    // Assert
    expect([wideRoomy.x1, wideRoomy.rows]).toEqual([wide(60).x1, wide(60).rows])
    expect([narrowRoomy.x1, narrowRoomy.rows]).toEqual([
      narrow(60).x1,
      narrow(60).rows,
    ])
  })
})
