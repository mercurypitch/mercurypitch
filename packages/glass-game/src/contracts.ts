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

export interface Bounds3 extends BoundsXZ {
  minY: number
  maxY: number
}

/** A solid is active only while both completion clauses hold. */
export interface SolidActivation {
  allCompleted?: readonly string[]
  noneCompleted?: readonly string[]
}

export type SolidProxyRole = 'floor' | 'bridge' | 'wall' | 'gate' | 'plinth'
export type SolidMaterialRole = 'stone' | 'brass' | 'glass'

/** Host-neutral visible fallback for collision that must not become invisible. */
export interface SolidPresentation {
  role: SolidProxyRole
  material: SolidMaterialRole
  assetRecipeId?: string
}

export interface PlatformDefinition extends BoundsXZ {
  id: string
  top: number
  thickness: number
  kind: 'deck' | 'bridge' | 'catch'
  material: 'stone' | 'brass'
  /** Optional renderer catalog recipe; has no effect on this solid proxy. */
  renderId?: string
  activation?: SolidActivation
  presentation?: SolidPresentation
  /** Legacy single-encounter bridge activation retained for Glassworks saves. */
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
  activation?: SolidActivation
  presentation?: SolidPresentation
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
  mount?: ExhibitMountDefinition
  variant: string
  optional: boolean
  requiresCompleted?: readonly string[]
  hold: HoldDefinition
}

export interface ExhibitMountDefinition {
  kind: 'plinth'
  solidId: string
  height: number
  radiusTop: number
  radiusBottom: number
  facingYaw: number
  presentation: SolidPresentation
}

export interface CheckpointDefinition {
  id: string
  position: Vec3
  radius: number
  facingYaw: number
  requiresCompleted?: readonly string[]
}

export type MuseumAudioSceneId = 'museum' | 'garden' | 'gallery'

export interface AuthoredLevelIdentity {
  levelId: string
  layoutId: string
  contentRevision: number
}

export interface RoomPresentationDefinition {
  id: string
  bounds: Bounds3
  cameraBounds?: Bounds3
  ports?: readonly CompiledRoomPortDefinition[]
}

export interface CompiledRoomPortDefinition {
  id: string
  position: Vec3
  facingYaw: number
  width: number
  height: number
}

export interface AudioRegionDefinition {
  id: string
  bounds: Bounds3
  sceneId: MuseumAudioSceneId
}

export const FLOOR_ART_RECIPE_IDS = [
  'quiet-marble',
  'orbital-rings',
  'angular-parquet',
  'sound-wave',
  'hero-petal',
] as const

export type FloorArtRecipeId = (typeof FLOOR_ART_RECIPE_IDS)[number]

export const FLOOR_ART_PALETTE_IDS = [
  'neutral',
  'garden',
  'archive',
  'portrait',
] as const

export type FloorArtPaletteId = (typeof FLOOR_ART_PALETTE_IDS)[number]

/** Decorative surface art tied to one physical platform, never its collision. */
export interface PlatformFloorArtDefinition {
  platformId: string
  recipeId: FloorArtRecipeId
  palette?: FloorArtPaletteId
}

export interface VisualInstanceDefinition {
  id: string
  recipeId: string
  position: Vec3
  yaw: number
  /** Collision proxies hidden only after this exact visual installs. */
  coveredSolidIds?: readonly string[]
}

/** One room-owned prop assembled from a required catalogued asset. */
export interface RoomDecorationInstanceDefinition {
  id: string
  roomId: string
  recipeId: string
  position: Vec3
  yaw: number
  scale: number
  /** Collision proxies hidden only after this exact decoration installs. */
  coveredSolidIds?: readonly string[]
}

export interface EncounterSuccessNotice {
  encounterId: string
  notice: string
}

export interface LevelTutorialPage {
  title: string
  body: string
  aside: string
}

/** Two skippable teaching pages: manual movement, then a stationary voice task. */
export interface LevelTutorialDefinition {
  pages: readonly [LevelTutorialPage, LevelTutorialPage]
}

export interface LevelGuidanceDefinition {
  tutorial?: LevelTutorialDefinition
  subtitle?: string
  openingNotice?: string
  encounterSuccessNotices?: readonly EncounterSuccessNotice[]
  completionTitle?: string
  completionNext?: string
}

export interface LevelPresentationDefinition {
  worldBounds: Bounds3
  lightBounds: Bounds3
  rooms: readonly RoomPresentationDefinition[]
  audioRegions: readonly AudioRegionDefinition[]
  visuals: readonly VisualInstanceDefinition[]
  decorations?: readonly RoomDecorationInstanceDefinition[]
  floorArt?: readonly PlatformFloorArtDefinition[]
  assetRecipeIds: readonly string[]
}

export interface LevelMovementDefinition {
  walkSpeed: number
  runSpeed: number
  runDelaySeconds: number
  runRampSeconds: number
}

export const LEVEL_MOVEMENT_LIMITS = {
  maximumSpeed: 6,
  maximumRunDelaySeconds: 5,
  maximumRunRampSeconds: 5,
} as const

export interface LevelDefinition {
  id: string
  title: string
  authored?: AuthoredLevelIdentity
  guidance?: LevelGuidanceDefinition
  presentation?: LevelPresentationDefinition
  movement?: LevelMovementDefinition
  spawn: { position: Vec3; facingYaw: number; checkpointId?: string }
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
  /** All active collision IDs, including floors and props. */
  activeSolidIds?: readonly string[]
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
