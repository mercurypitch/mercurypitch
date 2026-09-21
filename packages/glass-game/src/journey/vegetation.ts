// Journey vegetation — bounded instanced cypresses, flowers and hanging cliff ivy.

import type { BufferGeometry, Material, Mesh } from 'three'
import { ConeGeometry, CylinderGeometry, Group, IcosahedronGeometry, InstancedMesh, Matrix4, Quaternion, SphereGeometry, Vector3, } from 'three'
import type { MuseumJourneyDefinition, MuseumJourneyLandmass, } from '../content/museum-journey'
import type { JourneyAuthoredUnit } from './architecture'

export interface JourneyVegetationMaterials {
  foliage: Material
  darkFoliage: Material
  trunk: Material
  blossom: Material
}

function own<T extends BufferGeometry>(
  geometry: T,
  owned: Set<BufferGeometry>,
): T {
  owned.add(geometry)
  return geometry
}

function rimPoint(
  island: MuseumJourneyLandmass,
  angle: number,
  inset = 1,
): Vector3 {
  const radiusX = island.terraceScale[0] * 1.38 * inset
  const radiusZ = island.terraceScale[2] * 1.38 * inset
  return new Vector3(
    island.position[0] + Math.cos(angle + island.yaw) * radiusX,
    island.position[1] + 0.05,
    island.position[2] + Math.sin(angle + island.yaw) * radiusZ,
  )
}

function clearsJourneyLandmarks(
  definition: MuseumJourneyDefinition,
  point: Vector3,
): boolean {
  for (const stage of definition.stages) {
    if (
      Math.hypot(point.x - stage.position[0], point.z - stage.position[2]) < 0.8
    )
      return false
    if (
      stage.portrait !== undefined &&
      Math.hypot(
        point.x - stage.portrait.position[0],
        point.z - stage.portrait.position[2],
      ) < 0.65
    )
      return false
  }
  return true
}

