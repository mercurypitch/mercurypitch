// Runner scenery projection — certifies fog-safe streamed handoffs against every supported camera framing.

import { Box3, Frustum, Matrix4, PerspectiveCamera } from 'three'
import type { CompiledRunnerCourse } from '../runner/contracts'
import { runnerCameraFollowTarget, runnerCameraPose, } from './runner-world-layout'

export const RUNNER_SCENERY_FOG_FAR = 37
// The oblique view sees retiring side art longer; this veil preserves two-chunk handoffs.
export const RUNNER_SCENERY_ANGLED_FOG_FAR = 35
export const RUNNER_SCENERY_LEGACY_FOG_FAR = 30
export const RUNNER_SCENERY_VALIDATED_ASPECTS = Object.freeze([
  320 / 740,
  390 / 844,
  768 / 1024,
  1024 / 768,
  1440 / 900,
  740 / 360,
  21 / 9,
  844 / 310,
])

export interface RunnerSceneryHandoff {
  readonly atCourseDistanceMeters: number
  readonly outgoingChunkId: string
  readonly incomingChunkId: string
}

export interface RunnerSceneryProjectionChunk {
  readonly id: string
  readonly bounds: readonly Box3[]
}

interface RunnerSceneryCameraReceipt {
  readonly aspect: number
  readonly playerLateralX: number
  readonly camera: PerspectiveCamera
  readonly frustum: Frustum
  readonly followOffsetRange?: readonly [number, number]
}

export interface RunnerSceneryVisibilityContext {
  readonly laneCenters: CompiledRunnerCourse['laneCenters']
  readonly cameraProfile: CompiledRunnerCourse['presentation']['cameraProfile']
  readonly boxesByChunk: ReadonlyMap<string, readonly Box3[]>
  readonly cameras: readonly RunnerSceneryCameraReceipt[]
  readonly continuous: boolean
}

/** Wide comparison courses use a nearer veil so dense art can still hand off unseen. */
export function runnerSceneryFogFar(
  laneCenters: CompiledRunnerCourse['laneCenters'],
  cameraProfile?: CompiledRunnerCourse['presentation']['cameraProfile'],
): number {
  if (cameraProfile === 'steering-angled') return RUNNER_SCENERY_ANGLED_FOG_FAR
  return cameraProfile === 'responsive-close' ||
    cameraProfile === 'steering-close' ||
    (cameraProfile === undefined && laneCenters[2] - laneCenters[0] <= 2.75)
    ? RUNNER_SCENERY_FOG_FAR
    : RUNNER_SCENERY_LEGACY_FOG_FAR
}

function cameraFor(
  aspect: number,
  laneCenters: CompiledRunnerCourse['laneCenters'],
  playerLateralX: number,
  cameraProfile?: CompiledRunnerCourse['presentation']['cameraProfile'],
  continuous = false,
): PerspectiveCamera {
  const pose = runnerCameraPose(aspect, laneCenters, cameraProfile)
  const followX = runnerCameraFollowTarget(
    playerLateralX,
    laneCenters,
    aspect,
    cameraProfile,
    continuous,
  )
  const camera = new PerspectiveCamera(pose.fovDegrees, aspect, 0.08, 75)
  camera.position.set(pose.x + followX, pose.y, pose.z)
  camera.lookAt(pose.targetX + followX, pose.targetY, pose.targetZ)
  camera.updateProjectionMatrix()
  camera.updateMatrixWorld(true)
  return camera
}

function cameraReceipt(
  aspect: number,
  laneCenters: CompiledRunnerCourse['laneCenters'],
  playerLateralX: number,
  cameraProfile?: CompiledRunnerCourse['presentation']['cameraProfile'],
  continuous = false,
): RunnerSceneryCameraReceipt {
  const camera = cameraFor(
    aspect,
    laneCenters,
    playerLateralX,
    cameraProfile,
    continuous,
  )
  const projectionView = new Matrix4().multiplyMatrices(
    camera.projectionMatrix,
    camera.matrixWorldInverse,
  )
  return Object.freeze({
    aspect,
    playerLateralX,
    camera,
    frustum: new Frustum().setFromProjectionMatrix(projectionView),
  })
}

