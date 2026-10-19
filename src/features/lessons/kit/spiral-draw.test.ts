// ============================================================
// Lesson spiral drawing tests — the view from above, and a page's own keys
// ============================================================

import { describe, expect, it } from 'vitest'
import './browser-doubles.test-fixtures'
import type { KeysLayer, SpiralView } from './spiral-draw'
import { drawSpiral } from './spiral-draw'
import type { KeyHit } from './spiral-keys'

function view(over: Partial<SpiralView> = {}): SpiralView {
  return {
    yaw: 0,
    u: 0,
    labels: 'letter',
    lit: new Set(),
    narrow: false,
    pan: 0,
    focused: false,
    sel: 12,
    pulses: new Map(),
    keyLabels: 'landmarks',
    span: null,
    spelling: 'sharps',
    ...over,
  }
}

function context(): CanvasRenderingContext2D {
  const ctx = document.createElement('canvas').getContext('2d')
  if (ctx === null) throw new Error('no context')
  return ctx
}

describe('drawSpiral', () => {
  it('draws every bead from the side, and only the lit turn from straight above', () => {
    // Arrange
    const ctx = context()

    // Act
    const side = drawSpiral(ctx, 640, 380, 0, view()).hits
    const above = drawSpiral(ctx, 640, 380, 0, view({ top: 1 })).hits

    // Assert: 37 beads, then the twelve of A3 to G♯4
    expect(side).toHaveLength(37)
    expect(above.map((h) => h.s).sort((a, b) => a - b)).toEqual([
      12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23,
    ])
  })

  it('lays the ring of twelve out as a circle, a bead every 30 degrees', () => {
    // Arrange
    const above = drawSpiral(context(), 640, 380, 0, view({ top: 1 })).hits
    const cx = above.reduce((n, h) => n + h.x, 0) / above.length
    const cy = above.reduce((n, h) => n + h.y, 0) / above.length

    // Act
    const radii = above.map((h) => Math.hypot(h.x - cx, h.y - cy))
    const angles = above
      .map((h) => Math.atan2(h.y - cy, h.x - cx))
      .sort((a, b) => a - b)
    const gaps = angles.slice(1).map((a, i) => a - angles[i])

    // Assert
    for (const r of radii) expect(r).toBeCloseTo(radii[0], 6)
    for (const g of gaps) expect(g).toBeCloseTo(Math.PI / 6, 6)
  })

  it("unrolls the beads onto a page's own keys and taps on its own targets", () => {
    // Arrange: a layer that puts every key on one line, 10 px apart
    const target: KeyHit = { s: 12, x: 100, y: 50, w: 44, h: 100, white: true }
    const faded: number[] = []
    const layer: KeysLayer = {
      keyPos: (s) => ({ x: 10 * s, y: 77 }),
      draw: (_ctx, ka) => {
        faded.push(ka)
        return [target]
      },
    }

    // Act: fully unrolled
    const drawn = drawSpiral(context(), 640, 380, 0, view({ u: 1, layer }))

    // Assert: the keys came from the layer, and A3's bead sits on its key
    expect(drawn.keyHits).toEqual([target])
    expect(faded).toEqual([1])
    const a3 = drawn.hits.find((h) => h.s === 12)
    expect([a3?.x, a3?.y]).toEqual([120, 77])
  })
})
