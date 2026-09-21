// Journey vegetation tests — keep instanced gardens clear of selectable landmarks.

import type { BufferGeometry, Object3D } from 'three'
import { BoxGeometry, Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, Vector3, } from 'three'
import { describe, expect, it } from 'vitest'
import { FLOATING_MUSEUM_JOURNEY } from '../content/museum-journey'
import { createJourneyVegetation } from './vegetation'

function expectClearOfLandmarks(point: Vector3): void {
  for (const stage of FLOATING_MUSEUM_JOURNEY.stages) {
    expect(
      Math.hypot(point.x - stage.position[0], point.z - stage.position[2]),
    ).toBeGreaterThanOrEqual(0.8)
    if (stage.portrait !== undefined)
      expect(
        Math.hypot(
          point.x - stage.portrait.position[0],
          point.z - stage.portrait.position[2],
        ),
      ).toBeGreaterThanOrEqual(0.65)
  }
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
          expectClearOfLandmarks(point)
        }
      })
      for (const planter of root.children.filter(
        (child) => child.name === 'map_planter',
      ))
        expectClearOfLandmarks(planter.position)

      const flowerDonor = root.getObjectByName(
        'instanced-authored-flower-clusters-0',
      ) as InstancedMesh
      expect(flowerDonor.count).toBeGreaterThan(0)
      expect(flowerDonor.count).toBeLessThanOrEqual(
        FLOATING_MUSEUM_JOURNEY.landmasses.length * 2,
      )
    } finally {
      for (const geometry of ownedGeometries) geometry.dispose()
      donorGeometry.dispose()
      material.dispose()
    }
  })
})
