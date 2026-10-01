// Museum reflection regressions — loading-only floor fill keeps metal readable without changing the world fallback.

import { expect, it } from 'vitest'
import { createReflectionTexture } from './materials'

function texel(
  texture: ReturnType<typeof createReflectionTexture>,
  x: number,
  y: number,
): readonly [number, number, number] {
  const data = texture.image.data as Float32Array
  const index = (y * texture.image.width + x) * 4
  return [data[index]!, data[index + 1]!, data[index + 2]!]
}

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

    expect(baselineLower[0]).toBeCloseTo(0.01811, 5)
    expect(baselineLower[1]).toBeCloseTo(0.03007, 5)
    expect(baselineLower[2]).toBeCloseTo(0.04504, 5)
    expect(studioLower[0] - baselineLower[0]).toBeCloseTo(0.14, 4)
    expect(studioLower[1] - baselineLower[1]).toBeCloseTo(0.18, 4)
    expect(studioLower[2] - baselineLower[2]).toBeCloseTo(0.22, 4)
    expect(texel(studio, x, upperY)).toEqual(texel(baseline, x, upperY))
  } finally {
    baseline.dispose()
    studio.dispose()
  }
})
