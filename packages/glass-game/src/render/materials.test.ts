// Museum reflection regressions — loading-only floor fill keeps metal readable without changing the world fallback.

import { DataUtils, EquirectangularReflectionMapping, HalfFloatType, LinearFilter, } from 'three'
import { expect, it } from 'vitest'
import { createReflectionTexture } from './materials'

function texel(
  texture: ReturnType<typeof createReflectionTexture>,
  x: number,
  y: number,
): readonly [number, number, number] {
  const data = texture.image.data as Float32Array | Uint16Array
  const index = (y * texture.image.width + x) * 4
  const decode = (value: number) =>
    texture.type === HalfFloatType ? DataUtils.fromHalfFloat(value) : value
  return [
    decode(data[index]!),
    decode(data[index + 1]!),
    decode(data[index + 2]!),
  ]
}

it('uses linearly filterable HDR storage without a float-linear extension', () => {
  const texture = createReflectionTexture()
  try {
    expect(texture.type).toBe(HalfFloatType)
    expect(texture.image.data).toBeInstanceOf(Uint16Array)
    expect(texture.image.data?.byteLength).toBe(512 * 256 * 4 * 2)
    expect(texture.minFilter).toBe(LinearFilter)
    expect(texture.magFilter).toBe(LinearFilter)
    expect(texture.mapping).toBe(EquirectangularReflectionMapping)
  } finally {
    texture.dispose()
  }
})

it('preserves the authored warm HDR key, cool sky and dark floor within FP16 precision', () => {
  const texture = createReflectionTexture()
  try {
    // Authored FP32 radiance anchors, before storage conversion. A normalized
    // byte texture clips the key rather than preserving its HDR radiance.
    const anchors = [
      { x: 467, y: 196, rgb: [7.2798834, 5.8960328, 3.9290655] },
      { x: 256, y: 255, rgb: [0.1781165, 0.3300689, 0.4650321] },
      { x: 256, y: 128, rgb: [0.8719538, 0.5594702, 0.3313841] },
      { x: 256, y: 0, rgb: [0.01811109, 0.03006789, 0.04503579] },
    ]
    for (const anchor of anchors) {
      const actual = texel(texture, anchor.x, anchor.y)
      anchor.rgb.forEach((radiance, channel) => {
        expect(Math.abs(actual[channel]! - radiance) / radiance).toBeLessThan(
          1 / 1024,
        )
      })
    }
    expect(texel(texture, 467, 196)[0]).toBeGreaterThan(7)
  } finally {
    texture.dispose()
  }
})

it('adds loading-studio floor light without changing the upper hemisphere', () => {
  const baseline = createReflectionTexture()
  const studio = createReflectionTexture({
    lowerHemisphereFill: [0.14, 0.18, 0.22],
  })
  try {
    const x = baseline.image.width / 2
    const lowerY = 0
    const upperY = baseline.image.height - 1
    const baselineLower = texel(baseline, x, lowerY)
    const studioLower = texel(studio, x, lowerY)

    // Exact decoded FP16 anchors keep the authored fill contract without
    // widening the old FP32 tolerances for a different storage format.
    expect(baselineLower).toEqual([
      0.018096923828125, 0.030059814453125, 0.045013427734375,
    ])
    expect(studioLower).toEqual([0.1580810546875, 0.2099609375, 0.264892578125])
    expect(texel(studio, x, upperY)).toEqual(texel(baseline, x, upperY))
  } finally {
    baseline.dispose()
    studio.dispose()
  }
})