export function createRunnerSceneryVisibilityContext(
  laneCenters: CompiledRunnerCourse['laneCenters'],
  chunks: readonly RunnerSceneryProjectionChunk[],
  cameraProfile?: CompiledRunnerCourse['presentation']['cameraProfile'],
  lateralRange?: readonly [number, number],
): RunnerSceneryVisibilityContext {
  const boxesByChunk = new Map<string, readonly Box3[]>()
  for (const chunk of chunks) boxesByChunk.set(chunk.id, chunk.bounds)
  const cameras: RunnerSceneryCameraReceipt[] = []
  for (const aspect of RUNNER_SCENERY_VALIDATED_ASPECTS) {
    if (lateralRange) {
      const center = (lateralRange[0] + lateralRange[1]) / 2
      const receipt = cameraReceipt(
        aspect,
        laneCenters,
        center,
        cameraProfile,
        true,
      )
      const centerFollow = runnerCameraFollowTarget(
        center,
        laneCenters,
        aspect,
        cameraProfile,
        true,
      )
      const firstOffset =
        runnerCameraFollowTarget(
          lateralRange[0],
          laneCenters,
          aspect,
          cameraProfile,
          true,
        ) - centerFollow
      const lastOffset =
        runnerCameraFollowTarget(
          lateralRange[1],
          laneCenters,
          aspect,
          cameraProfile,
          true,
        ) - centerFollow
      // Follow moves camera and target by the same X, with no rotation. Its
      // bounded lag remains between targets. Expanding each box by the inverse
      // translation interval covers every intermediate camera, even when a
      // narrow near-plane object fits between a finite set of sample probes.
      cameras.push(
        Object.freeze({
          ...receipt,
          followOffsetRange: Object.freeze([
            Math.min(firstOffset, lastOffset),
            Math.max(firstOffset, lastOffset),
          ] as const),
        }),
      )
      continue
    }
    const followPositions = [laneCenters[0], 0, laneCenters[2]]
    const seenFollowXs = new Set<number>()
    for (const playerLateralX of followPositions) {
      const followX = runnerCameraFollowTarget(
        playerLateralX,
        laneCenters,
        aspect,
        cameraProfile,
        lateralRange !== undefined,
      )
      if (seenFollowXs.has(followX)) continue
      seenFollowXs.add(followX)
      cameras.push(
        cameraReceipt(
          aspect,
          laneCenters,
          playerLateralX,
          cameraProfile,
          lateralRange !== undefined,
        ),
      )
    }
  }
  return Object.freeze({
    laneCenters,
    cameraProfile,
    boxesByChunk,
    cameras,
    continuous: lateralRange !== undefined,
  })
}

function minimumViewDepth(
  box: Box3,
  camera: PerspectiveCamera,
  courseDistanceMeters: number,
  minFollowOffset = 0,
  maxFollowOffset = 0,
): number {
  let minimum = Number.POSITIVE_INFINITY
  const elements = camera.matrixWorldInverse.elements
  for (const x of [box.min.x - maxFollowOffset, box.max.x - minFollowOffset])
    for (const y of [box.min.y, box.max.y])
      for (const z of [box.min.z, box.max.z])
        minimum = Math.min(
          minimum,
          -(
            elements[2]! * x +
            elements[6]! * y +
            elements[10]! * (z + courseDistanceMeters) +
            elements[14]!
          ),
        )
  return minimum
}

const translatedBounds = new Box3()

function translatedIntersectsFrustum(
  box: Box3,
  courseDistanceMeters: number,
  frustum: Frustum,
  minFollowOffset = 0,
  maxFollowOffset = 0,
): boolean {
  translatedBounds.min.set(
    box.min.x - maxFollowOffset,
    box.min.y,
    box.min.z + courseDistanceMeters,
  )
  translatedBounds.max.set(
    box.max.x - minFollowOffset,
    box.max.y,
    box.max.z + courseDistanceMeters,
  )
  return frustum.intersectsBox(translatedBounds)
}

function visibilityAtDistance(
  context: RunnerSceneryVisibilityContext,
  outgoingChunkId: string,
  incomingChunkId: string,
  courseDistanceMeters: number,
  receipt: RunnerSceneryCameraReceipt,
  includeContinuousEnvelope = false,
): {
  readonly outgoingVisible: boolean
  readonly incomingFullyFogged: boolean
} {
  const outgoing = context.boxesByChunk.get(outgoingChunkId)!
  const incoming = context.boxesByChunk.get(incomingChunkId)!
  const minOffset = includeContinuousEnvelope
    ? (receipt.followOffsetRange?.[0] ?? 0)
    : 0
  const maxOffset = includeContinuousEnvelope
    ? (receipt.followOffsetRange?.[1] ?? 0)
    : 0
  return Object.freeze({
    outgoingVisible: outgoing.some((box) =>
      translatedIntersectsFrustum(
        box,
        courseDistanceMeters,
        receipt.frustum,
        minOffset,
        maxOffset,
      ),
    ),
    incomingFullyFogged: incoming.every(
      (box) =>
        minimumViewDepth(
          box,
          receipt.camera,
          courseDistanceMeters,
          minOffset,
          maxOffset,
        ) >=
        runnerSceneryFogFar(context.laneCenters, context.cameraProfile) + 0.2,
    ),
  })
}

const HANDOFF_SEARCH_STEP_METERS = 0.05

