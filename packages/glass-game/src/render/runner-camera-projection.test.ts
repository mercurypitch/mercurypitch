// Runner camera projections — the shipped posed Merc and actual cue distances remain readable.
import { readFileSync } from 'node:fs'
import type { Mesh } from 'three'
import { PerspectiveCamera, SkinnedMesh, Vector3 } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GLASS_GAME_ASSET_FILES } from '../browser/assets'
import { SINGING_CURRENT } from '../runner/first-course'
import { runnerUsefulJumpWindow } from '../runner/movement-cues'
import { runnerSecondsToBeat } from '../runner/tempo'
import { loadAdventureMerc } from './merc'
import { runnerCameraFollowTarget, runnerCameraPose, runnerMercVisualHeightMeters, stepRunnerCameraFollow, } from './runner-world-layout'

const bytes = readFileSync(
  new URL(
    `../../../../apps/beside-cue/public/games/${GLASS_GAME_ASSET_FILES.merc}`,
    import.meta.url,
  ),
)
const course = SINGING_CURRENT
const viewports = [
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
  { width: 844, height: 390 },
]
let merc: Awaited<ReturnType<typeof loadAdventureMerc>>

beforeEach(async () => {
  // Only file delivery is substituted; the real GLB, loader, animation and
  // production Merc adapter determine every measured vertex.
  const gltf = await new GLTFLoader().parseAsync(
    Uint8Array.from(bytes).buffer,
    '',
  )
  vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockResolvedValueOnce(gltf)
  merc = await loadAdventureMerc('fixture://shipped-merc')
  merc.root.scale.setScalar(
    runnerMercVisualHeightMeters(
      course.laneCenters,
      course.presentation.cameraProfile,
    ) / 0.55,
  )
})
afterEach(() => {
  merc?.dispose()
  vi.restoreAllMocks()
})

function cameraFor(
  aspect: number,
  followX = 0,
  profile = course.presentation.cameraProfile,
) {
  const pose = runnerCameraPose(aspect, course.laneCenters, profile)
  const camera = new PerspectiveCamera(pose.fovDegrees, aspect, 0.08, 75)
  camera.position.set(pose.x + followX, pose.y, pose.z)
  camera.lookAt(pose.targetX + followX, pose.targetY, pose.targetZ)
  camera.updateMatrixWorld(true)
  return camera
}

describe.each([
  ...viewports,
  { width: 320, height: 740 },
  { width: 844, height: 310 },
])('closer steering camera at $width×$height', (viewport) => {
  const aspect = viewport.width / viewport.height
  it('gives the real Merc more presence with clear feet and no edge or jump clipping', () => {
    for (let frame = 0; frame < 100; frame++) poseMerc(0)
    const centre = projectedBody(cameraFor(aspect, 0, 'steering-close'))
    expect((centre.maxY - centre.minY) / 2).toBeGreaterThanOrEqual(0.2)
    expect((centre.maxY - centre.minY) / 2).toBeLessThanOrEqual(0.24)
    expect((1 - centre.minY) / 2).toBeGreaterThan(0.72)
    expect((1 - centre.minY) / 2).toBeLessThan(0.84)
    const edge = 3 - course.movement.bodyRadius
    let x = -edge
    let followX = runnerCameraFollowTarget(
      x,
      course.laneCenters,
      aspect,
      'steering-close',
      true,
    )
    for (let frame = 0; frame < 180; frame++) {
      const seconds = frame / 60
      // Includes both boundaries, a full-speed reversal and worst follow lag.
      x =
        frame < 90
          ? Math.min(edge, -edge + seconds * 5)
          : Math.max(-edge, edge - (seconds - 1.5) * 5)
      const jumpSeconds = seconds % 1.5
      const y = Math.max(
        0,
        course.movement.jumpVelocityMetersPerSecond * jumpSeconds -
          (course.movement.gravityMetersPerSecondSquared * jumpSeconds ** 2) /
            2,
      )
      followX = stepRunnerCameraFollow(
        followX,
        runnerCameraFollowTarget(
          x,
          course.laneCenters,
          aspect,
          'steering-close',
          true,
        ),
        1 / 60,
      )
      poseMerc(x, y)
      const body = projectedBody(cameraFor(aspect, followX, 'steering-close'))
      expect(body.minX).toBeGreaterThan(-0.96)
      expect(body.maxX).toBeLessThan(0.96)
      expect(body.minY).toBeGreaterThan(-0.96)
      expect(body.maxY).toBeLessThan(0.96)
    }
  })
})

function poseMerc(x: number, y = 0, dt = 1 / 60) {
  merc.update(
    {
      player: {
        position: { x, y, z: 0 },
        velocity: { x: 0, y: 0, z: -2.6 },
        grounded: y === 0,
        facingYaw: 0,
      },
      elapsedSeconds: 10,
      breakables: [],
    },
    dt,
    false,
  )
}

function projectedBody(camera: PerspectiveCamera) {
  merc.root.updateMatrixWorld(true)
  const vertex = new Vector3()
  const bounds = {
    minX: Infinity,
    maxX: -Infinity,
    minY: Infinity,
    maxY: -Infinity,
  }
  merc.root.traverse((object) => {
    const mesh = object as Mesh
    if (!mesh.isMesh) return
    if (mesh instanceof SkinnedMesh) mesh.skeleton.update()
    for (
      let index = 0;
      index < mesh.geometry.getAttribute('position').count;
      index++
    ) {
      mesh
        .getVertexPosition(index, vertex)
        .applyMatrix4(mesh.matrixWorld)
        .project(camera)
      bounds.minX = Math.min(bounds.minX, vertex.x)
      bounds.maxX = Math.max(bounds.maxX, vertex.x)
      bounds.minY = Math.min(bounds.minY, vertex.y)
      bounds.maxY = Math.max(bounds.maxY, vertex.y)
    }
  })
  return bounds
}

