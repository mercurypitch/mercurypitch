// `sameCamera` decides whether the camera was actually asked to move. A host
// that rebuilds its preset object on an unrelated change would otherwise drag
// the view back to the preset on every note of a song.
// ============================================================

import { describe, expect, it } from 'vitest'
import type { CameraState } from './camera'
import { sameCamera } from './camera'

const BASE: CameraState = {
  yaw: 0.4,
  pitch: -0.2,
  radius: 9,
  target: [0, 1.5, -3],
}

describe('sameCamera', () => {
  it('is true for a rebuilt object with the same framing', () => {
    // Identity is exactly what cannot be relied on here: the rebuilt object
    // is a different reference carrying the same framing.
    const rebuilt: CameraState = { ...BASE, target: [...BASE.target] }
    expect(Object.is(rebuilt, BASE)).toBe(false)
    expect(sameCamera(BASE, rebuilt)).toBe(true)
  })

  it('is false when any single axis moves', () => {
    expect(sameCamera(BASE, { ...BASE, yaw: 0.5 })).toBe(false)
    expect(sameCamera(BASE, { ...BASE, pitch: -0.1 })).toBe(false)
    expect(sameCamera(BASE, { ...BASE, radius: 9.5 })).toBe(false)
    expect(sameCamera(BASE, { ...BASE, target: [0.5, 1.5, -3] })).toBe(false)
    expect(sameCamera(BASE, { ...BASE, target: [0, 1.6, -3] })).toBe(false)
    expect(sameCamera(BASE, { ...BASE, target: [0, 1.5, -2.9] })).toBe(false)
  })

  it('ignores drift far below what an eye could resolve', () => {
    // Phrase focus recomputes the target every note, so the same framing can
    // come back a float rounding apart. Treating that as a move is what put
    // the camera back to the preset mid-playback.
    expect(sameCamera(BASE, { ...BASE, yaw: BASE.yaw + 1e-9 })).toBe(true)
    expect(sameCamera(BASE, { ...BASE, target: [1e-9, 1.5 - 1e-9, -3] })).toBe(
      true,
    )
  })

  it('still separates a change just above the epsilon', () => {
    expect(sameCamera(BASE, { ...BASE, radius: BASE.radius + 1e-5 })).toBe(
      false,
    )
  })
})
