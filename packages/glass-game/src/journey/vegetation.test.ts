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

function expectClearOfArchitecture(point: Vector3, radius: number): void {
  for (const stage of FLOATING_MUSEUM_JOURNEY.stages) {
    const [halfWidth, halfDepth] =
      stage.kind === 'twins'
        ? [1.62, 1.08]
        : stage.kind === 'conservatory'
          ? [1.2, 1.55]
          : stage.kind === 'pavilion'
            ? [1.15, 1.1]
            : [1.05, 1.05]
    const dx = point.x - stage.architecturePosition[0]
    const dz = point.z - stage.architecturePosition[2]
    const sine = Math.sin(stage.yaw)
    const cosine = Math.cos(stage.yaw)
    const localX = cosine * dx + sine * dz
    const localZ = -sine * dx + cosine * dz
    const clearanceX = halfWidth * stage.scale + radius
    const clearanceZ = halfDepth * stage.scale + radius
    expect(
      (localX * localX) / (clearanceX * clearanceX) +
        (localZ * localZ) / (clearanceZ * clearanceZ),
    ).toBeGreaterThanOrEqual(1)
  }
}

function expectSupportedByTerrace(point: Vector3, radius: number): void {
  const supported = FLOATING_MUSEUM_JOURNEY.landmasses.some((island) => {
    const dx = point.x - island.position[0]
    const dz = point.z - island.position[2]
    const sine = Math.sin(island.yaw)
    const cosine = Math.cos(island.yaw)
    const localX = cosine * dx + sine * dz
    const localZ = -sine * dx + cosine * dz
    const radiusX = island.terraceScale[0] * 1.644 - radius
    const radiusZ = island.terraceScale[2] * 1.233 - radius
    return (
      (localX * localX) / (radiusX * radiusX) +
        (localZ * localZ) / (radiusZ * radiusZ) <=
      1
    )
  })
  expect(supported).toBe(true)
}

describe('journey vegetation', () => {
  it('instances authored gardens, bounds six flower donors and clears trees and landmarks', () => {
    const material = new MeshBasicMaterial()
    const cypressGeometry = new BoxGeometry(0.48, 1, 0.48)
    const flowerGeometry = new BoxGeometry(0.96, 1, 0.96)
    const planterGeometry = new BoxGeometry(1, 1, 1)
    const ownedGeometries = new Set<BufferGeometry>()
    const authoredUnit = (name: string): Object3D => {
      const unit = new Group()
      unit.name = name
      if (name === 'map_planter') unit.add(new Mesh(planterGeometry, material))
      return unit
    }
    const sculpturalUnit = (name: string): Object3D => {
      if (name !== 'map_cypress' && name !== 'map_flower_cluster')
        throw new Error(`Missing ${name}`)
      const unit = new Group()
      unit.name = name
      unit.add(
        new Mesh(
          name === 'map_cypress' ? cypressGeometry : flowerGeometry,
          material,
        ),
      )
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
      const cypressFootprints: Array<{ point: Vector3; radius: number }> = []
      const flowerFootprints: Array<{ point: Vector3; radius: number }> = []
      root.traverse((object) => {
        if (!(object instanceof InstancedMesh)) return
        for (let index = 0; index < object.count; index++) {
          object.getMatrixAt(index, matrix)
          point.setFromMatrixPosition(matrix)
          const scale = new Vector3().setFromMatrixScale(matrix)
          const footprint = object.name.startsWith(
            'instanced-authored-cypresses-',
          )
            ? Math.max(scale.x, scale.z) * 0.24
            : object.name.startsWith('instanced-authored-flower-clusters-')
              ? Math.max(scale.x, scale.z) * 0.48
              : object.name.startsWith('instanced-authored-planters-')
                ? Math.max(scale.x, scale.z) * 0.5
                : 0
          expectClearOfLandmarks(point, footprint)
          expectClearOfSourcePonds(point, footprint)
          expectClearOfPaths(point, footprint)
          if (object.name.startsWith('instanced-authored-flower-clusters-'))
            expectClearOfArchitecture(point, footprint)
          if (object.name.startsWith('instanced-authored-flower-clusters-'))
            expectSupportedByTerrace(point, footprint)
          if (object.name.startsWith('instanced-authored-cypresses-'))
            cypressFootprints.push({ point: point.clone(), radius: footprint })
          if (object.name.startsWith('instanced-authored-flower-clusters-'))
            flowerFootprints.push({ point: point.clone(), radius: footprint })
        }
      })
      for (const flower of flowerFootprints)
        for (const cypress of cypressFootprints)
          expect(
            Math.hypot(
              flower.point.x - cypress.point.x,
              flower.point.z - cypress.point.z,
            ),
          ).toBeGreaterThanOrEqual(flower.radius + cypress.radius + 0.08)

      const flowerDonor = root.getObjectByName(
        'instanced-authored-flower-clusters-0',
      ) as InstancedMesh
      expect(flowerDonor.count).toBe(
        FLOATING_MUSEUM_JOURNEY.landmasses.length * 2,
      )
      const sourceFlowerCount = Number(flowerDonor.userData.sourceFlowerCount)
      expect(sourceFlowerCount).toBeGreaterThan(0)
      expect(sourceFlowerCount).toBeLessThanOrEqual(
        FLOATING_MUSEUM_JOURNEY.spillways.length,
      )
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
      const planterDonor = root.getObjectByName(
        'instanced-authored-planters-0',
      ) as InstancedMesh
      expect(planterDonor.count).toBeGreaterThan(0)
      expect(root.getObjectByName('map_planter')).toBeUndefined()
      expect(
        root.getObjectByName('instanced-museum-rim-blossoms'),
      ).toBeUndefined()
      expect(
        root.getObjectByName('instanced-museum-flower-bed-leaves'),
      ).toBeUndefined()
    } finally {
      for (const geometry of ownedGeometries) geometry.dispose()
      cypressGeometry.dispose()
      flowerGeometry.dispose()
      planterGeometry.dispose()
      material.dispose()
    }
  })

  it('retains procedural trees and flower beds when authored botanicals are unavailable', () => {
    const material = new MeshBasicMaterial()
    const planterGeometry = new BoxGeometry(1, 1, 1)
    const ownedGeometries = new Set<BufferGeometry>()
    const authoredUnit = (name: string): Object3D => {
      const unit = new Group()
      unit.name = name
      if (name === 'map_planter') unit.add(new Mesh(planterGeometry, material))
      return unit
    }
    const root = createJourneyVegetation(
      FLOATING_MUSEUM_JOURNEY,
      authoredUnit,
      undefined,
      {
        foliage: material,
        darkFoliage: material,
        trunk: material,
        blossom: material,
      },
      ownedGeometries,
    )

    try {
      expect(
        root.getObjectByName('instanced-museum-cypress-trunks'),
      ).toBeDefined()
      expect(
        root.getObjectByName('instanced-museum-cypress-crowns'),
      ).toBeDefined()
      expect(
        root.getObjectByName('instanced-museum-rim-blossoms'),
      ).toBeDefined()
      expect(
        root.getObjectByName('instanced-museum-flower-bed-leaves'),
      ).toBeDefined()
      expect(
        root.getObjectByName('instanced-authored-flower-clusters-0'),
      ).toBeUndefined()
    } finally {
      for (const geometry of ownedGeometries) geometry.dispose()
      planterGeometry.dispose()
      material.dispose()
    }
  })
})
