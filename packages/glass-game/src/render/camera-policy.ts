// Adventure camera policy — public tuning contracts and deterministic framing helpers.

import { Box3, MathUtils, Matrix4, Vector3 } from 'three'
import type { GameSnapshot, LevelDefinition, RouteCameraSectionDefinition, Vec3, } from '../contracts'
import { getBreakableRenderRecipe } from './catalog'
import type { ChallengeCameraScreenFrame, ChallengeCameraSubjects, } from './challenge-camera'

export const ORBIT_FOLLOW_GRACE_SECONDS = 1.15
export const EXPLORATION_FOV_DEGREES = 48
export const MAXIMUM_FOLLOW_RADIANS_PER_SECOND = (80 * Math.PI) / 180
export const FOLLOW_COMPLETE_RADIANS = 0.01
export const MOVING_SPEED = 0.05
export const MAXIMUM_OBSTRUCTION_PITCH = 1.35
export const OBSTRUCTION_LIFT_PITCHES = [
  0.72,
  0.9,
  1.08,
  1.22,
  MAXIMUM_OBSTRUCTION_PITCH,
] as const
export const OBSTRUCTION_LIFT_RESPONSE = 9
export const OBSTRUCTION_RELEASE_DISTANCE = 1.35
export const OBSTRUCTION_TRIGGER_DISTANCE = 0.9
export const ENCLOSURE_OBSTRUCTION_RELEASE_DISTANCE = 1.6
export const ENCLOSURE_OBSTRUCTION_TRIGGER_DISTANCE = 1.15
export const ENCLOSURE_READABLE_BOOM_DISTANCE = 1.55
export const ENCLOSURE_LATERAL_BOOM_MAX_YAW = Math.PI / 4
export const ENCLOSURE_LATERAL_BOOM_RETRY_ANGLE = Math.PI / 16
export const ENCLOSURE_LATERAL_BOOM_RETRY_DISTANCE = 0.25
export const ENCLOSURE_LATERAL_BOOM_RETRY_SECONDS = 0.25
export const ENCLOSURE_LATERAL_BOOM_SEARCH_STEPS = 4
export const ENCLOSURE_EYE_LEVEL_PITCH = 0.24
export const ENCLOSURE_PITCH_BLEND_DISTANCE = 0.35
export const ENCLOSURE_DISTANCE_RECOVERY_RESPONSE = 7

export const CAMERA_FOLLOW_SMOOTHNESS = {
  minimum: 0.08,
  maximum: 0.45,
  default: 0.32,
} as const

export type AdventureCameraMode = 'third-person' | 'first-person'

export interface AdventureCameraOptions {
  /** Avoid unsolicited view rotation for vestibular-sensitive players. */
  reducedMotion?: boolean
  /** Seconds for automatic follow to accelerate from rest to its turn cap. */
  followSmoothnessSeconds?: number
  /** Player-selected exploration perspective. */
  mode?: AdventureCameraMode
}

export interface ChallengeCameraMetrics {
  mode: 'exploration' | 'entering' | 'holding' | 'restoring'
  encounterId: string | null
  progress: number
  /** True only when a held live-panel reframe has reached its planned pose. */
  settled: boolean
  safeBottomFraction: number
  position: { x: number; y: number; z: number }
  target: { x: number; y: number; z: number }
  mercFrame: ChallengeCameraScreenFrame | null
  targetFrame: ChallengeCameraScreenFrame | null
  combinedFrame: ChallengeCameraScreenFrame | null
  safeBottomNdc: number | null
  side: -1 | 1 | null
  clearance: number | null
  occluded: boolean | null
}

export function frameUnion(
  first: ChallengeCameraScreenFrame,
  second: ChallengeCameraScreenFrame,
): ChallengeCameraScreenFrame {
  return {
    minX: Math.min(first.minX, second.minX),
    maxX: Math.max(first.maxX, second.maxX),
    minY: Math.min(first.minY, second.minY),
    maxY: Math.max(first.maxY, second.maxY),
  }
}

