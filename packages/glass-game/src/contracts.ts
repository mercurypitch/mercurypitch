// Glass adventure contracts — content, simulation and host-neutral observations.

import type { MelodyAttemptConfiguration, MelodyAttemptConfigurationResult, MelodyAttemptIdentity, MelodyJudgeSnapshot, MelodyLessonDefinition, } from './melody-contracts'
import type { PitchWaveDefinition } from './pitch-wave'

export type * from './melody-contracts'

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

/** One horizontal contact point in world space. */
export interface PointXZ {
  x: number
  z: number
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

/** Grounded-only surface tuning; ordinary air control resumes after take-off. */
export interface FrostSurfaceDefinition {
  kind: 'frost'
  controlMultiplier: number
  brakingMultiplier: number
  maximumSpeed: number
}

export type PlatformSurfaceDefinition = FrostSurfaceDefinition

export type PlatformScrollAxis = 'x' | 'z'

/**
 * A visible roller band attached to one end of a retractable scroll.
 * Horizontal values are world-space offsets from the scroll centre after the
 * platform's cardinal render turn. The contact plane may sit above the deck to
 * match the visible crown of the roller barrel.
 */
export interface PlatformScrollEdgeSupportDefinition {
  /** Distance from the live glass edge to the roller's outer visible edge. */
  outwardLength: number
  /** Ordered offsets on the axis perpendicular to scroll extension. */
  minCrossAxis: number
  maxCrossAxis: number
  /** Contact plane relative to the scroll deck top. */
  topOffset: number
  /** Depth of the continuous solid contact band below the landing plane. */
  thickness: number
}

export const PLATFORM_RENDER_QUARTER_TURNS = [0, 1, 2, 3] as const
export type PlatformRenderQuarterTurns =
  (typeof PLATFORM_RENDER_QUARTER_TURNS)[number]

/** Deterministic runtime behaviors; axes are world-space after compilation. */
export type PlatformBehaviorDefinition =
  | {
      kind: 'glide'
      translation: Vec3
      travelSeconds: number
      dwellSeconds: number
    }
  | {
      kind: 'crackle'
      warningSeconds: number
      releaseSeconds: number
      resetSeconds: number
    }
  | {
      kind: 'scroll'
      /** World axis after any authoring-space quarter turn is applied. */
      axis: PlatformScrollAxis
      /** Optional visible roller support which follows each live deck edge. */
      edgeSupports?: {
        readonly negative: PlatformScrollEdgeSupportDefinition
        readonly positive: PlatformScrollEdgeSupportDefinition
      }
      minLengthRatio: number
      extendedSeconds: number
      retractedSeconds: number
      transitionSeconds: number
      initialState: 'extended' | 'retracted'
    }

export const PLATFORM_BEHAVIOR_LIMITS = {
  maximumTranslation: 20,
  maximumTravelSeconds: 30,
  maximumDwellSeconds: 10,
  maximumPhaseSeconds: 30,
  minimumSurfaceMultiplier: 0.05,
  minimumScrollLengthRatio: 0.1,
  maximumScrollLengthRatio: 0.95,
  minimumScrollRestSeconds: 0.25,
  maximumScrollRestSeconds: 60,
  minimumScrollTransitionSeconds: 0.25,
  maximumScrollTransitionSeconds: 30,
} as const

/** A deliberately authored void that fixed-step floor contact must not bridge. */
export interface IntentionalGapDefinition extends BoundsXZ {
  id: string
  top: number
}

export interface PlatformDefinition extends BoundsXZ {
  id: string
  top: number
  thickness: number
  kind: 'deck' | 'bridge' | 'catch'
  material: 'stone' | 'brass'
  /**
   * Certified convex support outline. Bounds remain its broad-phase envelope;
   * landing and side contact use this exact polygon.
   */
  supportPolygon?: readonly PointXZ[]
  /** Runtime compound parts retain one public platform identity. */
  parentPlatformId?: string
  /** Optional renderer catalog recipe; has no effect on this solid proxy. */
  renderId?: string
  /**
   * Cardinal art orientation around +Y. Prefabs store local turns; room
   * compilation adds the placement turn so runtime values are world-space.
   * Collision remains defined exclusively by the axis-aligned bounds.
   */
  renderQuarterTurns?: PlatformRenderQuarterTurns
  activation?: SolidActivation
  presentation?: SolidPresentation
  /** Legacy single-encounter bridge activation retained for Glassworks saves. */
  unlockAfter?: string
  catchCheckpointId?: string
  surface?: PlatformSurfaceDefinition
  behavior?: PlatformBehaviorDefinition
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

export type PitchTargetId = 'comfortable' | 'low' | 'high'

/** Calibrated pitches supplied by the session layer, independent of level data. */
export type PitchTargets = Readonly<Partial<Record<PitchTargetId, number>>>

export interface PitchStepDefinition {
  target: PitchTargetId
  hold: HoldDefinition
}

export type PitchChallengeDefinition =
  | { kind: 'hold'; step: PitchStepDefinition }
  | {
      kind: 'settle-wave'
      step: PitchStepDefinition
      wave: PitchWaveDefinition
    }
  | {
      kind: 'ordered-pair'
      steps: readonly [PitchStepDefinition, PitchStepDefinition]
      wrongOrder: 'reset'
    }

export interface MelodyAnchorChallengeDefinition {
  kind: 'melody-anchor'
  lessonId: string
  anchorId: string
  reference: 'anchor-tone'
  step: { hold: HoldDefinition }
}

export interface MelodyContourChallengeDefinition {
  kind: 'melody-contour'
  lessonId: string
  reference: 'whole-melody'
}

export type MelodyChallengeDefinition =
  | MelodyAnchorChallengeDefinition
  | MelodyContourChallengeDefinition

export type ChallengeDefinition =
  | PitchChallengeDefinition
  | MelodyChallengeDefinition

export interface BreakableDefinition {
  id: string
  label: string
  position: Vec3
  anchor: Vec3
  mount?: ExhibitMountDefinition
  /** Floor-mounted pane; its certified recipe supplies the contact envelope. */
  presentation?: { kind: 'barrier'; facingYaw: number }
  variant: string
  optional: boolean
  requiresCompleted?: readonly string[]
  challenge: ChallengeDefinition
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
  /** Existing breakables whose runtime IDs do not carry the compiled room prefix. */
  breakableIds?: readonly string[]
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

/** One low diegetic route cue, ordered with the lesson's melodic stations. */
export interface MelodyStationMarkerDefinition {
  id: string
  roomId: string
  encounterId: string
  anchorId: string
  position: Vec3
  yaw: number
  pitchOffsetSemitones: number
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
  id?: string
  version?: number
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
  theme?: 'museum' | 'cloudway'
  worldBounds: Bounds3
  lightBounds: Bounds3
  rooms: readonly RoomPresentationDefinition[]
  audioRegions: readonly AudioRegionDefinition[]
  visuals: readonly VisualInstanceDefinition[]
  decorations?: readonly RoomDecorationInstanceDefinition[]
  melodyMarkers?: readonly MelodyStationMarkerDefinition[]
  floorArt?: readonly PlatformFloorArtDefinition[]
  crystalInteriors?: readonly CrystalInteriorPresentationDefinition[]
  livingCrystalInteriors?: readonly LivingCrystalInteriorPresentationDefinition[]
  livingCrystalSupports?: readonly LivingCrystalSupportPresentationDefinition[]
  resonanceExhibits?: readonly ResonanceExhibitPresentationDefinition[]
  assetRecipeIds: readonly string[]
}

/** Optional contained light sculptures; certified donor geometry owns the envelope. */
export interface CrystalInteriorPresentationDefinition {
  platformId: string
  preset: 'resonance-veins' | 'frost-roots' | 'aurora-heart'
  seed: number
  intensity?: number
  speed?: number
  palette?: { primary: number; secondary: number; accent: number }
}

/** Shared tuning for one thick crystal donor and its contained sculpture. */
export interface LivingCrystalInteriorTuningDefinition {
  variant: 'pearl-roots' | 'living-amber'
  /** Optional authored replacement for the donor's embedded root sculpture. */
  effect?: 'pearl-current'
  /** Exhibit whose authoritative singing state drives the replacement response. */
  responseExhibitId?: string
  seed: number
  quality?: 'balanced' | 'high'
  fullness?: number
  intensity?: number
  speed?: number
  palette?: { primary: number; secondary: number; accent: number }
}

/** A thick crystal donor replacing one exact certified platform contact. */
export interface LivingCrystalInteriorPresentationDefinition extends LivingCrystalInteriorTuningDefinition {
  platformId: string
}

/** One crystal donor spanning a validated rectangular union of static decks. */
export interface LivingCrystalSupportPresentationDefinition extends LivingCrystalInteriorTuningDefinition {
  id: string
  roomId: string
  coveredPlatformIds: readonly string[]
}

/** Per-encounter Resonance treatment; room ownership remains on the room. */
export interface ResonanceExhibitPresentationDefinition {
  encounterId: string
  seed?: number
  quality?: 'balanced' | 'high'
  intensity?: number
  cohesion?: number
  palette?: {
    crack?: number
    crackGlow?: number
    heart?: number
    heartGlow?: number
    spray?: number
    droplets?: readonly [number, number, number]
    dust?: number
  }
}

/** A finite authored exploration reward attached to one optional exhibit. */
export interface DiscoveryRewardDefinition {
  encounterId: string
  /** Stable, one-time museum discovery tokens; they are never spendable currency. */
  coinIds: readonly string[]
}

export type SingingQualityGrade = 1 | 2 | 3 | 'not-graded'

/**
 * Time-weighted pitch grading for challenges whose active target is explicit.
 * Route success remains owned by the challenge judge and never depends on this policy.
 */
export interface PitchAccuracyGradingPolicy {
  kind: 'pitch-accuracy-v1'
  encounterId: string
  policyRevision: number
  challengeRevision: number
  minimumReliableSeconds: number
  threeStarMaxMeanCents: number
  twoStarMaxMeanCents: number
  /** Large errors still count, but one detector outlier cannot dominate forever. */
  maximumErrorCents: number
}

export interface PortraitCollectibleDefinition {
  portraitId: string
  legendId: string
  title: string
  collectionIndex: number
  imageAssetId: string
  awardAfterEncounterId: string
  representationStatus: 'review' | 'approved'
}

/** Optional, level-owned reward policy compiled from stable authored encounter IDs. */
export interface LevelRewardDefinition {
  revision: number
  discoveries: readonly DiscoveryRewardDefinition[]
  grading: readonly PitchAccuracyGradingPolicy[]
  portrait?: PortraitCollectibleDefinition
}

export interface LevelMovementDefinition {
  walkSpeed: number
  runSpeed: number
  runDelaySeconds: number
  runRampSeconds: number
}

/** Input source that chose the stable camera-relative basis for one contact. */
export type MovementReferenceKind = 'keyboard' | 'stick'

/** One stable exploration composition shared by a set of route platforms. */
export interface RouteCameraSectionDefinition {
  id: string
  platformIds: readonly string[]
  yaw: number
  /** World-space look-ahead from Merc's stable body pivot. */
  targetOffset?: Vec3
}

/** Optional platform-route camera; levels without it retain gallery follow. */
export interface RouteSectionCameraDefinition {
  kind: 'route-sections'
  initialSectionId: string
  /** Grounded time on a new section before its composition becomes active. */
  landingDwellSeconds?: number
  sections: readonly RouteCameraSectionDefinition[]
}

export type LevelCameraDefinition = RouteSectionCameraDefinition

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
  rewards?: LevelRewardDefinition
  movement?: LevelMovementDefinition
  camera?: LevelCameraDefinition
  melodyLesson?: MelodyLessonDefinition
  intentionalGaps?: readonly IntentionalGapDefinition[]
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
  /** Present on live snapshots; optional so older presentation fixtures stay readable. */
  supportPlatformId?: string | null
  /** Zero faces world -Z, matching the follow camera convention. */
  facingYaw: number
}

export type PlatformPhase =
  | 'stable'
  | 'moving'
  | 'extended'
  | 'retracting'
  | 'retracted'
  | 'extending'
  | 'intact'
  | 'warning'
  | 'released'
  | 'resetting'

/** Authoritative simulation transform and lifecycle consumed by presentation. */
export interface PlatformRuntimeSnapshot {
  id: string
  offset: Vec3
  phase: PlatformPhase
  phaseProgress: number
  collisionEnabled: boolean
  /** Current centered walkable length divided by its authored full length. */
  lengthRatio?: number
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
  /** Always emitted by the live game; optional for backwards-compatible fixtures. */
  platformStates?: readonly PlatformRuntimeSnapshot[]
  breakables: readonly BreakableSnapshot[]
  /** All active collision IDs, including floors and props. */
  activeSolidIds?: readonly string[]
  enabledPlatformIds: readonly string[]
  completedBreakableIds: readonly string[]
  activeEncounter: (ChallengeProgress & { id: string }) | null
  /** Always live; optional so older presentation fixtures remain readable. */
  melodyAttempt?: MelodyAttemptIdentity | null
  phase: EncounterPhase
  paused: boolean
  checkpointId: string
  nearbyBreakableId: string | null
  /** Current required encounter whose own prerequisites are complete. */
  nextRequiredBreakableId?: string | null
  /** Nearby encounter that cannot start until its prerequisites are complete. */
  nearbyLockedBreakableId?: string | null
  /** The player is approaching an exit whose required encounters remain. */
  nearLockedExit?: boolean
  elapsedSeconds: number
  complete: boolean
  rewardSummary?: LevelRewardSummary
}

export interface PitchObservation {
  sequence: number
  captureSeconds: number
  /** Capture time mapped to performance.now's origin, not worker receipt time. */
  capturedAtMs: number
  midi: number | null
  confidence: number
}

export interface SingingQualityResult {
  encounterId: string
  grade: SingingQualityGrade
  challengeRevision: number
  policyRevision: number
  contentRevision: number
  evidenceVersion: 'pitch-accuracy-v1'
  reliableSeconds: number
  meanAbsoluteCents?: number
}

export interface SavedRewardProgress {
  version: 1
  discoveredEncounterIds: string[]
  collectedCoinIds: string[]
  qualityResults: SingingQualityResult[]
  collectedPortraitIds: string[]
}

export interface LevelRewardSummary {
  levelId: string
  discoveriesFound: number
  discoveriesTotal: number
  coinsFound: number
  coinsTotal: number
  qualityResults: readonly SingingQualityResult[]
  portrait?: PortraitCollectibleDefinition & { collected: boolean }
}

export interface SavedProgress {
  /** Versions 1 and 2 remain readable; melody attempts write version 3. */
  version: 1 | 2 | 3
  levelId: string
  checkpointId: string
  completedBreakableIds: string[]
  finished?: boolean
  rewards?: SavedRewardProgress
  melodyAttempt?: MelodyAttemptIdentity
}

interface ChallengeProgressBase {
  kind: ChallengeDefinition['kind']
  stepIndex: number
  stepCount: number
  stepCharge: number
  charge: number
  targetMidi: number
}

export interface PitchChallengeProgress extends ChallengeProgressBase {
  kind: PitchChallengeDefinition['kind']
  /** Optional only so pre-melody progress fixtures remain source-compatible. */
  targetKind?: 'pitch'
  target: PitchTargetId
}

export interface MelodyAnchorChallengeProgress extends ChallengeProgressBase {
  kind: 'melody-anchor'
  targetKind: 'melody-anchor'
  target: string
}

export interface MelodyContourChallengeProgress extends ChallengeProgressBase {
  kind: 'melody-contour'
  targetKind: 'melody-contour'
  target: string
  melodyJudge: MelodyJudgeSnapshot
}

export type MelodyChallengeProgress =
  | MelodyAnchorChallengeProgress
  | MelodyContourChallengeProgress

export type ChallengeProgress = PitchChallengeProgress | MelodyChallengeProgress

export type BreakOutcome = 'celebration' | 'path-opened' | 'exit-opened'

export type GameEvent =
  | { type: 'landed' }
  | { type: 'jumped' }
  | { type: 'checkpoint'; id: string }
  | { type: 'respawn'; checkpointId: string }
  | {
      type: 'challenge-step'
      id: string
      completedSteps: number
      stepCount: number
    }
  | { type: 'challenge-reset'; id: string; reason: 'wrong-order' }
  | { type: 'break'; id: string; outcome: BreakOutcome }
  | { type: 'complete' }

export interface GlassGame {
  /** Advances bounded fixed physics steps; pitch has its own capture clock. */
  step(
    input: MovementInput,
    elapsedSeconds: number,
    nowMs?: number,
  ): GameEvent[]
  snapshot(): GameSnapshot
  configureMelodyAttempt(
    configuration: MelodyAttemptConfiguration,
  ): MelodyAttemptConfigurationResult
  /** Melody encounters use the configured attempt; pitch encounters keep calibrated targets. */
  beginEncounter(id: string): boolean
  /** A number is the backwards-compatible shorthand for `{ comfortable: n }`. */
  beginEncounter(id: string, targets: number | PitchTargets): boolean
  feedPitch(frame: PitchObservation, nowMs: number): GameEvent[]
  cancelEncounter(): void
  setPaused(paused: boolean): void
  saveProgress(): SavedProgress
}
