// Journey vegetation placement — deterministic terrace candidates, safety clearances and donor instancing.

import type { Group, Mesh, Object3D } from 'three'
import { InstancedMesh, Matrix4, Quaternion, Vector3 } from 'three'
import type { MuseumJourneyBridge, MuseumJourneyDefinition, MuseumJourneyLandmass, MuseumJourneySpillway, } from '../content/museum-journey'

export interface VegetationFootprint {
  position: Vector3
  radius: number
}

export interface AuthoredFlowerPlacement {
  sourceTransforms: Matrix4[]
  rimTransforms: Matrix4[]
  footprints: VegetationFootprint[]
  sources: MuseumJourneySpillway[]
}

export const AUTHORED_CYPRESS_BASE_RADIUS = 0.24
const AUTHORED_FLOWER_BASE_RADIUS = 0.48
const VEGETATION_GAP = 0.08
const TERRACE_HALF_WIDTH = 1.644
const TERRACE_HALF_DEPTH = 1.233

export function rimPoint(
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

export function clearsJourneyLandmarks(
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

function clearsJourneyArchitecture(
  definition: MuseumJourneyDefinition,
  point: Vector3,
  footprintRadius: number,
): boolean {
  for (const stage of definition.stages) {
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
    const clearanceX = halfWidth * stage.scale + footprintRadius
    const clearanceZ = halfDepth * stage.scale + footprintRadius
    if (
      (localX * localX) / (clearanceX * clearanceX) +
        (localZ * localZ) / (clearanceZ * clearanceZ) <
      1
    )
      return false
  }
  return true
}

function fitsIslandTerrace(
  island: MuseumJourneyLandmass,
  point: Vector3,
  footprintRadius: number,
): boolean {
  const dx = point.x - island.position[0]
  const dz = point.z - island.position[2]
  const sine = Math.sin(island.yaw)
  const cosine = Math.cos(island.yaw)
  const localX = cosine * dx + sine * dz
  const localZ = -sine * dx + cosine * dz
  const radiusX = island.terraceScale[0] * TERRACE_HALF_WIDTH - footprintRadius
  const radiusZ = island.terraceScale[2] * TERRACE_HALF_DEPTH - footprintRadius
  if (radiusX <= 0 || radiusZ <= 0) return false
  return (
    (localX * localX) / (radiusX * radiusX) +
      (localZ * localZ) / (radiusZ * radiusZ) <=
    1
  )
}

export function sourceFloraPoint(
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

export function clearsVegetationFootprints(
  point: Vector3,
  footprintRadius: number,
  footprints: readonly VegetationFootprint[],
): boolean {
  return footprints.every(
    (footprint) =>
      Math.hypot(
        point.x - footprint.position.x,
        point.z - footprint.position.z,
      ) >=
      footprintRadius + footprint.radius + VEGETATION_GAP,
  )
}

function islandFrontDirection(
  definition: MuseumJourneyDefinition,
  island: MuseumJourneyLandmass,
): Vector3 {
  const stages = definition.stages.filter(
    (stage) => stage.islandId === island.id,
  )
  const front = stages.reduce(
    (sum, stage) =>
      sum.add(new Vector3(stage.position[0], 0, stage.position[2])),
    new Vector3(),
  )
  if (stages.length > 0) front.multiplyScalar(1 / stages.length)
  front.sub(new Vector3(island.position[0], 0, island.position[2]))
  if (front.lengthSq() <= Number.EPSILON)
    return new Vector3(Math.sin(island.yaw), 0, Math.cos(island.yaw))
  return front.normalize()
}

export function addInstancedDonor(
  root: Group,
  donor: Object3D,
  transforms: readonly Matrix4[],
  name: string,
  userData: Readonly<Record<string, unknown>> = {},
): void {
  if (transforms.length === 0) return
  donor.updateMatrixWorld(true)
  let meshIndex = 0
  donor.traverse((object) => {
    const mesh = object as Mesh
    if (!mesh.isMesh) return
    const instances = new InstancedMesh(
      mesh.geometry,
      mesh.material,
      transforms.length,
    )
    instances.name = `${name}-${meshIndex++}`
    Object.assign(instances.userData, userData)
    instances.castShadow = true
    instances.receiveShadow = true
    const instanceMatrix = new Matrix4()
    transforms.forEach((transform, index) => {
      instanceMatrix.multiplyMatrices(transform, mesh.matrixWorld)
      instances.setMatrixAt(index, instanceMatrix)
    })
    instances.instanceMatrix.needsUpdate = true
    root.add(instances)
  })
}

export function createAuthoredFlowerPlacement(
  definition: MuseumJourneyDefinition,
  island: MuseumJourneyLandmass,
): AuthoredFlowerPlacement {
  const sourceTransforms: Matrix4[] = []
  const rimTransforms: Matrix4[] = []
  const footprints: VegetationFootprint[] = []
  const islandStageIds = new Set(
    definition.stages
      .filter((stage) => stage.islandId === island.id)
      .map((stage) => stage.id),
  )
  const sources = definition.spillways.filter(
    (spillway) =>
      spillway.source !== undefined && islandStageIds.has(spillway.stageId),
  )
  let flowerCount = 0
  const frontDirection = islandFrontDirection(definition, island)
  const islandCenter = new Vector3(...island.position)
  const flowerScale = 0.55
  const flowerRadius = AUTHORED_FLOWER_BASE_RADIUS * flowerScale
  const sourceOptions = sources
    .flatMap((spillway) => {
      const candidates: ReadonlyArray<readonly [number, number]> = [
        [-1.65, -0.8],
        [1.65, -0.8],
        [-1.65, 0.8],
        [1.65, 0.8],
        ...Array.from({ length: 24 }, (_, index) => {
          const angle = ((index + 0.5) / 24) * Math.PI * 2
          return [Math.cos(angle) * 1.8, Math.sin(angle) * 1.8] as const
        }),
      ]
      return candidates.flatMap(([across, downstream]) => {
        const point = sourceFloraPoint(spillway, across, downstream)
        if (!clearsJourneyLandmarks(definition, point, flowerRadius)) return []
        if (!clearsJourneyArchitecture(definition, point, flowerRadius))
          return []
        if (!fitsIslandTerrace(island, point, flowerRadius)) return []
        const direction = point.clone().sub(islandCenter).setY(0).normalize()
        return [
          { across, point, score: direction.dot(frontDirection), spillway },
        ]
      })
    })
    .sort((left, right) => right.score - left.score)
  const placeSource = (option: (typeof sourceOptions)[number]): void => {
    sourceTransforms.push(
      new Matrix4().compose(
        option.point,
        new Quaternion().setFromAxisAngle(
          new Vector3(0, 1, 0),
          option.spillway.yaw + option.across * 0.22,
        ),
        new Vector3(flowerScale, flowerScale, flowerScale),
      ),
    )
    footprints.push({ position: option.point.clone(), radius: flowerRadius })
    flowerCount++
  }
  const firstSource = sourceOptions.find((option) =>
    clearsVegetationFootprints(option.point, flowerRadius, footprints),
  )
  if (firstSource !== undefined) placeSource(firstSource)

  const frontPocketOptions = definition.stages
    .filter((stage) => stage.islandId === island.id)
    .flatMap((stage) => {
      const front = new Vector3(
        stage.position[0] - stage.architecturePosition[0],
        0,
        stage.position[2] - stage.architecturePosition[2],
      ).normalize()
      const side = new Vector3(-front.z, 0, front.x)
      return [1.22, -1.22, 1.55, -1.55].flatMap((sideOffset) =>
        [0.08, 0.38].map((forwardOffset) => ({
          point: new Vector3(...stage.position)
            .setY(island.position[1] + 0.05)
            .addScaledVector(side, sideOffset)
            .addScaledVector(front, forwardOffset),
          rotation: stage.yaw - sideOffset * 0.08,
        })),
      )
    })
  const frontPocket = frontPocketOptions.find(
    ({ point }) =>
      clearsJourneyLandmarks(definition, point, flowerRadius) &&
      clearsJourneyArchitecture(definition, point, flowerRadius) &&
      fitsIslandTerrace(island, point, flowerRadius) &&
      clearsVegetationFootprints(point, flowerRadius, footprints),
  )
  if (flowerCount < 2 && frontPocket !== undefined) {
    rimTransforms.push(
      new Matrix4().compose(
        frontPocket.point,
        new Quaternion().setFromAxisAngle(
          new Vector3(0, 1, 0),
          frontPocket.rotation,
        ),
        new Vector3(flowerScale, flowerScale, flowerScale),
      ),
    )
    footprints.push({
      position: frontPocket.point.clone(),
      radius: flowerRadius,
    })
    flowerCount++
  }

  const rimInsets = [0.62, 0.7, 0.78, 0.86, 0.94] as const
  const rimOptions = Array.from(
    { length: 48 * rimInsets.length },
    (_, candidate) => {
      const turn = candidate % 48
      const angle = (turn / 48) * Math.PI * 2
      const point = rimPoint(
        island,
        angle,
        rimInsets[Math.floor(candidate / 48)]!,
      )
      const offset = point.clone().sub(islandCenter).setY(0).normalize()
      return { angle, point, score: offset.dot(frontDirection) }
    },
  ).sort((left, right) => right.score - left.score)
  const rimOption = rimOptions.find(
    ({ point, score }) =>
      score >= 0.35 &&
      clearsJourneyLandmarks(definition, point, flowerRadius) &&
      clearsJourneyArchitecture(definition, point, flowerRadius) &&
      fitsIslandTerrace(island, point, flowerRadius) &&
      clearsVegetationFootprints(point, flowerRadius, footprints),
  )
  const alternateSource = sourceOptions.find((option) =>
    clearsVegetationFootprints(option.point, flowerRadius, footprints),
  )
  if (flowerCount < 2 && rimOption !== undefined) {
    rimTransforms.push(
      new Matrix4().compose(
        rimOption.point,
        new Quaternion().setFromAxisAngle(
          new Vector3(0, 1, 0),
          -rimOption.angle + Math.PI / 2,
        ),
        new Vector3(flowerScale, flowerScale, flowerScale),
      ),
    )
    footprints.push({ position: rimOption.point.clone(), radius: flowerRadius })
    flowerCount++
  } else if (flowerCount < 2 && alternateSource !== undefined) {
    placeSource(alternateSource)
  }

  const terraceRadiusX =
    island.terraceScale[0] * TERRACE_HALF_WIDTH - flowerRadius - 0.04
  const terraceRadiusZ =
    island.terraceScale[2] * TERRACE_HALF_DEPTH - flowerRadius - 0.04
  const terraceRings = [0.42, 0.52, 0.62, 0.72, 0.82, 0.9, 0.96, 1] as const
  const terraceOptions = Array.from(
    { length: terraceRings.length * 72 },
    (_, candidate) => {
      const ring = terraceRings[Math.floor(candidate / 72)]!
      const angle = ((candidate % 72) / 72) * Math.PI * 2
      const localX = Math.cos(angle) * terraceRadiusX * ring
      const localZ = Math.sin(angle) * terraceRadiusZ * ring
      const sine = Math.sin(island.yaw)
      const cosine = Math.cos(island.yaw)
      const point = new Vector3(
        island.position[0] + cosine * localX - sine * localZ,
        island.position[1] + 0.05,
        island.position[2] + sine * localX + cosine * localZ,
      )
      const direction = point.clone().sub(islandCenter).setY(0).normalize()
      return { angle, point, score: direction.dot(frontDirection) }
    },
  ).sort((left, right) => right.score - left.score)
  for (const option of terraceOptions) {
    if (flowerCount === 2) break
    if (
      !clearsJourneyLandmarks(definition, option.point, flowerRadius) ||
      !clearsJourneyArchitecture(definition, option.point, flowerRadius) ||
      !fitsIslandTerrace(island, option.point, flowerRadius) ||
      !clearsVegetationFootprints(option.point, flowerRadius, footprints)
    )
      continue
    rimTransforms.push(
      new Matrix4().compose(
        option.point,
        new Quaternion().setFromAxisAngle(
          new Vector3(0, 1, 0),
          -option.angle + Math.PI / 2,
        ),
        new Vector3(flowerScale, flowerScale, flowerScale),
      ),
    )
    footprints.push({ position: option.point.clone(), radius: flowerRadius })
    flowerCount++
  }

  return { sourceTransforms, rimTransforms, footprints, sources }
}
