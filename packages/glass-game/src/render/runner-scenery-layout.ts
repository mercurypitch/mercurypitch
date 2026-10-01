// Runner scenery layout — authored side dressing with fog-safe two-chunk handoffs.

import { Box3, Frustum, Matrix4, PerspectiveCamera, Quaternion, Vector3, } from 'three'
import type { CompiledRunnerCourse } from '../runner/contracts'
import { runnerCameraPose } from './runner-world-layout'

export const RUNNER_SCENERY_FOG_FAR = 37
export const RUNNER_SCENERY_VALIDATED_ASPECTS = Object.freeze([
  320 / 740,
  390 / 844,
  768 / 1024,
  1024 / 768,
  1440 / 900,
  740 / 360,
  21 / 9,
])

export type RunnerSceneryKind =
  | 'pavilion'
  | 'landmark'
  | 'garden'
  | 'painting'
  | 'water'

export type RunnerSceneryDonorPrefab =
  | 'museum_arch'
  | 'museum_column'
  | 'museum_rotunda'
  | 'garden_perimeter'
  | 'ivy_trail'

export interface RunnerSceneryDonorPart {
  readonly prefab: RunnerSceneryDonorPrefab
  readonly position: readonly [number, number, number]
  readonly yawRadians: number
  readonly scale: number
}

interface RunnerSceneryFootprint {
  readonly min: readonly [number, number, number]
  readonly max: readonly [number, number, number]
}

interface RunnerSceneryAssembly {
  readonly donorParts: readonly RunnerSceneryDonorPart[]
  readonly footprints: readonly RunnerSceneryFootprint[]
  readonly triangles: number
  readonly drawPoolIds: readonly string[]
  readonly authoredCounts: Readonly<
    Partial<Record<RunnerSceneryAuthoredKind, number>>
  >
}

type RunnerSceneryAuthoredKind =
  | 'arches'
  | 'columns'
  | 'rotundas'
  | 'perimeters'
  | 'ivy'
  | 'pools'
  | 'paintings'

function donorPart(
  prefab: RunnerSceneryDonorPrefab,
  position: readonly [number, number, number],
  yawRadians = 0,
  scale = 1,
): RunnerSceneryDonorPart {
  return Object.freeze({ prefab, position, yawRadians, scale })
}

const ARCH: RunnerSceneryFootprint = {
  min: [-1.015, -0.02, -0.2],
  max: [1.015, 2.29, 0.2],
}
const LEFT_COLUMN: RunnerSceneryFootprint = {
  min: [-1.48, 0, -0.23],
  max: [-1.02, 2.19, 0.23],
}
const RIGHT_COLUMN: RunnerSceneryFootprint = {
  min: [1.02, 0, -0.23],
  max: [1.48, 2.19, 0.23],
}
const PAVILION_FOUNDATION: RunnerSceneryFootprint = {
  min: [-1.65, -0.2, -0.7],
  max: [1.65, 0, 0.7],
}

export const RUNNER_SCENERY_ASSEMBLIES: Readonly<
  Record<RunnerSceneryKind, RunnerSceneryAssembly>
