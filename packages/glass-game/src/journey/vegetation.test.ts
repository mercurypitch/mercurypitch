// Journey vegetation tests — keep instanced gardens clear of selectable landmarks.

import type { BufferGeometry, Object3D } from 'three'
import { BoxGeometry, Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, Vector3, } from 'three'
import { describe, expect, it } from 'vitest'
import { FLOATING_MUSEUM_JOURNEY } from '../content/museum-journey'
import { createJourneyVegetation, journeyBridgeDistanceXZ } from './vegetation'

function expectClearOfLandmarks(point: Vector3, radius = 0): void {
  for (const stage of FLOATING_MUSEUM_JOURNEY.stages) {
    expect(
      Math.hypot(point.x - stage.position[0], point.z - stage.position[2]),
    ).toBeGreaterThanOrEqual(0.8 + radius)
    if (stage.portrait !== undefined)
      expect(
        Math.hypot(
          point.x - stage.portrait.position[0],
          point.z - stage.portrait.position[2],
        ),
      ).toBeGreaterThanOrEqual(0.65 + radius)
  }
}

function expectClearOfSourcePonds(point: Vector3, radius = 0): void {
  for (const spillway of FLOATING_MUSEUM_JOURNEY.spillways) {
    const source = spillway.source
    if (source === undefined) continue
    const dx = point.x - source.position[0]
    const dz = point.z - source.position[2]
    const sine = Math.sin(spillway.yaw)
    const cosine = Math.cos(spillway.yaw)
    const localX = cosine * dx - sine * dz
    const localZ = sine * dx + cosine * dz
    const clearanceX = source.width * 0.5 + 0.055 + radius
    const clearanceZ = source.length * 0.5 + 0.055 + radius
    expect(
      (localX * localX) / (clearanceX * clearanceX) +
        (localZ * localZ) / (clearanceZ * clearanceZ),
    ).toBeGreaterThanOrEqual(1)
  }
}

function expectClearOfPaths(point: Vector3, radius = 0): void {
  for (const bridge of FLOATING_MUSEUM_JOURNEY.bridges)
    expect(journeyBridgeDistanceXZ(bridge, point)).toBeGreaterThanOrEqual(
      bridge.width * 0.5 + 0.08 + radius,
    )
}

describe('journey vegetation', () => {
  it('bounds shared flower donors and clears every marker and portrait', () => {
    const material = new MeshBasicMaterial()
    const donorGeometry = new BoxGeometry(1, 1, 1)
    const ownedGeometries = new Set<BufferGeometry>()
    const authoredUnit = (name: string): Object3D => {
      const unit = new Group()
      unit.name = name
      return unit
    }
    const sculpturalUnit = (name: string): Object3D => {
      if (name !== 'map_cypress' && name !== 'map_flower_cluster')
        throw new Error(`Missing ${name}`)
      const unit = new Group()
      unit.name = name
      unit.add(new Mesh(donorGeometry, material))
      return unit
    }
    const root = createJourneyVegetation(
      FLOATING_MUSEUM_JOURNEY,
      authoredUnit,
      sculpturalUnit,
      {
        foliage: material,
        darkFoliage: material,
        trunk: material,
        blossom: material,
      },
      ownedGeometries,
    )

    try {
      const matrix = new Matrix4()
      const point = new Vector3()
      root.traverse((object) => {
        if (!(object instanceof InstancedMesh)) return
        for (let index = 0; index < object.count; index++) {
          object.getMatrixAt(index, matrix)
          point.setFromMatrixPosition(matrix)
          const footprint = object.name.startsWith(
            'instanced-authored-cypresses-',
          )
            ? 0.2
            : object.name.startsWith('instanced-authored-flower-clusters-')
              ? Math.max(
                  ...new Vector3().setFromMatrixScale(matrix).toArray(),
                ) * 0.48
              : 0
          expectClearOfLandmarks(point, footprint)
          expectClearOfSourcePonds(point, footprint)
          expectClearOfPaths(point, footprint)
        }
      })
      for (const planter of root.children.filter(
        (child) => child.name === 'map_planter',
      )) {
        expectClearOfLandmarks(planter.position, 0.2)
        expectClearOfSourcePonds(planter.position, 0.2)
        expectClearOfPaths(planter.position, 0.2)
      }

      const flowerDonor = root.getObjectByName(
        'instanced-authored-flower-clusters-0',
      ) as InstancedMesh
      expect(flowerDonor.count).toBeGreaterThan(0)
      expect(flowerDonor.count).toBeLessThanOrEqual(
        FLOATING_MUSEUM_JOURNEY.landmasses.length * 2,
      )
      const sourceFlowerCount = Number(flowerDonor.userData.sourceFlowerCount)
      expect(sourceFlowerCount).toBe(FLOATING_MUSEUM_JOURNEY.spillways.length)
      const sourceCenters = FLOATING_MUSEUM_JOURNEY.spillways.flatMap(
        (spillway) =>
          spillway.source === undefined
            ? []
            : [new Vector3(...spillway.source.position)],
      )
      for (let index = 0; index < sourceFlowerCount; index++) {
        flowerDonor.getMatrixAt(index, matrix)
        point.setFromMatrixPosition(matrix)
        const scale = new Vector3().setFromMatrixScale(matrix)
        const footprint = Math.max(scale.x, scale.z) * 0.48
        expectClearOfLandmarks(point, footprint)
        expectClearOfSourcePonds(point, footprint)
        expectClearOfPaths(point, footprint)
        expect(
          Math.min(
            ...sourceCenters.map((center) =>
              Math.hypot(point.x - center.x, point.z - center.z),
            ),
          ),
        ).toBeLessThan(1.5)
      }
    } finally {
      for (const geometry of ownedGeometries) geometry.dispose()
      donorGeometry.dispose()
      material.dispose()
    }
  })
})
