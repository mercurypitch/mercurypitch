// Camera preset tests protect responsive framing and bounded phrase following.
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

  it('bounds phrase following so it never throws the runway off stage', () => {
    expect(
      tabCameraPreset('phrase-focus', {
        narrow: false,
        phraseFocusX: 20,
      }).target[0],
    ).toBe(2.6)
    expect(
      tabCameraPreset('phrase-focus', {
        narrow: false,
        phraseFocusX: -20,
      }).target[0],
    ).toBe(-2.6)
  })
})
