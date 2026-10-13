// ============================================================
// The voice ribbon's stops and strokes, as both rooms draw them
// ============================================================

import { describe, expect, it } from 'vitest'
import type { RibbonStop } from './ribbon'
import { CORE, layerColour, ribbonStops, strokeLayers } from './ribbon'

describe('ribbonStops', () => {
  const tints = [
    { at: 0, off: 0 },
    { at: 0.5, off: 1 },
    { at: 1, off: 1 },
  ]

  it('runs end to end at full strength with no fade', () => {
    expect(ribbonStops(tints, 1, 0)).toEqual([
      { at: 0, off: 0, fade: 1 },
      { at: 0.5, off: 1, fade: 1 },
      { at: 1, off: 1, fade: 1 },
    ])
  })

  it('fades in from the old end and adds a stop where the fade stops', () => {
    const stops = ribbonStops(tints, 1, 0.25)
    expect(stops.map((s) => s.at)).toEqual([0, 0.25, 0.5, 1])
    expect(stops[0].fade).toBe(0)
    expect(stops[1]).toEqual({ at: 0.25, off: 0.5, fade: 1 })
    expect(stops.slice(1).every((s) => s.fade === 1)).toBe(true)
  })

  it('scales the amber as the line dims', () => {
    expect(ribbonStops(tints, 0.5, 0).map((s) => s.off)).toEqual([0, 0.5, 0.5])
  })
})

describe('strokeLayers', () => {
  it('strokes each layer once, its gradient along the ribbon from end to end', () => {
    const gradients: Array<{ from: number; to: number; stops: unknown[] }> = []
    const widths: number[] = []
    const ctx = {
      lineJoin: '',
      lineCap: '',
      lineWidth: 0,
      strokeStyle: null as unknown,
      createLinearGradient(x0: number, _y0: number, x1: number) {
        const g = { from: x0, to: x1, stops: [] as unknown[] }
        gradients.push(g)
        return {
          addColorStop: (at: number, colour: string) =>
            g.stops.push([at, colour]),
        }
      },
      stroke() {
        widths.push(ctx.lineWidth)
      },
    }
    const stops: RibbonStop[] = [
      { at: 0, off: 0, fade: 1 },
      { at: 1, off: 1, fade: 1 },
    ]

    strokeLayers(
      ctx as unknown as CanvasRenderingContext2D,
      CORE,
      stops,
      40,
      300,
      2,
    )

    expect(widths).toEqual(CORE.map((layer) => layer.width * 2))
    expect(gradients.map((g) => [g.from, g.to])).toEqual([
      [40, 300],
      [40, 300],
    ])
    expect(gradients[0].stops).toEqual([
      [0, layerColour(CORE[0], 0, 1)],
      [1, layerColour(CORE[0], 1, 1)],
    ])
    expect(ctx.lineCap).toBe('round')
  })
})
