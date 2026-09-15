// Glass adventure contracts — content, simulation and host-neutral observations.

export interface Vec3 {
  x: number
  y: number
  z: number
}

export interface BoundsXZ {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

export interface PlatformDefinition extends BoundsXZ {
  id: string
  top: number
  thickness: number
  kind: 'deck' | 'bridge' | 'catch'
  material: 'stone' | 'brass'
  /** Optional renderer catalog recipe; has no effect on this solid proxy. */
  renderId?: string
  unlockAfter?: string
  catchCheckpointId?: string
}

interface SolidPropBase {
  id: string
  kind: 'prop'
  top: number
  thickness: number
  /** Props on an unopened floor are inactive with that floor. */
  platformId?: string
  /** Keep a visible stone proxy until optional detailed art installs. */
  fallback?: { replacedByBundle: string; replacedByNode: string }
}

/** Static content solids: independent of decorative meshes and progress floors. */
export type SolidPropDefinition =
  | (SolidPropBase & BoundsXZ & { shape: 'box' })
  | (SolidPropBase & {
      shape: 'cylinder'
      x: number
      z: number
      radiusTop: number
      radiusBottom: number
    })

export type CourseSolid = PlatformDefinition | SolidPropDefinition

export interface HoldDefinition {
  requiredSeconds: number
  toleranceCents: number
  confidenceFloor: number
  dropoutGraceSeconds: number
  decayPerSecond: number
  maximumSampleGapSeconds: number
  maximumSampleAgeMs: number
}

export interface BreakableDefinition {
  id: string
  label: string
  position: Vec3
  anchor: Vec3
  variant: string
  optional: boolean
  requiresCompleted?: readonly string[]
  hold: HoldDefinition
}

export interface CheckpointDefinition {
  id: string
  position: Vec3
  radius: number
  facingYaw: number
  requiresCompleted?: readonly string[]
}

export interface LevelDefinition {
  id: string
  title: string
  spawn: { position: Vec3; facingYaw: number }
  platforms: readonly PlatformDefinition[]
  solids?: readonly SolidPropDefinition[]
  checkpoints: readonly CheckpointDefinition[]
  breakables: readonly BreakableDefinition[]
  exit: BoundsXZ & { top: number; requiresCompleted: readonly string[] }
  fallBelow: number
}

export interface MovementInput {
  /** Camera-relative input is converted to these world-space axes by the host. */
  moveX: number
  moveZ: number
  jumpDown: boolean
}

export interface PlayerState {
  /** Feet position, independent of Merc's visible squash and hands. */
  position: Vec3
  velocity: Vec3
  grounded: boolean
  /** Zero faces world -Z, matching the follow camera convention. */
  facingYaw: number
}

export type EncounterPhase =
  | 'idle'
  | 'listening'
  | 'charging'
  | 'shattering'
  | 'complete'

export interface BreakableSnapshot {
  id: string
  charge: number
  phase: EncounterPhase
  /** Simulation presentation time; null for never broken or restored progress. */
  brokenAt: number | null
}

export interface GameSnapshot {
  player: PlayerState
  breakables: readonly BreakableSnapshot[]
  enabledPlatformIds: readonly string[]
  completedBreakableIds: readonly string[]
  activeEncounter: { id: string; charge: number; targetMidi: number } | null
  phase: EncounterPhase
  paused: boolean
  checkpointId: string
  nearbyBreakableId: string | null
  elapsedSeconds: number
  complete: boolean
}

export interface PitchObservation {
  sequence: number
  captureSeconds: number
  /** Capture time mapped to performance.now's origin, not worker receipt time. */
  capturedAtMs: number
  midi: number | null
  confidence: number
}

export interface SavedProgress {
  version: 1
  levelId: string
  checkpointId: string
  completedBreakableIds: string[]
  finished?: boolean
}

export type GameEvent =
  | { type: 'landed' }
  | { type: 'jumped' }
  | { type: 'checkpoint'; id: string }
  | { type: 'respawn'; checkpointId: string }
  | { type: 'break'; id: string }
  | { type: 'complete' }

export interface GlassGame {
  /** Advances bounded fixed physics steps; pitch has its own capture clock. */
  step(
    input: MovementInput,
    elapsedSeconds: number,
    nowMs?: number,
  ): GameEvent[]
  snapshot(): GameSnapshot
  beginEncounter(id: string, targetMidi: number): boolean
  feedPitch(frame: PitchObservation, nowMs: number): GameEvent[]
  cancelEncounter(): void
  setPaused(paused: boolean): void
  saveProgress(): SavedProgress
}
