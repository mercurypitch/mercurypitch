// Journey vegetation — bounded instanced cypresses, flowers and hanging cliff ivy.

import type { BufferGeometry, Material, Mesh } from 'three'
import { ConeGeometry, CylinderGeometry, Group, IcosahedronGeometry, InstancedMesh, Matrix4, Quaternion, SphereGeometry, Vector3, } from 'three'
import type { MuseumJourneyBridge, MuseumJourneyDefinition, MuseumJourneyLandmass, MuseumJourneySpillway, } from '../content/museum-journey'
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

function distanceToSegment(
  px: number,
  pz: number,
  ax: number,
  az: number,
  bx: number,
  bz: number,
): number {
  const dx = bx - ax
  const dz = bz - az
  const lengthSquared = dx * dx + dz * dz
  const t =
    lengthSquared <= Number.EPSILON
      ? 0
      : Math.max(
          0,
          Math.min(1, ((px - ax) * dx + (pz - az) * dz) / lengthSquared),
        )
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t))
}

/** Horizontal clearance from a point to the same bowed path used by the deck. */
export function journeyBridgeDistanceXZ(
  bridge: MuseumJourneyBridge,
  point: Pick<Vector3, 'x' | 'z'>,
): number {
  const dx = bridge.to[0] - bridge.from[0]
  const dz = bridge.to[2] - bridge.from[2]
  const length = Math.max(0.001, Math.hypot(dx, dz))
  const midpointX =
    (bridge.from[0] + bridge.to[0]) / 2 + (-dz / length) * bridge.curve
  const midpointZ =
    (bridge.from[2] + bridge.to[2]) / 2 + (dx / length) * bridge.curve
  let previousX = bridge.from[0]
  let previousZ = bridge.from[2]
  let distance = Number.POSITIVE_INFINITY
  for (let step = 1; step <= 32; step++) {
    const t = step / 32
    const inverse = 1 - t
    const x =
      inverse * inverse * bridge.from[0] +
      2 * inverse * t * midpointX +
      t * t * bridge.to[0]
    const z =
      inverse * inverse * bridge.from[2] +
      2 * inverse * t * midpointZ +
      t * t * bridge.to[2]
    distance = Math.min(
      distance,
      distanceToSegment(point.x, point.z, previousX, previousZ, x, z),
    )
    previousX = x
    previousZ = z
  }
  return distance
}

function clearsJourneyLandmarks(
  definition: MuseumJourneyDefinition,
  point: Vector3,
  footprintRadius = 0,
): boolean {
  for (const stage of definition.stages) {
    if (
      Math.hypot(point.x - stage.position[0], point.z - stage.position[2]) <
      0.8 + footprintRadius
    )
      return false
    if (
      stage.portrait !== undefined &&
      Math.hypot(
        point.x - stage.portrait.position[0],
        point.z - stage.portrait.position[2],
      ) <
        0.65 + footprintRadius
    )
      return false
  }
  for (const spillway of definition.spillways) {
    const source = spillway.source
    if (source === undefined) continue
    const dx = point.x - source.position[0]
    const dz = point.z - source.position[2]
    const sine = Math.sin(spillway.yaw)
    const cosine = Math.cos(spillway.yaw)
    const localX = cosine * dx - sine * dz
    const localZ = sine * dx + cosine * dz
    const clearanceX = source.width * 0.5 + 0.055 + footprintRadius
    const clearanceZ = source.length * 0.5 + 0.055 + footprintRadius
    if (
      (localX * localX) / (clearanceX * clearanceX) +
        (localZ * localZ) / (clearanceZ * clearanceZ) <
      1
    )
      return false
  }
  for (const bridge of definition.bridges)
    if (
      journeyBridgeDistanceXZ(bridge, point) <
      bridge.width * 0.5 + 0.08 + footprintRadius
    )
      return false
  return true
}

