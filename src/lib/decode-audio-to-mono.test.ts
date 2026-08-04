// ============================================================
// Audio decode to mono tests — channel folding stays source-independent
// ============================================================

import { describe, expect, it } from 'vitest'
import { mixAudioChannelsToMono } from './decode-audio-to-mono'

describe('mixAudioChannelsToMono', () => {
  it('copies a mono channel instead of returning its mutable source view', () => {
    const source = new Float32Array([0.2, -0.4])
    const result = mixAudioChannelsToMono([source])

    source[0] = 1
    expect(Array.from(result)).toEqual([
      expect.closeTo(0.2, 5),
      expect.closeTo(-0.4, 5),
    ])
  })

  it('mixes every channel with equal weight', () => {
    const result = mixAudioChannelsToMono([
      new Float32Array([1, -1, 0.5]),
      new Float32Array([-1, 1, 0.5]),
      new Float32Array([0.5, 0.5, 0.5]),
    ])

    expect(Array.from(result)).toEqual([
      expect.closeTo(1 / 6, 5),
      expect.closeTo(1 / 6, 5),
      expect.closeTo(0.5, 5),
    ])
  })

  it('uses the shortest channel when malformed channel lengths differ', () => {
    const result = mixAudioChannelsToMono([
      new Float32Array([1, 1, 1]),
      new Float32Array([0, 0]),
    ])

    expect(Array.from(result)).toEqual([0.5, 0.5])
  })
})
