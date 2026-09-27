// Frost wall camera regressions — the real courts keep the full pane readable and lock manual input while singing.

import { Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { CLOUDWAY_CRYSTAL_PROMENADE_MECHANICS_PREVIEW, CLOUDWAY_CRYSTAL_PROMENADE_STUDY, } from '../content/cloudway-laboratory'
import { FROST_WALL_PANE } from '../content/frost-wall-profile'
import type { GameSnapshot, LevelDefinition } from '../contracts'
import { createGlassGame } from '../core/game'
import { createAdventureCamera } from './camera'
import type { AdventureCameraMode } from './camera-policy'
import { createFallbackChallengeSubjects } from './camera-policy'

const FRAME = 1 / 60
const SAFE_BOTTOM_FRACTION = 0.42

const VIEWPORTS = [
  { viewport: 'phone-390x844', aspect: 390 / 844 },
  { viewport: 'tablet-800x1100', aspect: 800 / 1100 },
] as const

const COURSES = [
  {
    level: CLOUDWAY_CRYSTAL_PROMENADE_STUDY,
    supportId: 'wall-approach-entry',
    wallId: 'voice-fifth',
  },
  {
    level: CLOUDWAY_CRYSTAL_PROMENADE_MECHANICS_PREVIEW,
    supportId: 'preview-wall-approach-entry',
    wallId: 'preview-voice-fifth',
  },
] as const

const COURSE_VIEWPORTS = COURSES.flatMap((course) =>
  VIEWPORTS.map((viewport) => ({ ...course, ...viewport })),
)

const COURSE_VIEWPORT_MODES = COURSE_VIEWPORTS.flatMap((course) =>
  (['first-person', 'third-person'] as const).map((mode) => ({
    ...course,
    mode,
  })),
)

function wallPose(
  level: LevelDefinition,
  wallId: string,
  supportId: string,
): GameSnapshot {
  const wall = level.breakables.find((candidate) => candidate.id === wallId)!
  const snapshot = createGlassGame(level).snapshot()
  return {
    ...snapshot,
    player: {
      ...snapshot.player,
      position: { ...wall.anchor },
      velocity: { x: 0, y: 0, z: 0 },
      grounded: true,
      supportPlatformId: supportId,
      facingYaw: wall.presentation!.facingYaw,
    },
  }
}

function settledWallCamera(
  level: LevelDefinition,
  wallId: string,
  supportId: string,
  mode: AdventureCameraMode,
  aspect: number,
) {
  const wall = level.breakables.find((candidate) => candidate.id === wallId)!
  const snapshot = wallPose(level, wallId, supportId)
  const subjects = createFallbackChallengeSubjects(level, wallId, snapshot)
  subjects.targetFacing = new Vector3(
    Math.sin(wall.presentation!.facingYaw),
    0,
    Math.cos(wall.presentation!.facingYaw),
  )
  const camera = createAdventureCamera(level, { mode })
  camera.camera.aspect = aspect
  camera.camera.updateProjectionMatrix()
  camera.update(snapshot, FRAME)
  camera.setChallengeSafeBottomFraction(SAFE_BOTTOM_FRACTION)
  camera.setChallengeEncounter(wallId)
  camera.setChallengeSubjects(subjects)
  for (let frame = 0; frame < 180; frame++) camera.update(snapshot, FRAME)
  camera.camera.updateMatrixWorld(true)
  return { camera, snapshot, subjects, wall }
}

describe('Frost Promenade wall camera', () => {
  it.each(COURSE_VIEWPORTS)(
    'fits the complete $wallId pane above the first-person voice panel at $viewport',
    ({ aspect, level, supportId, wallId }) => {
      const { camera, wall } = settledWallCamera(
        level,
        wallId,
        supportId,
        'first-person',
        aspect,
      )
      const metrics = camera.getChallengeMetrics()

      expect(wall.position.z - wall.anchor.z).toBeCloseTo(3.24, 10)
      expect(metrics).toMatchObject({
        mode: 'holding',
        encounterId: wallId,
        occluded: false,
        settled: true,
      })
      expect(metrics.targetFrame!.minX).toBeGreaterThan(-0.9)
      expect(metrics.targetFrame!.maxX).toBeLessThan(0.9)
      expect(metrics.targetFrame!.minY).toBeGreaterThan(metrics.safeBottomNdc!)
      expect(metrics.targetFrame!.maxY).toBeLessThan(0.87)
      expect(camera.camera.fov).toBeLessThan(96)
    },
  )

  it.each(COURSE_VIEWPORTS)(
    'keeps the $wallId third-person shot clear and fully framed at $viewport',
    ({ aspect, level, supportId, wallId }) => {
      const { camera } = settledWallCamera(
        level,
        wallId,
        supportId,
        'third-person',
        aspect,
      )
      const metrics = camera.getChallengeMetrics()

      expect(metrics).toMatchObject({
        mode: 'holding',
        encounterId: wallId,
        occluded: false,
        settled: true,
      })
      expect(metrics.combinedFrame!.minX).toBeGreaterThan(-0.95)
      expect(metrics.combinedFrame!.maxX).toBeLessThan(0.95)
      expect(metrics.combinedFrame!.minY).toBeGreaterThanOrEqual(
        metrics.safeBottomNdc! - 0.001,
      )
      expect(metrics.combinedFrame!.maxY).toBeLessThan(0.9)
    },
  )

  it.each(COURSE_VIEWPORT_MODES)(
    'ignores manual $mode camera input during $wallId singing at $viewport',
    ({ aspect, level, mode, supportId, wallId }) => {
      const { camera, snapshot } = settledWallCamera(
        level,
        wallId,
        supportId,
        mode,
        aspect,
      )
      const position = camera.camera.position.clone()
      const orientation = camera.camera.quaternion.clone()
      const fov = camera.camera.fov
      const yaw = camera.yaw()

      camera.setOrbitActive(true)
      camera.orbit(1.2, 0.6)
      camera.zoom(4)
      camera.recenter()
      camera.setOrbitActive(false)
      camera.update(snapshot, FRAME)

      expect(camera.camera.position.distanceTo(position)).toBeLessThan(1e-10)
      expect(camera.camera.quaternion.angleTo(orientation)).toBeLessThan(1e-7)
      expect(camera.camera.fov).toBeCloseTo(fov, 10)
      expect(camera.yaw()).toBeCloseTo(yaw, 10)
      const size = createFallbackChallengeSubjects(
        level,
        wallId,
        snapshot,
      ).target.getSize(new Vector3())
      expect(size.x).toBeCloseTo(FROST_WALL_PANE.width, 10)
      expect(size.y).toBeCloseTo(FROST_WALL_PANE.height, 10)
      expect(size.z).toBeCloseTo(FROST_WALL_PANE.depth, 10)
    },
  )
})
