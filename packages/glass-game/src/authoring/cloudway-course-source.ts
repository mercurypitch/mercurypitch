// Cloudway course source — JSON-safe placements for measured linear routes.

import type { Bounds3, PlatformRenderQuarterTurns, Vec3 } from '../contracts'

export interface CloudwayCourseDocumentSource {
  schema: 'mercurypitch.cloudway-course'
  schemaVersion: 2
  courses: readonly CloudwayCourseSource[]
}

export interface CloudwayCourseSource {
  id: string
  title: string
  authored: {
    levelId: string
    layoutId: string
    contentRevision: number
  }
  movement: {
    walkSpeed: number
    runSpeed: number
    runDelaySeconds: number
    runRampSeconds: number
  }
  guidance: {
    subtitle: string
    openingNotice: string
    completionTitle: string
    completionNext: string
  }
  spawn: CloudwayCourseSpawnSource
  platforms: readonly CloudwayCoursePlatformSource[]
  gaps: readonly CloudwayCourseGapSource[]
  checkpoints: readonly CloudwayCourseCheckpointSource[]
  encounters: readonly CloudwayCourseEncounterSource[]
  camera: CloudwayCourseCameraSource
  exit: CloudwayCourseExitSource
  fallBelow: number
  presentation: {
    worldBounds: Bounds3
    lightBounds: Bounds3
    audioSceneId: 'museum' | 'garden' | 'gallery'
  }
}

export interface CloudwayCourseSpawnSource {
  position: Vec3
  facingYaw: number
  checkpointId: string
}

export interface CloudwayCoursePlatformSource {
  id: string
  profileId: string
  center: Vec3
  quarterTurns: PlatformRenderQuarterTurns
  behavior?:
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
        minLengthRatio: number
        extendedSeconds: number
        retractedSeconds: number
        transitionSeconds: number
        initialState: 'extended' | 'retracted'
      }
}

export type CloudwayCourseGapState = 'base' | 'scroll-extended' | 'glide-end'

export interface CloudwayCourseGapSource {
  id: string
  fromPlatformId: string
  toPlatformId: string
  axis: 'x' | 'z'
  fromState: CloudwayCourseGapState
  toState: CloudwayCourseGapState
  distance: number
}

export interface CloudwayCourseCheckpointSource {
  id: string
  position: Vec3
  radius: number
  facingYaw: number
  requiresCompleted?: readonly string[]
}

export interface CloudwayCourseEncounterSource {
  id: string
  label: string
  variant: string
  position: Vec3
  anchor: Vec3
  optional: boolean
  requiresCompleted?: readonly string[]
  challengeProfileId: 'comfortable-hold'
  presentation?: {
    kind: 'barrier'
    profileId: string
    facingYaw: number
  }
}

export interface CloudwayCourseCameraSource {
  initialSectionId: string
  landingDwellSeconds: number
  sections: readonly {
    id: string
    platformIds: readonly string[]
    lookFromPlatformId: string
    lookToPlatformId: string
    targetOffset?: Vec3
  }[]
}

export interface CloudwayCourseExitSource {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
  top: number
  requiresCompleted: readonly string[]
}
