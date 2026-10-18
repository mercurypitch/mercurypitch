// ============================================================
// First island bed regressions — connected crowns and bounded planted footprints.
// ============================================================

import type { BufferGeometry } from 'three'
import { Euler, Matrix4, MeshBasicMaterial, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { appendFirstIslandBeds, createFirstIslandFlowers, FIRST_ISLAND_TERRACE_BEDS, } from './first-island-beds'
import type { GardenBorderCard } from './garden-border'

function cardVertices(card: GardenBorderCard): Vector3[] {
  const [columns, rows] = card.subdivisions!
  const rotation = new Euler(...card.rotation)
  const points: Vector3[] = []
  for (let row = 0; row <= rows; row++)
    for (let column = 0; column <= columns; column++) {
      const u = column / columns
      const v = row / rows
      points.push(
        new Vector3(
          (u - 0.5) * card.size[0],
          -v * card.size[1],
          Math.sin(u * Math.PI) * Math.sin(v * Math.PI) * card.bend,
        )
          .applyEuler(rotation)
          .add(new Vector3(...card.position)),
      )
    }
  return points
}

describe('First Light terrace beds', () => {
  it('keeps small upward petals inside supported beds in one borrowed-material batch', () => {
    const material = new MeshBasicMaterial()
    const owned = new Set<BufferGeometry>()
    const deckY = -0.026595744680851068
    const flowers = createFirstIslandFlowers(material, owned, deckY)
    try {
      expect(flowers.material).toBe(material)
      expect(owned.size).toBe(1)
      expect(owned.has(flowers.geometry)).toBe(true)
      expect(flowers.castShadow).toBe(false)
      expect(flowers.count).toBe(234)
      expect(flowers.geometry.index!.count / 3).toBe(10)
      const positions = flowers.geometry.getAttribute('position')
      const normals = flowers.geometry.getAttribute('normal')
      const lobes = FIRST_ISLAND_TERRACE_BEDS.flatMap((bed) => bed.lobes)
      const sprigs: GardenBorderCard[] = []
      const trails: GardenBorderCard[] = []
      appendFirstIslandBeds(sprigs, trails, deckY)
      const canopyTops = lobes.map((_, index) =>
        Math.max(
          ...[
            ...sprigs.slice(index * 20, (index + 1) * 20),
            ...trails.slice(index * 4, (index + 1) * 4),
          ].flatMap((card) => cardVertices(card).map((point) => point.y)),
        ),
      )
      const flowerLobes = lobes.flatMap((lobe, index) =>
        Array.from(
          { length: 2 * (lobe.flowers ?? (lobe.radius < 0.2 ? 6 : 9)) },
          () => ({ lobe, canopyTop: canopyTops[index]! }),
        ),
      )
      for (let instance = 0; instance < flowerLobes.length; instance++) {
        const { lobe, canopyTop } = flowerLobes[instance]!
        const matrix = new Matrix4()
        flowers.getMatrixAt(instance, matrix)
        const centre = new Vector3().setFromMatrixPosition(matrix)
        expect(
          Math.hypot(centre.x - lobe.x, centre.z - lobe.z),
        ).toBeLessThanOrEqual(lobe.radius * 0.66)
        for (let vertex = 0; vertex < positions.count; vertex++) {
          const point = new Vector3()
            .fromBufferAttribute(positions, vertex)
            .applyMatrix4(matrix)
          // Petals clear the actual bowed foliage but remain close to it,
          // including narrow beds where the leaf length is radius-capped.
          expect(point.y).toBeGreaterThan(canopyTop + 0.004)
          expect(point.y).toBeLessThan(canopyTop + 0.045)
          expect(point.y).toBeLessThan(deckY + 0.27)
          expect(
            new Vector3()
              .fromBufferAttribute(normals, vertex)
              .transformDirection(matrix).y,
          ).toBeGreaterThan(0.8)
          expect(
            Math.hypot(point.x - lobe.x, point.z - lobe.z),
          ).toBeLessThanOrEqual(lobe.radius)
        }
      }
    } finally {
      flowers.dispose()
      for (const geometry of owned) geometry.dispose()
      material.dispose()
    }
  })
  it('overlaps neighbouring lobes into strips while retaining separate clear routes', () => {
    const strips = FIRST_ISLAND_TERRACE_BEDS.filter(
      (bed) => bed.lobes.length > 1,
    )
    expect(strips).toHaveLength(3)
    for (const bed of strips)
      for (let index = 1; index < bed.lobes.length; index++) {
        const prior = bed.lobes[index - 1]!
        const next = bed.lobes[index]!
        const distance = Math.hypot(next.x - prior.x, next.z - prior.z)
        // Actual crowns occupy most of each lobe; a substantial overlap avoids
        // separated round tufts with marble showing through every join.
        expect(prior.radius + next.radius - distance).toBeGreaterThan(0.15)
      }
    const front = strips.find((bed) => bed.id === 'portrait-front-border')!
    expect(front.lobes).toHaveLength(4)
    const start = front.lobes[0]!
    const end = front.lobes.at(-1)!
    expect(
      Math.hypot(end.x - start.x, end.z - start.z) + start.radius + end.radius,
    ).toBeGreaterThan(0.72)
    const east = strips.find((bed) => bed.id === 'east-shoulder')!
    expect(east.lobes.at(-1)!.z - east.lobes[0]!.z).toBeGreaterThan(0.8)
  })

  it.each([-0.026595744680851068, 0.101])(
    'roots all card vertices within measured lobe footprints at deck height %s',
    (deckY) => {
      const sprigs: GardenBorderCard[] = []
      const trails: GardenBorderCard[] = []
      appendFirstIslandBeds(sprigs, trails, deckY)
      const lobes = FIRST_ISLAND_TERRACE_BEDS.flatMap((bed) => bed.lobes)
      let triangles = 0
      for (const card of [...sprigs, ...trails]) {
        const [columns, rows] = card.subdivisions!
        triangles += columns * rows * 2
        for (const point of cardVertices(card)) {
          expect(point.toArray().every(Number.isFinite)).toBe(true)
          expect(point.y).toBeGreaterThanOrEqual(deckY - 0.015 - 1e-9)
          expect(point.y).toBeLessThan(deckY + 0.3)
          expect(
            lobes.some(
              (lobe) =>
                Math.hypot(point.x - lobe.x, point.z - lobe.z) <= lobe.radius,
            ),
          ).toBe(true)
        }
      }
      expect(triangles).toBeLessThanOrEqual(1280)
    },
  )
})
