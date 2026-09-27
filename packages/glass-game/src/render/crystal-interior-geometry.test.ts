import { describe, expect, it } from 'vitest'
import { normalizeCrystalInteriorSettings } from './crystal-interior-config'
import { generateCrystalInteriorLayout } from './crystal-interior-geometry'

function settings(seed: number) {
  return normalizeCrystalInteriorSettings({
    preset: 'resonance-veins',
    seed,
    envelope: { width: 2.2, height: 0.34, depth: 0.82, inset: 0.04 },
  })
}

describe('crystal interior layout generation', () => {
  it('rebuilds the same path graph from the same stable seed', () => {
    const first = generateCrystalInteriorLayout(settings(9182))
    const second = generateCrystalInteriorLayout(settings(9182))

    expect(second).toEqual(first)
    expect(generateCrystalInteriorLayout(settings(9183))).not.toEqual(first)
  })

  it.each(['resonance-veins', 'frost-roots', 'aurora-heart'] as const)(
    'keeps every %s path and accent inside the explicitly inset volume',
    (preset) => {
      const normalized = normalizeCrystalInteriorSettings({
        preset,
        seed: 771,
        envelope: {
          width: 2.4,
          height: 0.38,
          depth: 0.9,
          center: [0.2, -0.22, -0.1],
          inset: 0.05,
        },
      })
      const layout = generateCrystalInteriorLayout(normalized)
      const { width, height, depth, center, inset } = normalized.envelope
      const minimum = [
        center[0] - width / 2 + inset,
        center[1] - height / 2 + inset,
        center[2] - depth / 2 + inset,
      ]
      const maximum = [
        center[0] + width / 2 - inset,
        center[1] + height / 2 - inset,
        center[2] + depth / 2 - inset,
      ]

      const points = [
        ...layout.paths.flatMap((path) => path.points),
        ...layout.sparkles.map((sparkle) => sparkle.position),
      ]
      expect(points.length).toBeGreaterThan(20)
      for (const point of points)
        point.forEach((value, axis) => {
          expect(value).toBeGreaterThanOrEqual(minimum[axis]!)
          expect(value).toBeLessThanOrEqual(maximum[axis]!)
        })
    },
  )
})
