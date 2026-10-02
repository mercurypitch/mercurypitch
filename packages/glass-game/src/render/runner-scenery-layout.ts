// Runner scenery layout — reference-led architecture, gardens and water in fog-safe streamed windows.

import { Box3, Matrix4, Quaternion, Vector3 } from 'three'
import type { CompiledRunnerCourse } from '../runner/contracts'
import type { RunnerSceneryHandoff, RunnerSceneryProjectionChunk, RunnerSceneryVisibilityContext, } from './runner-scenery-projection'
import { createRunnerSceneryHandoffs, createRunnerSceneryVisibilityContext, runnerSceneryHandoffVisibilityAt, } from './runner-scenery-projection'
import { runnerTrackBounds } from './runner-world-layout'

const TERRACE_HALF_WIDTH_METERS = 1.68
const TERRACE_HALF_DEPTH_METERS = 1.62
const ROUTE_CLEARANCE_METERS = 0.14

export {
  RUNNER_SCENERY_FOG_FAR,
  RUNNER_SCENERY_LEGACY_FOG_FAR,
  RUNNER_SCENERY_VALIDATED_ASPECTS,
  runnerSceneryFogFar,
} from './runner-scenery-projection'
export type { RunnerSceneryHandoff } from './runner-scenery-projection'

export type RunnerSceneryKind =
  | 'terrace'
  | 'canopy'
  | 'arcade'
  | 'water'
  | 'waterfall'

export type RunnerSceneryDonorPrefab =
  | 'museum_balustrade'
  | 'platform_terrace'
  | 'garden_perimeter'
  | 'garden_foliage'
  | 'island_root'
  | 'ivy_trail'
  | 'meshy_garden_arcade'
  | 'meshy_observatory_canopy'

export type RunnerSceneryDonorSource = 'museum' | 'garden' | 'arcade' | 'canopy'

