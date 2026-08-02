// ============================================================
// Zen Canvas Renderer tests — time-grid alignment contracts
// ============================================================

import { describe, expect, it } from 'vitest'
import { resolveZenTimeGrid } from '@/features/zen/zen-canvas-renderer'

describe('resolveZenTimeGrid', () => {
  it('aligns an authored challenge grid to whole beats', () => {
    const grid = resolveZenTimeGrid(7, 2048, 1)

    expect(grid).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
    expect(grid).toContain(2)
  })

  it('keeps the loop seam when the musical interval does not divide evenly', () => {
    expect(resolveZenTimeGrid(7.5, 1000, 1)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 7.5,
    ])
  })

  it('preserves the quiet fixed-division grid for plain Zen sessions', () => {
    const grid = resolveZenTimeGrid(7, 2048)

    expect(grid).toHaveLength(9)
    expect(grid[2]).toBe(1.75)
    expect(grid.at(-1)).toBe(7)
  })
})