> = Object.freeze({
  pavilion: {
    donorParts: [
      donorPart('museum_arch', [0, 0, 0]),
      donorPart('museum_column', [-1.25, 0, 0]),
      donorPart('museum_column', [1.25, 0, 0]),
    ],
    footprints: [ARCH, LEFT_COLUMN, RIGHT_COLUMN, PAVILION_FOUNDATION],
    triangles: 704 + 2 * 2_384 + 12,
    drawPoolIds: [
      'pavilion:museum_brass',
      'pavilion:museum_ivory',
      'pavilion:museum_limestone',
    ],
    authoredCounts: { arches: 1, columns: 2 },
  },
  landmark: {
    donorParts: [
      donorPart('museum_rotunda', [-5.5, 0, 0], 0, 1.5),
      donorPart('museum_arch', [4.65, 0, 0]),
      donorPart('museum_column', [3.4, 0, 0]),
      donorPart('museum_column', [5.9, 0, 0]),
    ],
    footprints: [
      { min: [-7.6, 0, -2.1], max: [-3.4, 4.23, 2.1] },
      { min: [3.635, -0.02, -0.2], max: [5.665, 2.29, 0.2] },
      { min: [3.17, 0, -0.23], max: [3.63, 2.19, 0.23] },
      { min: [5.67, 0, -0.23], max: [6.13, 2.19, 0.23] },
      { min: [-7.8, -0.24, -2.2], max: [-3, 0, 2.2] },
      { min: [3, -0.2, -0.7], max: [6.3, 0, 0.7] },
    ],
    triangles: 21_936 + 704 + 2 * 2_384 + 24,
    drawPoolIds: [
      'landmark:museum_brass',
      'landmark:museum_ivory',
      'landmark:museum_limestone',
    ],
    authoredCounts: { arches: 1, columns: 2, rotundas: 1 },
  },
  garden: {
    donorParts: [
      donorPart('garden_perimeter', [-4.5, 0.12, -0.8]),
      donorPart('garden_perimeter', [4.5, 0.12, 0.8], Math.PI),
      donorPart('ivy_trail', [-4.5, 1.02, -0.8]),
      donorPart('ivy_trail', [4.5, 1.02, 0.8], Math.PI),
    ],
    footprints: [
      { min: [-5.2, 0, -1.075], max: [-3.8, 0.57, -0.525] },
      { min: [3.8, 0, 0.525], max: [5.2, 0.57, 1.075] },
      { min: [-5.01, 0.02, -0.95], max: [-4.01, 1.03, -0.57] },
      { min: [4.01, 0.02, 0.57], max: [5.01, 1.03, 0.95] },
      { min: [-6.3, -0.18, -1.7], max: [-3, 0, 3.2] },
      { min: [3, -0.18, -3.1], max: [6.3, 0, 1.8] },
    ],
    triangles: 2 * 4_552 + 2 * 1_056 + 24,
    drawPoolIds: ['garden:garden_palette', 'garden:museum_ivory'],
    authoredCounts: { perimeters: 2, ivy: 2 },
  },
  painting: {
    donorParts: [],
    footprints: [{ min: [-0.78, 0, -0.08], max: [0.78, 2.15, 0.08] }],
    triangles: 98,
    drawPoolIds: ['painting:plane', 'painting:frame'],
    authoredCounts: { paintings: 1 },
  },
  water: {
    donorParts: [],
    footprints: [{ min: [-1, -1.9, -0.01], max: [1, 1, 0.01] }],
    triangles: 40,
    drawPoolIds: ['water:surface'],
    authoredCounts: { pools: 1 },
  },
})

export interface RunnerSceneryPlacement {
  readonly id: string
  readonly chunkIndex: number
  readonly kind: RunnerSceneryKind
  readonly lateralX: number
  readonly floorY: number
  readonly courseDistanceMeters: number
  readonly yawRadians: number
  readonly scale: number
}

export interface RunnerSceneryWindowMetrics {
  readonly instances: number
  readonly triangles: number
  readonly drawBatches: number
  readonly authoredCounts: Readonly<Record<string, number>>
}

export interface RunnerSceneryWindow {
  readonly key: string
  readonly chunkIds: readonly string[]
  readonly placements: readonly RunnerSceneryPlacement[]
  readonly metrics: RunnerSceneryWindowMetrics
}

export interface RunnerSceneryHandoff {
  readonly atCourseDistanceMeters: number
  readonly outgoingChunkId: string
  readonly incomingChunkId: string
}

export interface RunnerSceneryLayout {
  readonly chunks: readonly {
    readonly id: string
    readonly index: number
    readonly placements: readonly RunnerSceneryPlacement[]
  }[]
  readonly windows: readonly RunnerSceneryWindow[]
  readonly handoffs: readonly RunnerSceneryHandoff[]
  select(courseDistanceMeters: number): RunnerSceneryWindow
}

function placement(
  course: CompiledRunnerCourse,
  chunkIndex: number,
  id: string,
  kind: RunnerSceneryKind,
  beat: number,
  lateralX: number,
  floorY = 0,
  yawRadians = 0,
): RunnerSceneryPlacement {
  return Object.freeze({
    id,
    chunkIndex,
    kind,
    lateralX,
    floorY,
    courseDistanceMeters: beat * course.metersPerBeat,
    yawRadians,
    scale: 1,
  })
}

