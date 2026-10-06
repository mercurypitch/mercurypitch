// Procedural generator contracts — types for modular chunk-socket synthesis.

import type { Vec3 } from '../../contracts.ts'

export type CardinalDirection = 'north' | 'east' | 'south' | 'west'

export interface ChunkSocket {
  readonly id: string
  readonly position: Vec3
  readonly facing: CardinalDirection
  readonly width: number
  readonly clearanceMargin: number
}

export interface ChunkPlatform {
  readonly localId: string
  readonly profileId: string
  readonly center: Vec3
  readonly quarterTurns?: number
  readonly behavior?:
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
  readonly crystalInterior?: {
    preset: 'aurora-heart' | 'resonance-veins' | 'frost-roots' | 'living-amber'
    seed?: number
  }
}

export interface ChunkGap {
  readonly localId: string
  readonly platformALocalId: string
  readonly platformBLocalId: string
  readonly minimumClearanceMeters: number
  readonly axis: 'x' | 'z'
}

export interface ChunkEncounter {
  readonly localId: string
  readonly role: 'note' | 'gate' | 'finale'
  readonly label: string
  readonly variant: string
  readonly position: Vec3
  readonly anchor: Vec3
  readonly noteAnchorId?: string
  readonly presentationBarrier?: {
    profileId: string
    facingYaw: number
  }
}

export interface ChunkCheckpoint {
  readonly localId: string
  readonly position: Vec3
  readonly facingYaw: number
  readonly radius: number
}

export interface ChunkCameraSection {
  readonly localId: string
  readonly platformLocalIds: readonly string[]
  readonly lookFromPlatformLocalId: string
  readonly lookToPlatformLocalId: string
}

export interface ChunkExitBounds {
  readonly minX: number
  readonly maxX: number
  readonly minZ: number
  readonly maxZ: number
  readonly top: number
}

export interface ProceduralChunk {
  readonly id: string
  readonly kind:
    | 'arrival'
    | 'frost-glissade'
    | 'hex-cascade'
    | 'scroll-bridge'
    | 'aurora-glide'
    | 'vocal-sanctuary'
    | 'finale'
  readonly entrySocket: ChunkSocket
  readonly exitSocket: ChunkSocket
  readonly platforms: readonly ChunkPlatform[]
  readonly gaps: readonly ChunkGap[]
  readonly encounters?: readonly ChunkEncounter[]
  readonly checkpoints?: readonly ChunkCheckpoint[]
  readonly cameraSection?: ChunkCameraSection
  readonly localExit?: ChunkExitBounds
}

export interface ProceduralGeneratorOptions {
  readonly seed: number | string
  readonly courseId?: string
  readonly title?: string
  readonly difficulty?: 'gentle' | 'balanced' | 'virtuoso'
  readonly melodyLessonId?: 'first-arc-v1' | 'sunlit-steps-v1' | 'gallery-arch-v1'
  readonly fogTheme?: 'dawn' | 'celestial' | 'aurora' | 'twilight'
  readonly includeLivingCrystals?: boolean
}