export function createJourneyVegetation(
  definition: MuseumJourneyDefinition,
  authoredUnit: JourneyAuthoredUnit,
  sculpturalUnit: JourneyAuthoredUnit | undefined,
  materials: JourneyVegetationMaterials,
  ownedGeometries: Set<BufferGeometry>,
): Group {
  const root = new Group()
  root.name = 'floating-museum-gardens'
  const treeCount = definition.landmasses.length * 10
  const trunkGeometry = own(
    new CylinderGeometry(0.055, 0.075, 1, 7),
    ownedGeometries,
  )
  const crownGeometry = own(new ConeGeometry(0.23, 1, 8), ownedGeometries)
  const flowerGeometry = own(new SphereGeometry(0.075, 7, 5), ownedGeometries)
  const ivyGeometry = own(new IcosahedronGeometry(0.085, 0), ownedGeometries)
  const trunks = new InstancedMesh(trunkGeometry, materials.trunk, treeCount)
  const crowns = new InstancedMesh(
    crownGeometry,
    materials.darkFoliage,
    treeCount * 2,
  )
  const flowers = new InstancedMesh(
    flowerGeometry,
    materials.blossom,
    treeCount * 2,
  )
  const ivyPerIsland = 24
  const ivy = new InstancedMesh(
    ivyGeometry,
    materials.foliage,
    definition.landmasses.length * ivyPerIsland,
  )
  trunks.name = 'instanced-museum-cypress-trunks'
  crowns.name = 'instanced-museum-cypress-crowns'
  flowers.name = 'instanced-museum-rim-blossoms'
  ivy.name = 'instanced-hanging-cliff-ivy'
  trunks.castShadow = true
  crowns.castShadow = true
  crowns.receiveShadow = true
  const matrix = new Matrix4()
  const rotation = new Quaternion()
  let treeIndex = 0
  let crownIndex = 0
  let flowerIndex = 0
  let ivyIndex = 0
  const cypressTransforms: Matrix4[] = []

  for (
    let islandIndex = 0;
    islandIndex < definition.landmasses.length;
    islandIndex++
  ) {
    const island = definition.landmasses[islandIndex]!
    for (let index = 0; index < 10; index++) {
      const angle = (index / 10) * Math.PI * 2 + islandIndex * 0.43
      const point = rimPoint(island, angle, index % 2 === 0 ? 0.88 : 0.98)
      if (!clearsJourneyLandmarks(definition, point)) continue
      const height = 0.82 + ((index * 7 + islandIndex * 3) % 5) * 0.1
      cypressTransforms.push(
        new Matrix4().compose(
          point,
          new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), angle * 0.37),
          new Vector3(height * 0.82, height * 0.82, height * 0.82),
        ),
      )
      matrix.compose(
        point.clone().add(new Vector3(0, height * 0.5, 0)),
        rotation,
        new Vector3(1, height, 1),
      )
      trunks.setMatrixAt(treeIndex++, matrix)
      for (let layer = 0; layer < 2; layer++) {
        const layerHeight = height * (layer === 0 ? 0.82 : 1.22)
        matrix.compose(
          point.clone().add(new Vector3(0, layerHeight, 0)),
          rotation,
          new Vector3(
            0.9 - layer * 0.2,
            height * (layer === 0 ? 0.82 : 0.58),
            0.9 - layer * 0.2,
          ),
        )
        crowns.setMatrixAt(crownIndex++, matrix)
      }
      for (const turn of [-0.12, 0.12]) {
        const flowerPoint = point
          .clone()
          .add(
            new Vector3(
              Math.cos(angle + turn) * 0.22,
              0.08,
              Math.sin(angle + turn) * 0.22,
            ),
          )
        if (!clearsJourneyLandmarks(definition, flowerPoint)) continue
        matrix.compose(flowerPoint, rotation, new Vector3(1.15, 0.72, 1.15))
        flowers.setMatrixAt(flowerIndex++, matrix)
      }
    }

    for (let index = 0; index < ivyPerIsland; index++) {
      const strand = index % 6
      const depth = Math.floor(index / 6)
      const angle =
        Math.PI * (0.08 + strand * 0.17) + island.yaw + islandIndex * 0.51
      const point = rimPoint(island, angle, 1.02)
      point.y -= 0.18 + depth * (0.28 + (strand % 2) * 0.05)
      point.x += Math.sin(depth * 1.7 + strand) * 0.08
      point.z += Math.cos(depth * 1.3 + strand) * 0.06
      matrix.compose(
        point,
        rotation,
        new Vector3(0.78 + (index % 3) * 0.12, 1.25, 0.65),
      )
      ivy.setMatrixAt(ivyIndex++, matrix)
    }

    for (let index = 0; index < 3; index++) {
      const angle = Math.PI * (0.16 + index * 0.34) + island.yaw
      const point = rimPoint(island, angle, 0.72)
      if (!clearsJourneyLandmarks(definition, point)) continue
      const planter = authoredUnit('map_planter')
      planter.position.copy(point)
      planter.rotation.y = -angle + Math.PI / 2
      planter.scale.setScalar(0.42 + (index % 2) * 0.05)
      root.add(planter)
    }
  }

  trunks.instanceMatrix.needsUpdate = true
  trunks.count = treeIndex
  crowns.instanceMatrix.needsUpdate = true
  crowns.count = crownIndex
  flowers.instanceMatrix.needsUpdate = true
  flowers.count = flowerIndex
  ivy.instanceMatrix.needsUpdate = true
  if (sculpturalUnit === undefined) root.add(trunks, crowns)
  else {
    const cypress = sculpturalUnit('map_cypress')
    cypress.updateMatrixWorld(true)
    let meshIndex = 0
    cypress.traverse((object) => {
      const mesh = object as Mesh
      if (!mesh.isMesh) return
      const instances = new InstancedMesh(
        mesh.geometry,
        mesh.material,
        cypressTransforms.length,
      )
      instances.name = `instanced-authored-cypresses-${meshIndex++}`
      instances.castShadow = true
      instances.receiveShadow = true
      const instanceMatrix = new Matrix4()
      cypressTransforms.forEach((transform, index) => {
        instanceMatrix.multiplyMatrices(transform, mesh.matrixWorld)
        instances.setMatrixAt(index, instanceMatrix)
      })
      instances.instanceMatrix.needsUpdate = true
      root.add(instances)
    })
  }
  root.add(flowers, ivy)
  return root
}