export function validFollowSmoothness(value: number | undefined): number {
  if (!Number.isFinite(value)) return CAMERA_FOLLOW_SMOOTHNESS.default
  return MathUtils.clamp(
    value!,
    CAMERA_FOLLOW_SMOOTHNESS.minimum,
    CAMERA_FOLLOW_SMOOTHNESS.maximum,
  )
}

export function enclosureCompositionPitch(
  selectedPitch: number,
  contextualReach: number,
): number {
  const eyeLevelPitch = Math.min(selectedPitch, ENCLOSURE_EYE_LEVEL_PITCH)
  const compression =
    1 -
    MathUtils.smoothstep(
      contextualReach,
      ENCLOSURE_READABLE_BOOM_DISTANCE - ENCLOSURE_PITCH_BLEND_DISTANCE,
      ENCLOSURE_READABLE_BOOM_DISTANCE,
    )
  return MathUtils.lerp(selectedPitch, eyeLevelPitch, compression)
}

export function validRouteYaw(
  section: RouteCameraSectionDefinition | null,
): number | null {
  return section !== null && Number.isFinite(section.yaw) ? section.yaw : null
}

export function addFiniteOffset(
  target: Vector3,
  offset: Vec3 | undefined,
): void {
  if (offset === undefined) return
  if (Number.isFinite(offset.x)) target.x += offset.x
  if (Number.isFinite(offset.y)) target.y += offset.y
  if (Number.isFinite(offset.z)) target.z += offset.z
}

/** Positive forward means away from the eye along the ground plane. */
export function cameraRelativeMovement(
  x: number,
  forward: number,
  yaw: number,
) {
  const length = Math.max(1, Math.hypot(x, forward))
  return {
    moveX: (x * Math.cos(yaw) - forward * Math.sin(yaw)) / length,
    moveZ: (-x * Math.sin(yaw) - forward * Math.cos(yaw)) / length,
  }
}

export function selectFocusedChallengeId(
  requestedChallengeId: string | null,
  snapshot: GameSnapshot,
): string | null {
  if (requestedChallengeId !== null) return requestedChallengeId
  if (snapshot.activeEncounter !== null) return snapshot.activeEncounter.id
  return (
    snapshot.breakables.find((item) => item.phase === 'shattering')?.id ?? null
  )
}

export function createFallbackChallengeSubjects(
  level: LevelDefinition,
  encounterId: string,
  snapshot: GameSnapshot,
): ChallengeCameraSubjects {
  const playerPosition = new Vector3().copy(snapshot.player.position)
  const exhibit = level.breakables.find((item) => item.id === encounterId)
  const exhibitBase = new Vector3().copy(
    exhibit?.position ?? snapshot.player.position,
  )
  const barrier = exhibit?.presentation?.kind === 'barrier'
  exhibitBase.y += barrier ? 0 : (exhibit?.mount?.height ?? 0.255)
  const envelope =
    barrier && exhibit !== undefined
      ? getBreakableRenderRecipe(exhibit.variant).barrierEnvelope
      : undefined
  const target =
    envelope === undefined
      ? new Box3(
          exhibitBase.clone().add(new Vector3(-0.42, 0, -0.42)),
          exhibitBase.clone().add(new Vector3(0.42, 1.15, 0.42)),
        )
      : new Box3(
          new Vector3(-envelope.width / 2, 0, -envelope.depth / 2),
          new Vector3(envelope.width / 2, envelope.height, envelope.depth / 2),
        ).applyMatrix4(
          new Matrix4()
            .makeRotationY(exhibit!.presentation!.facingYaw)
            .setPosition(exhibitBase),
        )
  return {
    encounterId,
    merc: new Box3(
      playerPosition.clone().add(new Vector3(-0.34, 0, -0.26)),
      playerPosition.clone().add(new Vector3(0.34, 1.35, 0.26)),
    ),
    target,
  }
}
