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

describe('machineLayout', () => {
  it('gives every cell 44 px each way, apart from every other and from the labels, at every width', () => {
    for (const w of WIDTHS)
      for (const state of GRIDS)
        for (const beats of [2, 3, 4]) {
          // Act
          const l = machineLayout(state, w, 250, beats)
          const cells = l.cells.flat()

          // Assert
          expect(l.compact).toBe(false)
          for (const c of cells) {
            expect(c.w).toBeGreaterThanOrEqual(44)
            expect(c.h).toBeGreaterThanOrEqual(44)
            expect(inside(c, w, 250)).toBe(true)
          }
          for (let i = 0; i < cells.length; i++)
            for (let j = i + 1; j < cells.length; j++)
              expect(overlaps(cells[i], cells[j])).toBe(false)
          for (const label of l.labels)
            for (const c of cells) expect(overlaps(label, c)).toBe(false)
        }
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
    for (const w of WIDTHS) {
      // Act
      const l = machineLayout('patterns', w, 140, 4)
      const cells = l.cells.flat()

      // Assert
      expect(l.compact).toBe(true)
      for (const c of cells) {
        expect(inside(c, w, 140)).toBe(true)
        expect(c.h).toBeGreaterThanOrEqual(44)
        expect(c.w).toBeGreaterThanOrEqual(44)
      }
      // each number sits in its column's first cell's corner
      l.pads.forEach((p, i) => {
        expect(p.x).toBeGreaterThan(l.cells[0][i].x)
        expect(p.y).toBeGreaterThan(l.cells[0][i].y)
      })
    }
    expect(machineLayout('grid', 600, 181, 4).compact).toBe(true)
    expect(machineLayout('grid', 600, 182, 4).compact).toBe(false)
  })

  it("keeps free play's taps readout clear of the grid at every width", () => {
    for (const w of WIDTHS)
      for (const beats of [2, 3, 4]) {
        // Act
        const l = machineLayout('free', w, 250, beats)
        const read = freeReadBox(w, 250)

        // Assert
        for (const c of l.cells.flat()) expect(overlaps(read, c)).toBe(false)
      }
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
