// The beat machine's targets at every width (Lesson 8 WEB-SPEC, Tests 12;
// FACTS 80): every cell is a 44 px target, none overlaps another or its
// lane's label, and under a 182 px figure the grid fits 140 px.

import { describe, expect, it } from 'vitest'
import type { MachineState, Rect } from './beat-layout'
import { COMPACT_UNDER, freeReadBox, FULL_GRID_H, GRID, machineLayout, overlaps, } from './beat-layout'

/** Figure widths: the narrowest phone's figure (a 344 px page) to a wide desktop's. */
const WIDTHS = Array.from(
  { length: (1440 - 280) / 8 + 1 },
  (_, i) => 280 + i * 8,
)
const GRIDS: readonly MachineState[] = ['grid', 'patterns', 'free']
const inside = (r: Rect, w: number, h: number): boolean =>
  r.x >= 0 && r.y >= 0 && r.x + r.w <= w + 1e-9 && r.y + r.h <= h + 1e-9

// The sweeps below check every cell of every layout, close to a million
// facts. One expect each made the first sweep take two seconds alone and
// time out under load, so each sweep writes down what breaks, as "width,
// state, beats: the part and the rule", and asserts once that nothing did.

/** A layout's cells, each with its name: lane, then beat. */
const namedCells = (cells: readonly (readonly Rect[])[]) =>
  cells.flatMap((lane, i) =>
    lane.map((r, j) => ({ r, name: `cell ${i}:${j}` })),
  )

describe('machineLayout', () => {
  it('gives every cell 44 px each way, apart from every other and from the labels, at every width', () => {
    // Act
    const failures: string[] = []
    for (const w of WIDTHS)
      for (const state of GRIDS)
        for (const beats of [2, 3, 4]) {
          const l = machineLayout(state, w, 250, beats)
          const at = `${w} px, ${state}, ${beats} beats`
          const cells = namedCells(l.cells)
          if (l.compact) failures.push(`${at}: compact`)
          for (const { r, name } of cells) {
            if (!(r.w >= 44)) failures.push(`${at}: ${name} under 44 px wide`)
            if (!(r.h >= 44)) failures.push(`${at}: ${name} under 44 px tall`)
            if (!inside(r, w, 250))
              failures.push(`${at}: ${name} outside the figure`)
          }
          for (let i = 0; i < cells.length; i++)
            for (let j = i + 1; j < cells.length; j++)
              if (overlaps(cells[i].r, cells[j].r))
                failures.push(
                  `${at}: ${cells[i].name} overlaps ${cells[j].name}`,
                )
          l.labels.forEach((label, k) => {
            for (const { r, name } of cells)
              if (overlaps(label, r))
                failures.push(`${at}: label ${k} overlaps ${name}`)
          })
        }

    // Assert
    expect(failures).toEqual([])
  })

  it('takes 182 px for the band, the number strip and three lanes, the cells 4 px apart', () => {
    // Act
    const l = machineLayout('grid', 600, 250, 4)
    const [kick, clap] = l.cells

    // Assert
    expect(FULL_GRID_H).toBe(182)
    expect(COMPACT_UNDER).toBe(182)
    expect(clap[0].y - (kick[0].y + kick[0].h)).toBe(GRID.gap)
    expect(kick[1].x - (kick[0].x + kick[0].w)).toBe(GRID.gap)
    // the number strip sits over each column
    l.pads.forEach((p, i) => {
      expect(p.x).toBe(kick[i].x)
      expect(p.y + p.h).toBeLessThanOrEqual(kick[i].y)
    })
  })

  it('takes the compact layout under a 182 px figure, which fits 140 px', () => {
    // Act
    const failures: string[] = []
    for (const w of WIDTHS) {
      const l = machineLayout('patterns', w, 140, 4)
      const at = `${w} px`
      if (!l.compact) failures.push(`${at}: not compact`)
      for (const { r, name } of namedCells(l.cells)) {
        if (!inside(r, w, 140)) failures.push(`${at}: ${name} outside 140 px`)
        if (!(r.h >= 44)) failures.push(`${at}: ${name} under 44 px tall`)
        if (!(r.w >= 44)) failures.push(`${at}: ${name} under 44 px wide`)
      }
      // each number sits in its column's first cell's corner
      l.pads.forEach((p, i) => {
        if (!(p.x > l.cells[0][i].x))
          failures.push(`${at}: number ${i} left of its cell`)
        if (!(p.y > l.cells[0][i].y))
          failures.push(`${at}: number ${i} above its cell`)
      })
    }

    // Assert
    expect(failures).toEqual([])
    expect(machineLayout('grid', 600, 181, 4).compact).toBe(true)
    expect(machineLayout('grid', 600, 182, 4).compact).toBe(false)
  })

  it("keeps free play's taps readout clear of the grid at every width", () => {
    // Act
    const failures: string[] = []
    for (const w of WIDTHS)
      for (const beats of [2, 3, 4]) {
        const l = machineLayout('free', w, 250, beats)
        const read = freeReadBox(w, 250)
        for (const { r, name } of namedCells(l.cells))
          if (overlaps(read, r))
            failures.push(`${w} px, ${beats} beats: ${name} under the readout`)
      }

    // Assert
    expect(failures).toEqual([])
  })

  it('stands the tall metronome inside the figure, its lamp under its foot, beside the readouts', () => {
    for (const w of WIDTHS) {
      // Act
      const l = machineLayout('tempo', w, 250, 4)

      // Assert
      expect(inside(l.metro, w, 250)).toBe(true)
      expect(inside(l.lamp, w, 250)).toBe(true)
      expect(l.lamp.y).toBeGreaterThan(l.metro.y + l.metro.h)
      expect(l.metro.h).toBeLessThanOrEqual(GRID.tallMetro)
      // clear of the readouts' column at the left
      expect(l.metro.x).toBeGreaterThanOrEqual(GRID.readW)
    }
  })

  it("lays the bars state's pads one a beat, 64 px tall, the small metronome above the first", () => {
    for (const beats of [2, 3, 4]) {
      // Act
      const l = machineLayout('bars', 390, 250, beats)

      // Assert
      expect(l.pads).toHaveLength(beats)
      for (const p of l.pads) expect(p.h).toBe(GRID.padH)
      expect(l.metro.h).toBe(GRID.smallMetro)
      expect(l.metro.y + l.metro.h).toBeLessThanOrEqual(l.pads[0].y)
    }
  })
})
