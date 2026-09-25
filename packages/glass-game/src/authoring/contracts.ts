// Level authoring contracts — reusable local room data compiled into runtime definitions.

import type { Bounds3, BoundsXZ, ChallengeDefinition, CheckpointDefinition, FloorArtPaletteId, FloorArtRecipeId, LevelMovementDefinition, LevelTutorialDefinition, MuseumAudioSceneId, PlatformDefinition, PlatformRenderQuarterTurns, SolidActivation, SolidMaterialRole, SolidPresentation, SolidPropDefinition, Vec3, } from '../contracts'

export type QuarterTurn = PlatformRenderQuarterTurns

export interface RoomPlacement {
  id: string
  prefabId: string
  translate: Vec3
  yawQuarterTurns: QuarterTurn
  /** Add encounter prerequisites to checkpoints on this room instance. */
  checkpointRequiresCompleted?: Readonly<Record<string, readonly string[]>>
  /** Re-skin every authored region in this reusable room with one host scene. */
  audioSceneId?: MuseumAudioSceneId
  /** Apply one coherent surface language to this room's physical platforms. */
  floorArt?: {
    recipeId: FloorArtRecipeId
    palette?: FloorArtPaletteId
  }
}

export interface RoomPortDefinition {
  id: string
  position: Vec3
  facingYaw: number
  width: number
  height: number
  /** Local solid removed when this port participates in a connection. */
  sealSolidId: string
}

export interface RoomExhibitMountDefinition {
  id: string
  position: Vec3
  anchor: Vec3
  facingYaw: number
  platformId: string
}

export interface RoomExitDefinition extends BoundsXZ {
  id: string
  top: number
}

export interface RoomVisualDefinition {
  id: string
  recipeId: string
  position: Vec3
  yaw: number
  /** Local collision solids represented by this optional detailed visual. */
  coversSolidIds?: readonly string[]
}

export interface RoomDecorationDefinition {
  id: string
  recipeId: string
  position: Vec3
  yaw: number
  /** Uniform instance scale on top of the normalized catalog recipe. */
  scale?: number
  /** Local collision solids represented by this optional detailed prop. */
  coversSolidIds?: readonly string[]
}

export interface RoomAudioRegionDefinition {
  id: string
  bounds: Bounds3
  sceneId: MuseumAudioSceneId
}

export interface RoomPrefab {
  id: string
  bounds: Bounds3
  cameraBounds?: Bounds3
  platforms: readonly PlatformDefinition[]
  solids: readonly SolidPropDefinition[]
  checkpoints: readonly CheckpointDefinition[]
  ports: readonly RoomPortDefinition[]
  exhibitMounts: readonly RoomExhibitMountDefinition[]
  exits: readonly RoomExitDefinition[]
  visuals: readonly RoomVisualDefinition[]
  decorations?: readonly RoomDecorationDefinition[]
  audioRegions: readonly RoomAudioRegionDefinition[]
}

export interface ExhibitPrefab {
  id: string
  variant: string
  plinth: {
    height: number
    radiusTop: number
    radiusBottom: number
    presentation: SolidPresentation
  }
}

export interface ExhibitPlacement {
  id: string
  roomId: string
  mountId: string
  prefabId: string
  label: string
  optional: boolean
  challenge: ChallengeDefinition
  requiresCompleted?: readonly string[]
}

export interface PortConnection {
  from: string
  to: string
  optional?: boolean
  gate?: {
    id: string
    opensAfter: string
    material: SolidMaterialRole
    assetRecipeId?: string
  }
}

export interface SolidActivationOverride {
  solid: string
  activation: SolidActivation
  requiredForRoute?: boolean
}

export interface AuthoredEncounterSuccessNotice {
  encounterId: string
  notice: string
}

export interface AuthoredLevelGuidance {
  tutorial?: LevelTutorialDefinition
  subtitle?: string
  openingNotice?: string
  encounterSuccessNotices?: readonly AuthoredEncounterSuccessNotice[]
  completionTitle?: string
  completionNext?: string
}

export interface AuthoredDiscoveryReward {
  encounterId: string
  coinIds: readonly string[]
}

export interface AuthoredPitchAccuracyGradingPolicy {
  kind: 'pitch-accuracy-v1'
  encounterId: string
  policyRevision: number
  challengeRevision: number
  minimumReliableSeconds: number
  threeStarMaxMeanCents: number
  twoStarMaxMeanCents: number
  maximumErrorCents: number
}

export interface AuthoredPortraitCollectible {
  portraitId: string
  legendId: string
  title: string
  collectionIndex: number
  imageAssetId: string
  awardAfterEncounterId: string
  representationStatus: 'review' | 'approved'
}

export interface AuthoredLevelRewards {
  revision: number
  discoveries: readonly AuthoredDiscoveryReward[]
  grading: readonly AuthoredPitchAccuracyGradingPolicy[]
  portrait?: AuthoredPortraitCollectible
}

export interface AuthoredLevelSource {
  levelId: string
  layoutId: string
  contentRevision: number
  title: string
  movement?: LevelMovementDefinition
  guidance?: AuthoredLevelGuidance
  rewards?: AuthoredLevelRewards
  rooms: readonly RoomPlacement[]
  exhibits: readonly ExhibitPlacement[]
  connections: readonly PortConnection[]
  solidActivations?: readonly SolidActivationOverride[]
  spawnCheckpoint: string
  exit: {
    zone: string
    requiresCompleted: readonly string[]
  }
  fallBelow: number
  worldBounds: Bounds3
  lightBounds: Bounds3
}

export interface LevelAuthoringCatalog {
  rooms: Readonly<Partial<Record<string, RoomPrefab>>>
  exhibits: Readonly<Partial<Record<string, ExhibitPrefab>>>
  availableAssetRecipeIds: readonly string[]
}

export interface LevelAuthoringDiagnostic {
  code: string
  path: string
  message: string
}

export class LevelAuthoringError extends Error {
  readonly diagnostics: readonly LevelAuthoringDiagnostic[]

  constructor(diagnostics: readonly LevelAuthoringDiagnostic[]) {
    super(
      `Level authoring failed:\n${diagnostics
        .map((item) => `- ${item.path}: ${item.message}`)
        .join('\n')}`,
    )
    this.name = 'LevelAuthoringError'
    this.diagnostics = diagnostics
  }
}
