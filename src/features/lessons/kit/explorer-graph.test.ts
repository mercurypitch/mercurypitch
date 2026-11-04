// ============================================================
// Lesson explorer map tests — node labels keep apart on a narrow map
// ============================================================
//
// At 1024 px wide (an iPad held sideways, an iPad Pro upright) the map is
// 958 px across and its columns 55.5 px, and 150 px labels ran into each
// other: "Twelve notes" into "Major scale", "Beat and tempo" into "Major
// and minor". Below 1100 px of map each label keeps to its share of its
// lane, and a long name wraps.

import { describe, expect, it } from 'vitest'
import { labelLeans, labelWidths, LANE_Y, laneBands, nodeLabel, } from './explorer-graph'
import type { Lesson } from './season'
import { LESSONS } from './season'
import { LESSONS_2 } from './season-2'

/** A label's box along its lane, px, from the inline styles that place it. */
interface Box {
  readonly n: number
  readonly left: number
  readonly right: number
}

/** Every lane label of `lessons` on a map `mapW` px wide, its nodes a column apart, as boxes by lane. */
function laneBoxes(
  mapW: number,
  lessons: readonly Lesson[] = LESSONS,
): Box[][] {
  const colW = (mapW - 126) / 15
  const leans = labelLeans(lessons)
  const widths = labelWidths(mapW, colW, leans, lessons)
  return (['theory', 'voice'] as const).map((lane) =>
    lessons
      .filter((L) => L.lane === lane)
      .map((L) => {
        const el = nodeLabel(
          L,
          { x: L.n * colW, y: LANE_Y[lane] },
          leans.get(L.n),
          widths.get(L.n),
        )
        const left =
          parseFloat(el.style.left) + (parseFloat(el.style.marginLeft) || 0)
        return { n: L.n, left, right: left + parseFloat(el.style.width) }
      }),
  )
}

/** The air between each label and the next along its lane, px. */
const gaps = (lanes: Box[][]): number[] =>
  lanes.flatMap((boxes) =>
    boxes.slice(1).map((b, i) => b.left - boxes[i].right),
  )

describe("the map's lane labels", () => {
  it('keep 8 px or more between neighbours along a lane on any map under 1100 px wide', () => {
    // Act: from the narrowest map, beside an 861 px screen, to just under 1100 px
    const narrowest = [795, 900, 958, 1014, 1067, 1099].map((w) =>
      Math.min(...gaps(laneBoxes(w))),
    )

    // Assert: shares keep 12 px; Lessons 1 and 2, which lean apart, a column less 36 px
    for (const gap of narrowest) expect(gap).toBeGreaterThanOrEqual(8)
  })

  it("keep 8 px or more apart on Season 2's map too", () => {
    // Act
    const narrowest = [795, 958, 1099].map((w) =>
      Math.min(...gaps(laneBoxes(w, LESSONS_2))),
    )

    // Assert
    for (const gap of narrowest) expect(gap).toBeGreaterThanOrEqual(8)
  })

  it('give a long name its share of the lane at 1024 px, so it wraps instead of touching', () => {
    // Act: the map at 1024 px wide, 958 px across
    const widths = labelWidths(
      958,
      (958 - 126) / 15,
      labelLeans(LESSONS),
      LESSONS,
    )

    // Assert: centred, two columns less 12 px; leaning right, one column and 12 px; nothing before Lesson 1
    expect(widths.get(4)).toBeCloseTo(98.9, 1)
    expect(widths.get(2)).toBeCloseTo(67.5, 1)
    expect(widths.get(1)).toBe(150)
  })

  it('leave every label 150 px wide on a map 1100 px wide or more', () => {
    // Act
    const widths = labelWidths(
      1100,
      (1100 - 126) / 15,
      labelLeans(LESSONS),
      LESSONS,
    )

    // Assert
    expect(new Set(widths.values())).toEqual(new Set([150]))
  })
})

describe("the map's lane bands", () => {
  it("count each season's lessons by lane, its finale with voice", () => {
    expect(laneBands(LESSONS)).toEqual([
      ['theory', 'Theory', '7 lessons'],
      ['voice', 'Voice', '6 lessons + 14'],
    ])
    expect(laneBands(LESSONS_2)).toEqual([
      ['theory', 'Theory', '7 lessons'],
      ['voice', 'Voice', '6 lessons + 28'],
    ])
  })
})
