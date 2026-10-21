// Journey ivy tests — protect blade shape, continuous attachment and actual world clearances.

import { InstancedMesh, Matrix4, MeshStandardMaterial, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { FLOATING_MUSEUM_JOURNEY } from '../content/museum-journey'
import { createJourneyIvy, createJourneyIvyLeafGeometry, createJourneyIvyPlacement, } from './ivy'
import { clearsJourneyLandmarks, rimPoint } from './vegetation-placement'

describe('hanging museum ivy', () => {
  it('builds a thin bent blade with finite opposing surface normals and no degenerate faces', () => {
    const geometry = createJourneyIvyLeafGeometry()
    try {
      const positions = geometry.getAttribute('position')
      const normals = geometry.getAttribute('normal')
      const indices = geometry.index!
      const a = new Vector3()
      const b = new Vector3()
      const c = new Vector3()
      for (let index = 0; index < indices.count; index += 3) {
        a.fromBufferAttribute(positions, indices.getX(index))
        b.fromBufferAttribute(positions, indices.getX(index + 1))
        c.fromBufferAttribute(positions, indices.getX(index + 2))
        expect(b.sub(a).cross(c.sub(a)).length()).toBeGreaterThan(0.00001)
      }
      for (let index = 0; index < positions.count / 2; index++) {
        a.fromBufferAttribute(normals, index)
        b.fromBufferAttribute(normals, index + positions.count / 2)
        expect(a.length()).toBeCloseTo(1, 5)
        expect(a.dot(b)).toBeCloseTo(-1, 5)
      }
      geometry.computeBoundingBox()
      const size = geometry.boundingBox!.getSize(new Vector3())
      expect(size.z).toBeGreaterThan(0.03)
      expect(size.z).toBeLessThan(size.x / 3)
      // The blade's attachment is a real vertex, so a petiole can meet it.
      expect(new Vector3().fromBufferAttribute(positions, 1).length()).toBe(0)
    } finally {
      geometry.dispose()
    }
  })

  it('roots every continuous strand on an existing rim anchor and keeps full blades clear', () => {
    const strands = createJourneyIvyPlacement(FLOATING_MUSEUM_JOURNEY)
    const geometry = createJourneyIvyLeafGeometry()
    try {
      expect(strands.length).toBeGreaterThan(0)
      const lengths = new Set<number>()
      for (const strand of strands) {
        const islandIndex = FLOATING_MUSEUM_JOURNEY.landmasses.findIndex(
          (island) => island.id === strand.islandId,
        )
        const island = FLOATING_MUSEUM_JOURNEY.landmasses[islandIndex]!
        const anchors = Array.from({ length: 8 }, (_, index) =>
          rimPoint(
            island,
            Math.PI * (0.04 + index * 0.13) + islandIndex * 0.19,
            1.02,
          ),
        )
        expect(
          Math.min(
            ...anchors.map((anchor) => anchor.distanceTo(strand.points[0]!)),
          ),
        ).toBeLessThan(0.000001)
        for (let index = 1; index < strand.points.length; index++) {
          const previous = strand.points[index - 1]!
          const point = strand.points[index]!
          expect(point.y).toBeLessThan(previous.y)
          expect(point.distanceTo(previous)).toBeLessThan(0.24)
        }
        lengths.add(
          Math.round((strand.points[0]!.y - strand.points.at(-1)!.y) * 100),
        )
        for (const leaf of strand.leaves) {
          const positions = geometry.getAttribute('position')
          for (let index = 0; index < positions.count; index++) {
            const point = new Vector3()
              .fromBufferAttribute(positions, index)
              .applyMatrix4(leaf.transform)
            expect(
              clearsJourneyLandmarks(FLOATING_MUSEUM_JOURNEY, point, 0.015),
            ).toBe(true)
            for (const water of FLOATING_MUSEUM_JOURNEY.spillways) {
              const dx = point.x - water.position[0]
              const dz = point.z - water.position[2]
              const across = Math.cos(water.yaw) * dx - Math.sin(water.yaw) * dz
              const depth = Math.sin(water.yaw) * dx + Math.cos(water.yaw) * dz
              expect(
                Math.abs(across) > water.width / 2 + 0.025 ||
                  Math.abs(depth) > 0.18,
              ).toBe(true)
            }
          }
        }
      }
      expect(lengths.size).toBeGreaterThan(2)
    } finally {
      geometry.dispose()
    }
  })

  it('connects the rendered stem endpoints to roots and leaf origins in three shared batches', () => {
    const material = new MeshStandardMaterial()
    const owned = new Set<ReturnType<typeof createJourneyIvyLeafGeometry>>()
    const root = createJourneyIvy(
      FLOATING_MUSEUM_JOURNEY,
      { foliage: material, darkFoliage: material },
      owned,
    )
    try {
      const stems = root.getObjectByName(
        'instanced-hanging-cliff-ivy-stems',
      ) as InstancedMesh
      const matrix = new Matrix4()
      const endpoints: Vector3[] = []
      for (let index = 0; index < stems.count; index++) {
        stems.getMatrixAt(index, matrix)
        endpoints.push(
          new Vector3(0, -0.5, 0).applyMatrix4(matrix),
          new Vector3(0, 0.5, 0).applyMatrix4(matrix),
        )
      }
      const strands = createJourneyIvyPlacement(FLOATING_MUSEUM_JOURNEY)
      const attachments = strands.flatMap((strand) => [
        strand.points[0]!,
        ...strand.leaves.map((leaf) =>
          new Vector3().setFromMatrixPosition(leaf.transform),
        ),
      ])
      for (const point of attachments)
        expect(
          Math.min(...endpoints.map((endpoint) => endpoint.distanceTo(point))),
        ).toBeLessThan(0.000001)
      expect(root.children).toHaveLength(3)
      expect(owned.size).toBe(2)
      for (const child of root.children) {
        const batch = child as InstancedMesh
        expect(batch.isInstancedMesh).toBe(true)
        expect(owned.has(batch.geometry)).toBe(true)
        const colors = batch.geometry.getAttribute('color')
        expect(colors.count).toBe(batch.geometry.getAttribute('position').count)
        for (const value of colors.array) {
          expect(Number.isFinite(value)).toBe(true)
          expect(value).toBeGreaterThan(0)
          expect(value).toBeLessThanOrEqual(1)
        }
        expect(batch.material).toBe(material)
        expect(batch.castShadow).toBe(false)
      }
    } finally {
      root.traverse((object) => {
        if (object instanceof InstancedMesh) object.dispose()
      })
      owned.forEach((geometry) => geometry.dispose())
      material.dispose()
    }
  })
})