function windowMetrics(
  placements: readonly RunnerSceneryPlacement[],
): RunnerSceneryWindowMetrics {
  const pools = new Set<string>()
  const authoredCounts: Record<string, number> = {}
  let triangles = 0
  for (const item of placements) {
    const assembly = RUNNER_SCENERY_ASSEMBLIES[item.kind]
    triangles += assembly.triangles
    assembly.drawPoolIds.forEach((id) => pools.add(id))
    for (const [name, count] of Object.entries(assembly.authoredCounts))
      authoredCounts[name] = (authoredCounts[name] ?? 0) + count
  }
  return Object.freeze({
    instances: placements.length,
    triangles,
    drawBatches: pools.size,
    authoredCounts: Object.freeze(authoredCounts),
  })
}

/** Builds the geometry-stable Singing Current dressing for either pace preset. */
export function createRunnerSceneryLayout(
  course: CompiledRunnerCourse,
): RunnerSceneryLayout {
  if (
    course.chunks.length !== 10 ||
    Math.abs(course.metersPerBeat - 1.2) > 1e-9 ||
    course.chunks.some(
      (chunk, index) =>
        chunk.index !== index ||
        Math.abs(chunk.startBeat - index * 16) > 1e-9 ||
        Math.abs(chunk.endBeat - (index + 1) * 16) > 1e-9,
    )
  )
    throw new Error(
      'Runner scenery requires the ten-chunk Singing Current geometry.',
    )

  const authored: RunnerSceneryPlacement[][] = Array.from(
    { length: 10 },
    () => [],
  )
  authored[0]!.push(
    placement(course, 0, 'arrival-pavilion', 'pavilion', 10.75, -4.65),
  )
  authored[2]!.push(
    placement(
      course,
      2,
      'gallery-painting',
      'painting',
      42.25,
      5.05,
      0.04,
      -Math.PI / 2 + 0.2,
    ),
  )
  authored[4]!.push(placement(course, 4, 'tempo-landmark', 'landmark', 74, 0))
  authored[6]!.push(
    placement(course, 6, 'conservatory-a', 'garden', 109.4, 0),
    placement(
      course,
      6,
      'conservatory-a-left-pond',
      'water',
      109.4,
      -5.05,
      0.025,
    ),
    placement(
      course,
      6,
      'conservatory-a-right-pond',
      'water',
      109.4,
      5.05,
      0.025,
      Math.PI,
    ),
  )
  authored[7]!.push(
    placement(course, 7, 'conservatory-b', 'garden', 118, 0),
    placement(
      course,
      7,
      'conservatory-b-left-pond',
      'water',
      118,
      -5.05,
      0.025,
    ),
    placement(
      course,
      7,
      'conservatory-b-right-pond',
      'water',
      118,
      5.05,
      0.025,
      Math.PI,
    ),
  )
  authored[9]!.push(
    placement(course, 9, 'finale-left-pavilion', 'pavilion', 155, -4.65),
    placement(course, 9, 'finale-right-pavilion', 'pavilion', 155, 4.65),
  )

  const chunks = Object.freeze(
    course.chunks.map((chunk, index) =>
      Object.freeze({
        id: chunk.id,
        index,
        placements: Object.freeze(authored[index]!),
      }),
    ),
  )
  const windows = Object.freeze(
    Array.from({ length: 9 }, (_, index) => {
      const chunkIds = Object.freeze([chunks[index]!.id, chunks[index + 1]!.id])
      const placements = Object.freeze([
        ...chunks[index]!.placements,
        ...chunks[index + 1]!.placements,
      ])
      return Object.freeze({
        key: `${index}:${index + 1}`,
        chunkIds,
        placements,
        metrics: windowMetrics(placements),
      })
    }),
  )
  const handoffBeats = [14.2, 32, 44.67, 64, 78.75, 87, 115, 125]
  const handoffs = Object.freeze(
    handoffBeats.map((beat, index) =>
      Object.freeze({
        atCourseDistanceMeters: beat * course.metersPerBeat,
        outgoingChunkId: chunks[index]!.id,
        incomingChunkId: chunks[index + 2]!.id,
      }),
    ),
  )

  return Object.freeze({
    chunks,
    windows,
    handoffs,
    select(courseDistanceMeters: number) {
      const distance = Number.isFinite(courseDistanceMeters)
        ? Math.max(0, courseDistanceMeters)
        : 0
      let index = 0
      while (
        index < handoffs.length &&
        distance >= handoffs[index]!.atCourseDistanceMeters
      )
        index++
      return windows[index]!
    },
  })
}

