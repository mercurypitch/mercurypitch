// Quartz garden tests — mineral geometry remains grounded, shared and bounded.

import { Box3, Matrix4, MeshBasicMaterial, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { createGardenQuartzCluster, createGardenQuartzGeometry, } from './quartz-garden'

describe('First Light quartz', () => {
  it('closes a flat buried base beneath six faceted sides and one pointed termination', () => {
    const geometry = createGardenQuartzGeometry()
    try {
      const positions = geometry.getAttribute('position')
      const normals = geometry.getAttribute('normal')
      expect(positions.count / 3).toBe(48)
      expect(geometry.boundingBox!.min.y).toBeCloseTo(-0.045)
      expect(geometry.boundingBox!.max.y).toBe(1)
      for (let index = 0; index < positions.count; index++) {
        const normal = new Vector3().fromBufferAttribute(normals, index)
        expect(normal.length()).toBeCloseTo(1)
        expect(Number.isFinite(positions.getX(index))).toBe(true)
      }
    } finally {
      geometry.dispose()
    }
  })

  it('plants all unequal spears through the supplied surface without allocating per-spear resources', () => {
    const geometry = createGardenQuartzGeometry()
    const material = new MeshBasicMaterial()
    try {
      const surfaceY = -0.025 / 0.94
      const cluster = createGardenQuartzCluster(
        geometry,
        material,
        [1.12, surfaceY, 0.7],
        0.9,
      )
      expect(cluster.geometry).toBe(geometry)
      expect(cluster.material).toBe(material)
      expect(cluster.count).toBe(5)
      const heights: number[] = []
      for (let index = 0; index < cluster.count; index++) {
        const matrix = new Matrix4()
        cluster.getMatrixAt(index, matrix)
        const base = new Box3()
        const all = new Box3()
        const positions = geometry.getAttribute('position')
        for (let vertex = 0; vertex < positions.count; vertex++) {
          const point = new Vector3().fromBufferAttribute(positions, vertex)
          const isBase = point.y < 0
          point.applyMatrix4(matrix)
          all.expandByPoint(point)
          if (isBase) base.expandByPoint(point)
        }
        expect(base.min.y).toBeLessThan(surfaceY)
        expect(base.max.y).toBeLessThanOrEqual(surfaceY + 0.001)
        expect(all.min.x).toBeGreaterThan(0.72)
        expect(all.max.x).toBeLessThan(1.52)
        expect(all.min.z).toBeGreaterThan(0.3)
        expect(all.max.z).toBeLessThan(1.1)
        heights.push(all.max.y - surfaceY)
      }
      expect(Math.max(...heights)).toBeGreaterThan(0.65)
      expect(Math.max(...heights)).toBeLessThan(0.7)
      expect(new Set(heights).size).toBe(5)
    } finally {
      geometry.dispose()
      material.dispose()
    }
  })
})