function sourceFloraPoint(
  spillway: MuseumJourneySpillway,
  across: number,
  downstream: number,
): Vector3 {
  const source = spillway.source
  if (source === undefined)
    throw new Error(`Journey spillway ${spillway.id} has no source pond.`)
  const localX = across * (source.width * 0.5 + 0.09)
  const localZ = downstream * (source.length * 0.5 + 0.08)
  const sine = Math.sin(spillway.yaw)
  const cosine = Math.cos(spillway.yaw)
  return new Vector3(
    source.position[0] + cosine * localX + sine * localZ,
    source.position[1] + 0.035,
    source.position[2] - sine * localX + cosine * localZ,
  )
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
  const sourceCount = definition.spillways.filter(
    (spillway) => spillway.source !== undefined,
  ).length
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
    treeCount * 2 + definition.landmasses.length * 30 + sourceCount * 10,
  )
  const bedLeaves = new InstancedMesh(
    ivyGeometry,
    materials.foliage,
    definition.landmasses.length * 18 + sourceCount * 5,
  )
  const ivyPerIsland = 40
  const ivy = new InstancedMesh(
    ivyGeometry,
    materials.foliage,
    definition.landmasses.length * ivyPerIsland,
  )
  const darkIvy = new InstancedMesh(
    ivyGeometry,
    materials.darkFoliage,
    definition.landmasses.length * ivyPerIsland,
  )
  trunks.name = 'instanced-museum-cypress-trunks'
  crowns.name = 'instanced-museum-cypress-crowns'
  flowers.name = 'instanced-museum-rim-blossoms'
  bedLeaves.name = 'instanced-museum-flower-bed-leaves'
  ivy.name = 'instanced-hanging-cliff-ivy'
  darkIvy.name = 'instanced-hanging-cliff-ivy-shadow'
  trunks.castShadow = true
  crowns.castShadow = true
  crowns.receiveShadow = true
  const matrix = new Matrix4()
  const rotation = new Quaternion()
  let treeIndex = 0
  let crownIndex = 0
  let flowerIndex = 0
  let leafIndex = 0
  let ivyIndex = 0
  let darkIvyIndex = 0
  const cypressTransforms: Matrix4[] = []
  const authoredSourceFlowerTransforms: Matrix4[] = []
  const authoredRimFlowerTransforms: Matrix4[] = []

  for (
    let islandIndex = 0;
    islandIndex < definition.landmasses.length;
    islandIndex++
  ) {
    const island = definition.landmasses[islandIndex]!
    for (let index = 0; index < 10; index++) {
      const angle = (index / 10) * Math.PI * 2 + islandIndex * 0.43
      const point = rimPoint(island, angle, index % 2 === 0 ? 0.88 : 0.98)
      if (!clearsJourneyLandmarks(definition, point, 0.2)) continue
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
        if (!clearsJourneyLandmarks(definition, flowerPoint, 0.08)) continue
        matrix.compose(flowerPoint, rotation, new Vector3(1.15, 0.72, 1.15))
        flowers.setMatrixAt(flowerIndex++, matrix)
      }
    }

    let pocket = 0
    for (let candidate = 0; candidate < 10 && pocket < 3; candidate++) {
      const angle = ((candidate + 0.25) / 10) * Math.PI * 2 + islandIndex * 0.37
      const center = rimPoint(island, angle, candidate % 2 === 0 ? 0.67 : 0.74)
      if (!clearsJourneyLandmarks(definition, center, 0.3)) continue
      for (let blossom = 0; blossom < 10; blossom++) {
        const turn = blossom * 2.399 + pocket * 0.41
        const radius = 0.11 + (blossom % 4) * 0.045
        const point = center
          .clone()
          .add(
            new Vector3(
              Math.cos(turn) * radius,
              0.075 + (blossom % 2) * 0.025,
              Math.sin(turn) * radius,
            ),
          )
        const size = 0.86 + ((pocket + blossom) % 3) * 0.16
        matrix.compose(point, rotation, new Vector3(size, size * 0.76, size))
        flowers.setMatrixAt(flowerIndex++, matrix)
      }
      for (let leaf = 0; leaf < 5; leaf++) {
        const turn = leaf * ((Math.PI * 2) / 5) + pocket * 0.31
        const point = center
          .clone()
          .add(new Vector3(Math.cos(turn) * 0.2, 0.035, Math.sin(turn) * 0.2))
        matrix.compose(
          point,
          new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), -turn),
          new Vector3(1.08, 0.48, 1.7),
        )
        bedLeaves.setMatrixAt(leafIndex++, matrix)
      }
      pocket++
    }

    const islandStageIds = new Set(
      definition.stages
        .filter((stage) => stage.islandId === island.id)
        .map((stage) => stage.id),
    )
    const islandSources = definition.spillways.filter(
      (spillway) =>
        spillway.source !== undefined && islandStageIds.has(spillway.stageId),
    )
    let authoredFlowerCount = 0
    for (const spillway of islandSources) {
      if (authoredFlowerCount === 2) break
      for (const [across, downstream] of [
        [-1.55, -0.75],
        [1.55, -0.75],
        [0, -2],
      ] as const) {
        const point = sourceFloraPoint(spillway, across, downstream)
        if (!clearsJourneyLandmarks(definition, point, 0.4)) continue
        authoredSourceFlowerTransforms.push(
          new Matrix4().compose(
            point,
            new Quaternion().setFromAxisAngle(
              new Vector3(0, 1, 0),
              spillway.yaw + across * 0.22,
            ),
            new Vector3(0.82, 0.82, 0.82),
          ),
        )
        authoredFlowerCount++
        break
      }
    }
    for (let candidate = 0; candidate < 10; candidate++) {
      if (authoredFlowerCount === 2) break
      const angle = ((candidate + 0.55) / 10) * Math.PI * 2 + islandIndex * 0.53
      const point = rimPoint(island, angle, candidate % 2 === 0 ? 0.7 : 0.76)
      if (!clearsJourneyLandmarks(definition, point, 0.46)) continue
      authoredRimFlowerTransforms.push(
        new Matrix4().compose(
          point,
          new Quaternion().setFromAxisAngle(
            new Vector3(0, 1, 0),
            -angle + Math.PI / 2,
          ),
          new Vector3(0.95, 0.95, 0.95),
        ),
      )
      authoredFlowerCount++
    }

    for (const spillway of islandSources) {
      for (const [pointIndex, [across, downstream]] of [
        [-1.05, -0.05],
        [1.05, -0.05],
        [-0.76, -0.92],
        [0, -1.18],
        [0.76, -0.92],
      ].entries()) {
        const point = sourceFloraPoint(spillway, across, downstream)
        if (!clearsJourneyLandmarks(definition, point)) continue
        const tangent = new Vector3(
          Math.cos(spillway.yaw),
          0,
          -Math.sin(spillway.yaw),
        )
        for (const offset of [-0.045, 0.045]) {
          const blossomPoint = point.clone().addScaledVector(tangent, offset)
          if (!clearsJourneyLandmarks(definition, blossomPoint)) continue
          const size = 0.76 + ((pointIndex + (offset > 0 ? 1 : 0)) % 3) * 0.12
          matrix.compose(
            blossomPoint,
            rotation,
            new Vector3(size, size * 0.68, size),
          )
          flowers.setMatrixAt(flowerIndex++, matrix)
        }
        matrix.compose(
          point.clone().add(new Vector3(0, -0.022, 0)),
          new Quaternion().setFromAxisAngle(
            new Vector3(0, 1, 0),
            spillway.yaw + pointIndex * 0.72,
          ),
          new Vector3(0.92, 0.38, 1.38),
        )
        bedLeaves.setMatrixAt(leafIndex++, matrix)
      }
    }

    for (let strand = 0; strand < 8; strand++) {
      const angle = Math.PI * (0.04 + strand * 0.13) + islandIndex * 0.19
      const strandTop = rimPoint(island, angle, 1.02)
      if (!clearsJourneyLandmarks(definition, strandTop)) continue
      for (let depth = 0; depth < 5; depth++) {
        const point = strandTop.clone()
        point.y -= 0.16 + depth * (0.25 + (strand % 3) * 0.025)
        point.x += Math.sin(depth * 1.7 + strand) * 0.075
        point.z += Math.cos(depth * 1.3 + strand) * 0.055
        if (!clearsJourneyLandmarks(definition, point)) continue
        matrix.compose(
          point,
          rotation,
          new Vector3(
            0.58 + ((strand + depth) % 3) * 0.1,
            1.14 + depth * 0.08,
            0.52,
          ),
        )
        if ((strand + depth) % 3 === 0)
          darkIvy.setMatrixAt(darkIvyIndex++, matrix)
        else ivy.setMatrixAt(ivyIndex++, matrix)
      }
    }

    for (let index = 0; index < 3; index++) {
      const angle = Math.PI * (0.16 + index * 0.34) + island.yaw
      const point = rimPoint(island, angle, 0.72)
      if (!clearsJourneyLandmarks(definition, point, 0.2)) continue
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
  bedLeaves.instanceMatrix.needsUpdate = true
  bedLeaves.count = leafIndex
  ivy.instanceMatrix.needsUpdate = true
  ivy.count = ivyIndex
  darkIvy.instanceMatrix.needsUpdate = true
  darkIvy.count = darkIvyIndex
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

  const authoredFlowerTransforms = [
    ...authoredSourceFlowerTransforms,
    ...authoredRimFlowerTransforms,
  ]
  const flowerCluster = sculpturalUnit?.('map_flower_cluster')
  if (flowerCluster !== undefined && authoredFlowerTransforms.length > 0) {
    flowerCluster.updateMatrixWorld(true)
    let meshIndex = 0
    flowerCluster.traverse((object) => {
      const mesh = object as Mesh
      if (!mesh.isMesh) return
      const instances = new InstancedMesh(
        mesh.geometry,
        mesh.material,
        authoredFlowerTransforms.length,
      )
      instances.name = `instanced-authored-flower-clusters-${meshIndex++}`
      instances.userData.sourceFlowerCount =
        authoredSourceFlowerTransforms.length
      instances.castShadow = true
      instances.receiveShadow = true
      const instanceMatrix = new Matrix4()
      authoredFlowerTransforms.forEach((transform, index) => {
        instanceMatrix.multiplyMatrices(transform, mesh.matrixWorld)
        instances.setMatrixAt(index, instanceMatrix)
      })
      instances.instanceMatrix.needsUpdate = true
      root.add(instances)
    })
  }
  root.add(flowers, bedLeaves, ivy, darkIvy)
  return root
}