const matrixPosition = new Vector3()
const matrixScale = new Vector3()
const matrixRotation = new Quaternion()
const up = new Vector3(0, 1, 0)

/** Writes a placement matrix local to the moving scenery root. */
export function runnerSceneryPlacementMatrix(
  item: RunnerSceneryPlacement,
  target = new Matrix4(),
): Matrix4 {
  matrixPosition.set(item.lateralX, item.floorY, -item.courseDistanceMeters)
  matrixRotation.setFromAxisAngle(up, item.yawRadians)
  if (item.kind === 'water') {
    matrixRotation.multiply(
      new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2),
    )
    matrixScale.set(1.2 * item.scale, 1.6 * item.scale, item.scale)
  } else matrixScale.setScalar(item.scale)
  return target.compose(matrixPosition, matrixRotation, matrixScale)
}

/** Returns disjoint conservative bounds, preserving open lane space in wide assemblies. */
export function runnerSceneryPlacementBounds(
  item: RunnerSceneryPlacement,
): readonly Box3[] {
  const matrix = runnerSceneryPlacementMatrix(item)
  return RUNNER_SCENERY_ASSEMBLIES[item.kind].footprints.map((footprint) =>
    new Box3(
      new Vector3(...footprint.min),
      new Vector3(...footprint.max),
    ).applyMatrix4(matrix),
  )
}

function cameraFor(aspect: number): PerspectiveCamera {
  const camera = new PerspectiveCamera(60, aspect, 0.08, 65)
  const pose = runnerCameraPose(aspect)
  camera.position.set(pose.x, pose.y, pose.z)
  camera.lookAt(0, pose.targetY, pose.targetZ)
  camera.updateProjectionMatrix()
  camera.updateMatrixWorld(true)
  return camera
}

function minimumViewDepth(box: Box3, camera: PerspectiveCamera): number {
  let minimum = Number.POSITIVE_INFINITY
  for (const x of [box.min.x, box.max.x])
    for (const y of [box.min.y, box.max.y])
      for (const z of [box.min.z, box.max.z]) {
        const point = new Vector3(x, y, z).applyMatrix4(
          camera.matrixWorldInverse,
        )
        minimum = Math.min(minimum, -point.z)
      }
  return minimum
}

/** Test/debug receipt for the exact outgoing-frustum and incoming-fog handoff rule. */
export function runnerSceneryHandoffVisibility(
  layout: RunnerSceneryLayout,
  handoff: RunnerSceneryHandoff,
  aspect: number,
): {
  readonly outgoingVisible: boolean
  readonly incomingFullyFogged: boolean
} {
  const camera = cameraFor(aspect)
  const projectionView = new Matrix4().multiplyMatrices(
    camera.projectionMatrix,
    camera.matrixWorldInverse,
  )
  const frustum = new Frustum().setFromProjectionMatrix(projectionView)
  const rootOffset = new Vector3(0, 0, handoff.atCourseDistanceMeters)
  const chunk = (id: string) =>
    layout.chunks.find((candidate) => candidate.id === id)!
  const boxes = (id: string) =>
    chunk(id).placements.flatMap((item) =>
      runnerSceneryPlacementBounds(item).map((box) =>
        box.clone().translate(rootOffset),
      ),
    )
  return Object.freeze({
    outgoingVisible: boxes(handoff.outgoingChunkId).some((box) =>
      frustum.intersectsBox(box),
    ),
    incomingFullyFogged: boxes(handoff.incomingChunkId).every(
      (box) => minimumViewDepth(box, camera) >= RUNNER_SCENERY_FOG_FAR + 0.2,
    ),
  })
}
