// ============================================================
// Lesson 2 step bars tests — one bar per step heard, two rows to compare
// ============================================================

import { describe, expect, it } from 'vitest'
import { barList, barSize, PAIR_WINDOW_MS } from './step-bars'

const B3 = 59
const C4 = 60
const D4 = 62
const E4 = 64
const F4 = 65

describe('barList', () => {
  it('draws a bar from each note to the next one heard within the window, labelled with its semitones', () => {
    const list = barList()
    expect(list.note(B3, 0)).toBeNull()
    const bc = list.note(C4, 900)
    const cd = list.note(D4, 1800)
    expect(bc && barSize(bc)).toBe(1)
    expect(cd && barSize(cd)).toBe(2)
    // B to C and C to D only share C, so they stand on one row
    expect(list.bars.map((b) => b.row)).toEqual([0, 0])
  })

  it('draws no bar for a note heard after the window, or for the same note twice', () => {
    const list = barList()
    list.note(E4, 0)
    expect(list.note(F4, PAIR_WINDOW_MS + 1)).toBeNull()
    expect(list.note(F4, PAIR_WINDOW_MS + 500)).toBeNull()
    expect(list.bars).toEqual([])
  })

  it('puts a crossing bar on the second row, and the oldest row gives way when neither has room', () => {
    const list = barList()
    list.add(C4, D4, 0)
    const crossing = list.add(B3, F4, 100)
    expect(crossing?.row).toBe(1)
    const third = list.add(C4, E4, 200)
    expect(third?.row).toBe(0)
    expect(list.bars.map((b) => [b.from, b.to])).toEqual([
      [B3, F4],
      [C4, E4],
    ])
    list.clear()
    expect(list.bars).toEqual([])
  })
})