describe.each(viewports)('responsive camera at $width×$height', (viewport) => {
  const aspect = viewport.width / viewport.height
  it('makes the complete moving Merc 18–20% tall and keeps feet clear of bottom controls', () => {
    for (let frame = 0; frame < 100; frame++) poseMerc(0)
    const body = projectedBody(cameraFor(aspect))
    expect((body.maxY - body.minY) / 2).toBeGreaterThanOrEqual(0.18)
    expect((body.maxY - body.minY) / 2).toBeLessThanOrEqual(0.2)
    const feet = (1 - body.minY) / 2
    expect(feet).toBeGreaterThan(0.72)
    expect(feet).toBeLessThan(0.82)
    if (viewport.width === 390) {
      expect(feet).toBeGreaterThan(0.78)
      expect(feet).toBeLessThan(0.81)
    }
    expect(merc.root.rotation.y).toBeCloseTo(Math.PI, 8)
  })
  it('keeps every posed vertex visible during outer-lane travel and a simultaneous two-lane jump', () => {
    for (const [from, to, jump] of [
      [0, -2, false],
      [0, 2, false],
      [-2, 2, true],
      [2, -2, true],
    ] as const) {
      let followX = runnerCameraFollowTarget(
        from,
        course.laneCenters,
        aspect,
        course.presentation.cameraProfile,
      )
      for (let frame = 0; frame < 100; frame++) poseMerc(from)
      for (
        let frame = 1;
        frame <= Math.ceil((course.movement.laneChangeSeconds + 0.3) * 60);
        frame++
      ) {
        const seconds = frame / 60
        const x =
          from +
          (to - from) * Math.min(1, seconds / course.movement.laneChangeSeconds)
        const y = jump
          ? Math.max(
              0,
              course.movement.jumpVelocityMetersPerSecond * seconds -
                (course.movement.gravityMetersPerSecondSquared *
                  seconds *
                  seconds) /
                  2,
            )
          : 0
        followX = stepRunnerCameraFollow(
          followX,
          runnerCameraFollowTarget(
            x,
            course.laneCenters,
            aspect,
            course.presentation.cameraProfile,
          ),
          1 / 60,
        )
        poseMerc(x, y)
        const body = projectedBody(cameraFor(aspect, followX))
        expect(body.minX).toBeGreaterThan(-0.96)
        expect(body.maxX).toBeLessThan(0.96)
        expect(body.minY).toBeGreaterThan(-0.96)
        expect(body.maxY).toBeLessThan(0.96)
      }
    }
  })
  it('keeps all three lane centers visible at the actual change-lane cue after a reaction delay', () => {
    const camera = cameraFor(aspect)
    for (const blocker of course.obstacles) {
      if (blocker.kind !== 'blocker') continue
      const seconds = blocker.telegraphFromCourseSeconds + 0.25
      const distance =
        runnerSecondsToBeat(course.tempoSegments, seconds) *
        course.metersPerBeat
      for (const x of course.laneCenters) {
        const point = new Vector3(
          x,
          0.3,
          distance - blocker.minCourseDistanceMeters,
        ).project(camera)
        expect(Math.abs(point.x)).toBeLessThan(0.96)
        expect(Math.abs(point.y)).toBeLessThan(0.96)
      }
    }
  })
  it('shows the takeoff and landing lips in every lane during the useful jump cue', () => {
    for (const gap of course.obstacles) {
      if (gap.kind !== 'gap') continue
      const useful = runnerUsefulJumpWindow(course, gap)!
      const seconds = useful.launchOpenCourseSeconds + 0.25
      expect(seconds).toBeLessThan(useful.launchCloseCourseSeconds)
      const distance =
        runnerSecondsToBeat(course.tempoSegments, seconds) *
        course.metersPerBeat
      for (const playerX of course.laneCenters) {
        const followX = runnerCameraFollowTarget(
          playerX,
          course.laneCenters,
          aspect,
          course.presentation.cameraProfile,
        )
        const camera = cameraFor(aspect, followX)
        for (const edge of [
          gap.minCourseDistanceMeters,
          gap.maxCourseDistanceMeters,
        ]) {
          const point = new Vector3(playerX, 0, distance - edge).project(camera)
          expect(Math.abs(point.x)).toBeLessThan(0.96)
          expect(Math.abs(point.y)).toBeLessThan(0.96)
        }
      }
    }
  })
})

it('retains the legacy Merc size and camera pose when the legacy profile is explicit', () => {
  expect(runnerMercVisualHeightMeters([-2, 0, 2])).toBe(0.82)
  expect(runnerMercVisualHeightMeters([-1.25, 0, 1.25], 'legacy-wide')).toBe(
    0.82,
  )
  expect(runnerMercVisualHeightMeters([-2, 0, 2], 'responsive-close')).toBe(
    0.95,
  )
  expect(runnerMercVisualHeightMeters([-1.25, 0, 1.25])).toBe(0.95)
  const pose = runnerCameraPose(1440 / 900, [-2, 0, 2], 'legacy-wide')
  expect(pose).toEqual({
    fovDegrees: 60,
    x: 0,
    y: 2.4,
    z: 5.2,
    targetX: 0,
    targetY: 0.65,
    targetZ: -4.4,
  })
  expect(
    runnerCameraFollowTarget(2, [-2, 0, 2], 390 / 844, 'legacy-wide'),
  ).toBe(0)
})
