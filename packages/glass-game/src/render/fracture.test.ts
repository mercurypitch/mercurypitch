// Matched-fracture regression — every surface and UV survives intact-to-shard assembly.
import type { BufferGeometry } from 'three'
import { describe, expect, it } from 'vitest'
import { BREAKABLE_RENDER_CATALOG } from './catalog'
import { fractureGeometry } from './fracture'
import { createVesselGeometry } from './vessels'

function vertices(
  geometry: BufferGeometry,
  offset = { x: 0, y: 0, z: 0 },
): number[][] {
  const source = geometry.index ? geometry.toNonIndexed() : geometry
  const position = source.getAttribute('position')
  const uv = source.getAttribute('uv')
  const values = Array.from({ length: position.count }, (_, i) => [
    position.getX(i) + offset.x,
    position.getY(i) + offset.y,
    position.getZ(i) + offset.z,
    uv.getX(i),
    uv.getY(i),
  ])
  if (source !== geometry) source.dispose()
  return values
}

describe('matched vessel fracture', () => {
  it('keeps every procedural fallback at its recipe height and floor origin', () => {
    for (const [variant, recipe] of Object.entries(BREAKABLE_RENDER_CATALOG)) {
      const geometry = createVesselGeometry(variant)
      geometry.computeBoundingBox()
      const bounds = geometry.boundingBox!
      expect(bounds.min.y).toBeCloseTo(0, 6)
      expect(bounds.max.y - bounds.min.y).toBeCloseTo(recipe.displayHeight, 6)
      geometry.dispose()
    }
  })
  for (const variant of ['goblet', 'vase', 'fluted', 'portrait']) {
    it(`retains the complete ${variant} surface and UVs within a fixed piece budget`, () => {
      const intact = createVesselGeometry(variant)
      const pieces = fractureGeometry(intact, 18)
      expect(pieces.length).toBeGreaterThan(6)
      expect(pieces.length).toBeLessThanOrEqual(18)
      const original = vertices(intact)
      const reassembled = pieces.flatMap((piece) =>
        vertices(piece.geometry, piece.centre),
      )
      expect(reassembled.length).toBe(original.length)
      const byUV = new Map<string, number[][]>()
      for (const vertex of reassembled) {
        const key = vertex.slice(3).join(',')
        const bucket = byUV.get(key) ?? []
        bucket.push(vertex)
        byUV.set(key, bucket)
      }
      for (const vertex of original) {
        const bucket = byUV.get(vertex.slice(3).join(',')) ?? []
        // Pivot subtraction is Float32; verify micrometre agreement, not decimal
        // rounding bins that arbitrarily split the same boundary coordinate.
        const match = bucket.findIndex((item) =>
          item
            .slice(0, 3)
            .every((value, axis) => Math.abs(value - vertex[axis]) < 1e-6),
        )
        expect(match).toBeGreaterThanOrEqual(0)
        bucket.splice(match, 1)
      }
      expect([...byUV.values()].every((bucket) => bucket.length === 0)).toBe(
        true,
      )
      for (const piece of pieces) piece.geometry.dispose()
      intact.dispose()
    })
  }
})
