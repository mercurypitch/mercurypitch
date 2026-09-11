// Camera preset tests protect fixed responsive framing and isolated manual controls.
// ============================================================

import { describe, expect, it } from 'vitest'
import { tabCameraPreset } from './camera-presets'

describe('tabCameraPreset', () => {
  it('keeps the established wide and portrait Flow framing', () => {
    expect(tabCameraPreset('flow', { narrow: false })).toMatchObject({
      pitch: 0.55,
      radius: 21,
      target: [0, -2, -12],
    })
    expect(tabCameraPreset('flow', { narrow: true })).toMatchObject({
      pitch: 0.75,
      radius: 32,
      target: [0, 2, -12],
    })
  })

  it('gives each deliberate framing a distinct distance', () => {
    const flow = tabCameraPreset('flow', { narrow: false })
    const player = tabCameraPreset('player-neck', { narrow: false })
    const full = tabCameraPreset('full-neck', { narrow: false })

    expect(player.radius).toBeLessThan(flow.radius)
    expect(full.radius).toBeGreaterThan(flow.radius)
  })

  it('returns independent camera and target objects for manual controls', () => {
    const first = tabCameraPreset('flow', { narrow: false })
    first.radius = 2
    const next = tabCameraPreset('flow', { narrow: false })
    expect(next.radius).toBe(21)
    expect(next.target).toEqual([0, -2, -12])
    expect(next.target).not.toBe(first.target)
  })
})