export interface RunnerSceneryDonorPart {
  readonly source: RunnerSceneryDonorSource
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
  | 'terraces'
  | 'balustrades'
  | 'gardenBeds'
  | 'ivy'
  | 'canopies'
  | 'arcades'
  | 'pools'
  | 'waterfalls'

function donorPart(
  source: RunnerSceneryDonorSource,
  prefab: RunnerSceneryDonorPrefab,
  position: readonly [number, number, number] = [0, 0, 0],
  yawRadians = 0,
  scale = 1,
): RunnerSceneryDonorPart {
  return Object.freeze({ source, prefab, position, yawRadians, scale })
}

/**
 * One reusable garden island. The platform, stone root, rails, planting and ivy
 * all come from finished shipped donors; no placeholder slab stands in for art.
 */
export const RUNNER_SCENERY_ASSEMBLIES: Readonly<
  Record<RunnerSceneryKind, RunnerSceneryAssembly>
> = Object.freeze({
  terrace: {
    donorParts: [
      donorPart('museum', 'platform_terrace'),
      donorPart('garden', 'island_root'),
      donorPart('museum', 'museum_balustrade', [-1.49, 0, -1], Math.PI / 2),
      donorPart('museum', 'museum_balustrade', [-1.49, 0, 0], Math.PI / 2),
      donorPart('museum', 'museum_balustrade', [-1.49, 0, 1], Math.PI / 2),
      donorPart(
        'garden',
        'garden_perimeter',
        [0.42, 0.07, -0.55],
        Math.PI,
        1.3,
      ),
      donorPart('garden', 'garden_foliage', [0.43, 0.07, 0.55], 0, 1.3),
      donorPart('garden', 'ivy_trail', [-1.42, 1, 0.12], Math.PI / 2, 1.1),
    ],
    footprints: [
      {
        min: [-TERRACE_HALF_WIDTH_METERS, -2.62, -TERRACE_HALF_DEPTH_METERS],
        max: [TERRACE_HALF_WIDTH_METERS, 1.04, TERRACE_HALF_DEPTH_METERS],
      },
    ],
    triangles: 25_504,
    drawPoolIds: [
      'terrace:museum:museum_brass',
      'terrace:museum:museum_ivory',
      'terrace:museum:museum_limestone',
      'terrace:museum:museum_petrol',
      'terrace:garden:garden_palette',
      'terrace:garden:museum_ivory',
      'terrace:garden:museum_limestone',
    ],
    authoredCounts: {
      terraces: 1,
      balustrades: 3,
      gardenBeds: 2,
      ivy: 1,
    },
  },
  canopy: {
    donorParts: [donorPart('canopy', 'meshy_observatory_canopy')],
    footprints: [{ min: [-1.311, 0, -1.312], max: [1.311, 3, 1.312] }],
    triangles: 40_424,
    drawPoolIds: ['canopy:canopy:meshy_observatory_canopy_atlas'],
    authoredCounts: { canopies: 1 },
  },
  arcade: {
    donorParts: [donorPart('arcade', 'meshy_garden_arcade')],
    footprints: [{ min: [-2.832, 0, -0.41], max: [2.832, 3, 0.41] }],
    triangles: 28_161,
    drawPoolIds: ['arcade:arcade:meshy_garden_arcade_atlas'],
    authoredCounts: { arcades: 1 },
  },
  water: {
    donorParts: [],
    footprints: [{ min: [-1, -1.9, -0.01], max: [1, 1, 0.01] }],
    triangles: 40,
    drawPoolIds: ['water:surface'],
    authoredCounts: { pools: 1 },
  },
  waterfall: {
    donorParts: [],
    footprints: [{ min: [-1, -1.9, -0.01], max: [1, 1, 0.01] }],
    triangles: 40,
    drawPoolIds: ['waterfall:surface'],
    authoredCounts: { waterfalls: 1 },
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

export interface RunnerSceneryLayout {
  readonly laneCenters: CompiledRunnerCourse['laneCenters']
  readonly cameraProfile?: CompiledRunnerCourse['presentation']['cameraProfile']
  readonly chunks: readonly {
    readonly id: string
    readonly index: number
    readonly placements: readonly RunnerSceneryPlacement[]
  }[]
  readonly windows: readonly RunnerSceneryWindow[]
  readonly handoffs: readonly RunnerSceneryHandoff[]
  select(courseDistanceMeters: number): RunnerSceneryWindow
}

const visibilityContexts = new WeakMap<
  RunnerSceneryLayout,
  RunnerSceneryVisibilityContext
>()

type ScenerySide = -1 | 1

interface RunnerSceneryMotif {
  readonly architecture: 'canopy' | 'arcade'
  readonly side: ScenerySide
  readonly architectureBeatOffset: number
  readonly architectureScale: number
  readonly poolBeatOffset: number
  readonly poolTerraceScale: number
}

const COURSE_MOTIFS: readonly RunnerSceneryMotif[] = Object.freeze([
  {
    architecture: 'canopy',
    side: -1,
    architectureBeatOffset: 7.6,
    architectureScale: 1.06,
    poolBeatOffset: 3.6,
    poolTerraceScale: 1,
  },
  {
    architecture: 'arcade',
    side: 1,
    architectureBeatOffset: 8.2,
    architectureScale: 0.94,
    poolBeatOffset: 10.5,
    poolTerraceScale: 1,
  },
  {
    architecture: 'canopy',
    side: -1,
    architectureBeatOffset: 8.5,
    architectureScale: 1,
    poolBeatOffset: 6.1,
    poolTerraceScale: 0.94,
  },
  {
    architecture: 'canopy',
    side: 1,
    architectureBeatOffset: 8.8,
    architectureScale: 1.03,
    poolBeatOffset: 6.2,
    poolTerraceScale: 1.02,
  },
  {
    architecture: 'arcade',
    side: 1,
    architectureBeatOffset: 8.5,
    architectureScale: 0.96,
    poolBeatOffset: 10.4,
    poolTerraceScale: 0.96,
  },
  {
    architecture: 'arcade',
    side: -1,
    architectureBeatOffset: 7.6,
    architectureScale: 0.96,
    poolBeatOffset: 10.2,
    poolTerraceScale: 1,
  },
  {
    architecture: 'canopy',
    side: -1,
    architectureBeatOffset: 8.7,
    architectureScale: 1.08,
    poolBeatOffset: 6.2,
    poolTerraceScale: 0.96,
  },
  {
    architecture: 'arcade',
    side: 1,
    architectureBeatOffset: 8.1,
    architectureScale: 0.94,
    poolBeatOffset: 10.4,
    poolTerraceScale: 1.02,
  },
  {
    architecture: 'canopy',
    side: 1,
    architectureBeatOffset: 8.4,
    architectureScale: 1.02,
    poolBeatOffset: 6.1,
    poolTerraceScale: 0.95,
  },
  {
    architecture: 'arcade',
    side: -1,
    architectureBeatOffset: 7.8,
    architectureScale: 1,
    poolBeatOffset: 10.2,
    poolTerraceScale: 1.04,
  },
])

function placementAtDistance(
  chunkIndex: number,
  id: string,
  kind: RunnerSceneryKind,
  courseDistanceMeters: number,
  lateralX: number,
  floorY = 0,
  yawRadians = 0,
  scale = 1,
): RunnerSceneryPlacement {
  return Object.freeze({
    chunkIndex,
    id,
    kind,
    courseDistanceMeters,
    lateralX,
    floorY,
    yawRadians,
    scale,
  })
}

function terraceCenterX(
  course: CompiledRunnerCourse,
  side: ScenerySide,
  scale: number,
): number {
  const track = runnerTrackBounds(course)
  const offset = ROUTE_CLEARANCE_METERS + TERRACE_HALF_WIDTH_METERS * scale
  return side < 0 ? track.left - offset : track.right + offset
}

function waterfallX(course: CompiledRunnerCourse, side: ScenerySide): number {
  const track = runnerTrackBounds(course)
  return side < 0
    ? track.left - ROUTE_CLEARANCE_METERS
    : track.right + ROUTE_CLEARANCE_METERS
}

function addTerrace(
  authored: RunnerSceneryPlacement[],
  course: CompiledRunnerCourse,
  chunkIndex: number,
  id: string,
  side: ScenerySide,
  courseDistanceMeters: number,
  scale: number,
): void {
  authored.push(
    placementAtDistance(
      chunkIndex,
      id,
      'terrace',
      courseDistanceMeters,
      terraceCenterX(course, side, scale),
      0,
      side < 0 ? Math.PI : 0,
      scale,
    ),
  )
}

function addPoolTerrace(
  authored: RunnerSceneryPlacement[],
  course: CompiledRunnerCourse,
  chunkIndex: number,
  id: string,
  beat: number,
  side: ScenerySide,
  terraceScale: number,
): void {
  const distance = beat * course.metersPerBeat
  const centerX = terraceCenterX(course, side, terraceScale)
  addTerrace(
    authored,
    course,
    chunkIndex,
    `${id}-terrace`,
    side,
    distance,
    terraceScale,
  )
  authored.push(
    placementAtDistance(
      chunkIndex,
      `${id}-pool`,
      'water',
      distance,
      centerX,
      0.025,
      side < 0 ? Math.PI / 2 : -Math.PI / 2,
      terraceScale,
    ),
    placementAtDistance(
      chunkIndex,
      `${id}-fall`,
      'waterfall',
      distance,
      waterfallX(course, side),
      -0.88 * terraceScale,
      side < 0 ? -Math.PI / 2 : Math.PI / 2,
      terraceScale,
    ),
  )
}

function addArchitecture(
  authored: RunnerSceneryPlacement[],
  course: CompiledRunnerCourse,
  chunkIndex: number,
  motif: RunnerSceneryMotif,
): void {
  const chunk = course.chunks[chunkIndex]!
  const side = motif.side
  const distance =
    (chunk.startBeat + motif.architectureBeatOffset) * course.metersPerBeat
  const baseScale = Math.max(1, motif.architectureScale)
  const centerX = terraceCenterX(course, side, baseScale)
  if (motif.architecture === 'canopy') {
    addTerrace(
      authored,
      course,
      chunkIndex,
      `chapter-${chunkIndex}-canopy-terrace`,
      side,
      distance,
      baseScale,
    )
    authored.push(
      placementAtDistance(
        chunkIndex,
        `chapter-${chunkIndex}-canopy`,
        'canopy',
        distance,
        centerX,
        0,
        side < 0 ? Math.PI : 0,
        motif.architectureScale,
      ),
    )
    return
  }

  const terraceOffset = 1.48 * baseScale
  addTerrace(
    authored,
    course,
    chunkIndex,
    `chapter-${chunkIndex}-arcade-terrace-near`,
    side,
    distance - terraceOffset,
    baseScale,
  )
  addTerrace(
    authored,
    course,
    chunkIndex,
    `chapter-${chunkIndex}-arcade-terrace-far`,
    side,
    distance + terraceOffset,
    baseScale,
  )
  authored.push(
    placementAtDistance(
      chunkIndex,
      `chapter-${chunkIndex}-arcade`,
      'arcade',
      distance,
      centerX,
      0,
      side < 0 ? -Math.PI / 2 : Math.PI / 2,
      motif.architectureScale,
    ),
  )
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

function validateCourseShape(course: CompiledRunnerCourse): void {
  if (
    course.chunks.length !== COURSE_MOTIFS.length ||
    !Number.isFinite(course.metersPerBeat) ||
    course.metersPerBeat <= 0 ||
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
}

/** Builds the geometry-stable Singing Current dressing for every pace preset. */
export function createRunnerSceneryLayout(
  course: CompiledRunnerCourse,
): RunnerSceneryLayout {
  validateCourseShape(course)
  const authored: RunnerSceneryPlacement[][] = Array.from(
    { length: course.chunks.length },
    () => [],
  )
  course.chunks.forEach((chunk, chunkIndex) => {
    const motif = COURSE_MOTIFS[chunkIndex]!
    addArchitecture(authored[chunkIndex]!, course, chunkIndex, motif)
    addPoolTerrace(
      authored[chunkIndex]!,
      course,
      chunkIndex,
      `chapter-${chunkIndex}-garden`,
      chunk.startBeat + motif.poolBeatOffset,
      motif.side < 0 ? 1 : -1,
      motif.poolTerraceScale,
    )
  })

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
    Array.from({ length: chunks.length - 1 }, (_, index) => {
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
  const projectionChunks = sceneryProjectionChunks(chunks)
  const visibility = createRunnerSceneryVisibilityContext(
    course.laneCenters,
    projectionChunks,
    course.presentation.cameraProfile,
  )
  const handoffs = createRunnerSceneryHandoffs(
    course,
    projectionChunks,
    visibility,
  )
  const layout: RunnerSceneryLayout = Object.freeze({
    laneCenters: course.laneCenters,
    cameraProfile: course.presentation.cameraProfile,
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
  visibilityContexts.set(layout, visibility)
  return layout
}

const matrixPosition = new Vector3()
const matrixScale = new Vector3()
const matrixRotation = new Quaternion()
const up = new Vector3(0, 1, 0)
const xAxis = new Vector3(1, 0, 0)

/** Writes a placement matrix local to the moving scenery root. */
export function runnerSceneryPlacementMatrix(
  item: RunnerSceneryPlacement,
  target = new Matrix4(),
): Matrix4 {
  matrixPosition.set(item.lateralX, item.floorY, -item.courseDistanceMeters)
  matrixRotation.setFromAxisAngle(up, item.yawRadians)
  if (item.kind === 'water') {
    matrixRotation.multiply(
      new Quaternion().setFromAxisAngle(xAxis, -Math.PI / 2),
    )
    matrixScale.set(1.08 * item.scale, 0.86 * item.scale, item.scale)
  } else if (item.kind === 'waterfall') {
    matrixScale.set(0.88 * item.scale, 0.88 * item.scale, item.scale)
  } else matrixScale.setScalar(item.scale)
  return target.compose(matrixPosition, matrixRotation, matrixScale)
}

/** Returns conservative art bounds for collision-clearance and handoff receipts. */
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

function sceneryProjectionChunks(
  chunks: RunnerSceneryLayout['chunks'],
): readonly RunnerSceneryProjectionChunk[] {
  return Object.freeze(
    chunks.map((chunk) =>
      Object.freeze({
        id: chunk.id,
        bounds: Object.freeze(
          chunk.placements.flatMap((item) =>
            runnerSceneryPlacementBounds(item),
          ),
        ),
      }),
    ),
  )
}

/** Test/debug receipt for the exact outgoing-frustum and incoming-fog handoff rule. */
export function runnerSceneryHandoffVisibility(
  layout: RunnerSceneryLayout,
  handoff: RunnerSceneryHandoff,
  aspect: number,
  playerLateralX = 0,
): {
  readonly outgoingVisible: boolean
  readonly incomingFullyFogged: boolean
} {
  const context =
    visibilityContexts.get(layout) ??
    createRunnerSceneryVisibilityContext(
      layout.laneCenters,
      sceneryProjectionChunks(layout.chunks),
      layout.cameraProfile,
    )
  return runnerSceneryHandoffVisibilityAt(
    context,
    handoff,
    aspect,
    playerLateralX,
  )
}
