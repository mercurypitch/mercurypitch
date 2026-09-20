// Level authoring contracts — reusable local room data compiled into runtime definitions.

import type { Bounds3, BoundsXZ, CheckpointDefinition, HoldDefinition, MuseumAudioSceneId, PlatformDefinition, SolidActivation, SolidMaterialRole, SolidPresentation, SolidPropDefinition, Vec3, } from '../contracts'

export type QuarterTurn = 0 | 1 | 2 | 3

export interface RoomPlacement {
  id: string
  prefabId: string
  translate: Vec3
  yawQuarterTurns: QuarterTurn
  /** Re-skin every authored region in this reusable room with one host scene. */
  audioSceneId?: MuseumAudioSceneId
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
  audioRegions: readonly RoomAudioRegionDefinition[]
}

export interface ExhibitPrefab {
  id: string
  variant: string
  hold: HoldDefinition
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
  subtitle?: string
  openingNotice?: string
  encounterSuccessNotices?: readonly AuthoredEncounterSuccessNotice[]
  completionTitle?: string
  completionNext?: string
}

export interface AuthoredLevelSource {
  levelId: string
  layoutId: string
  contentRevision: number
  title: string
  guidance?: AuthoredLevelGuidance
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