function firstGridDistance(
  minimum: number,
  maximum: number,
  predicate: (distance: number) => boolean,
): number | undefined {
  let low = Math.ceil(minimum / HANDOFF_SEARCH_STEP_METERS)
  let high = Math.floor(maximum / HANDOFF_SEARCH_STEP_METERS)
  if (low > high || !predicate(high * HANDOFF_SEARCH_STEP_METERS)) return
  while (low < high) {
    const middle = Math.floor((low + high) / 2)
    if (predicate(middle * HANDOFF_SEARCH_STEP_METERS)) high = middle
    else low = middle + 1
  }
  return low * HANDOFF_SEARCH_STEP_METERS
}

function lastGridDistance(
  minimum: number,
  maximum: number,
  predicate: (distance: number) => boolean,
): number | undefined {
  let low = Math.ceil(minimum / HANDOFF_SEARCH_STEP_METERS)
  let high = Math.floor(maximum / HANDOFF_SEARCH_STEP_METERS)
  if (low > high || !predicate(low * HANDOFF_SEARCH_STEP_METERS)) return
  while (low < high) {
    const middle = Math.ceil((low + high) / 2)
    if (predicate(middle * HANDOFF_SEARCH_STEP_METERS)) low = middle
    else high = middle - 1
  }
  return low * HANDOFF_SEARCH_STEP_METERS
}

export function createRunnerSceneryHandoffs(
  course: CompiledRunnerCourse,
  chunks: readonly RunnerSceneryProjectionChunk[],
  visibility: RunnerSceneryVisibilityContext,
): readonly RunnerSceneryHandoff[] {
  const handoffs: RunnerSceneryHandoff[] = []
  for (let index = 0; index < chunks.length - 2; index++) {
    const outgoing = chunks[index]!
    const incoming = chunks[index + 2]!
    const minimum = Math.max(
      handoffs.at(-1)?.atCourseDistanceMeters ?? 0,
      course.chunks[index]!.minCourseDistanceMeters,
    )
    const maximum = course.chunks[index + 1]!.maxCourseDistanceMeters
    const receiptsAt = (distance: number) =>
      visibility.cameras.map((receipt) =>
        visibilityAtDistance(
          visibility,
          outgoing.id,
          incoming.id,
          distance,
          receipt,
          true,
        ),
      )
    // Both predicates are monotone as the moving root carries outgoing art
    // behind the camera and incoming art toward it. Search the same 5cm grid
    // as the original proof without blocking startup on a linear scan.
    const firstInvisible = firstGridDistance(minimum, maximum, (distance) =>
      receiptsAt(distance).every((receipt) => !receipt.outgoingVisible),
    )
    const lastFogged = lastGridDistance(minimum, maximum, (distance) =>
      receiptsAt(distance).every((receipt) => receipt.incomingFullyFogged),
    )
    const selected =
      firstInvisible !== undefined &&
      lastFogged !== undefined &&
      firstInvisible <= lastFogged
        ? firstInvisible
        : undefined
    if (selected === undefined)
      throw new Error(
        `Runner scenery has no invisible handoff from ${outgoing.id} to ${incoming.id} (out after ${firstInvisible ?? 'never'}m, fog until ${lastFogged ?? 'never'}m).`,
      )
    handoffs.push(
      Object.freeze({
        atCourseDistanceMeters: selected,
        outgoingChunkId: outgoing.id,
        incomingChunkId: incoming.id,
      }),
    )
  }
  return Object.freeze(handoffs)
}

/** Reads one exact outgoing-frustum and incoming-fog handoff receipt. */
export function runnerSceneryHandoffVisibilityAt(
  context: RunnerSceneryVisibilityContext,
  handoff: RunnerSceneryHandoff,
  aspect: number,
  playerLateralX = 0,
): {
  readonly outgoingVisible: boolean
  readonly incomingFullyFogged: boolean
} {
  const receipt =
    context.cameras.find(
      (candidate) =>
        Math.abs(candidate.aspect - aspect) < 1e-12 &&
        Math.abs(
          runnerCameraFollowTarget(
            candidate.playerLateralX,
            context.laneCenters,
            aspect,
            context.cameraProfile,
            context.continuous,
          ) -
            runnerCameraFollowTarget(
              playerLateralX,
              context.laneCenters,
              aspect,
              context.cameraProfile,
              context.continuous,
            ),
        ) < 1e-12,
    ) ??
    cameraReceipt(
      aspect,
      context.laneCenters,
      playerLateralX,
      context.cameraProfile,
      context.continuous,
    )
  return visibilityAtDistance(
    context,
    handoff.outgoingChunkId,
    handoff.incomingChunkId,
    handoff.atCourseDistanceMeters,
    receipt,
  )
}
