// Studio model — durable local audio projects, source ownership and frame-based edits.
import type { VoiceTakeSource } from '@/db/entities'
import type { ChainSpec, ParamValues } from '@/lib/studio-fx/chain-spec'
import type { MixMacros } from '@/lib/studio-fx/mix-macros'
import type { TrackRole } from '@/lib/studio-fx/role-chains'

export const STUDIO_SCHEMA_VERSION = 1
export const STUDIO_SAMPLE_RATE = 48000
export const STUDIO_ENGINE_VERSION = 'studio-fx-v1'
export const STUDIO_PREPARATION_VERSION = 'bs1770-48k-v1'
export type Frame = number
export type SourceKind = VoiceTakeSource | 'file'

export interface StudioProject {
  readonly id: string
  readonly schemaVersion: 1
  readonly revision: number
  readonly title: string
  readonly createdAt: string
  readonly updatedAt: string
  readonly sampleRate: 48000
  readonly tempoBpm: number
  readonly ruler: 'time' | 'bars'
  readonly tracks: readonly StudioTrack[]
  readonly clips: readonly StudioClip[]
  readonly mix: {
    readonly flavourId: string
    readonly macros: MixMacros
    readonly autoBalanceRevision?: number
  }
  readonly master: {
    readonly presetId: string
    readonly engineVersion: string
    readonly targetLufs: number
    readonly ceilingDbtp: number
    readonly maxLimitingDb: number
    readonly masterEq: ParamValues
  }
  readonly export: {
    readonly format: 'wav'
    readonly bitDepth: 16
    readonly range: 'song' | 'selection'
  }
}

export interface StudioTrack {
  readonly id: string
  readonly name: string
  readonly order: number
  readonly role: TrackRole
  readonly gainDb: number
  readonly balanceGainDb: number
  readonly pan: number
  readonly mute: boolean
  readonly solo: boolean
  readonly fx: {
    readonly version: 1
    readonly baseSpec: ChainSpec
    readonly spaceOffset: number
  }
}

export interface FadeRamp {
  readonly fromSourceFrame: Frame
  readonly toSourceFrame: Frame
}

export interface StudioClip {
  readonly id: string
  readonly trackId: string
  readonly assetId: string
  readonly startFrame: Frame
  readonly sourceInFrame: Frame
  readonly sourceOutFrame: Frame
  readonly gainDb: number
  readonly fades: {
    readonly curve: 'linear-amplitude'
    readonly in?: FadeRamp
    readonly out?: FadeRamp
  }
}

export interface StudioAsset {
  readonly id: string
  readonly projectId: string
  readonly sha256: string
  readonly mimeType: string
  readonly byteLength: number
  readonly channels: 1 | 2
  readonly normalizedSampleRate: 48000
  readonly normalizedFrameCount: Frame
  readonly importVersion: 1
  readonly originalName?: string
  readonly canonicalPcmId: string
  readonly canonicalPcmSha256: string
  readonly canonicalPcmByteLength: number
  readonly preparation: {
    readonly algorithmVersion: typeof STUDIO_PREPARATION_VERSION
    readonly gainDb: number
  }
  readonly provenance: {
    readonly kind: SourceKind
    readonly sourceId?: string
    readonly importedAt: string
  }
}

export interface StudioAssetData {
  readonly asset: StudioAsset
  readonly original: Blob
  readonly canonicalPcm: Blob
}

export interface StudioProjectSummary {
  readonly id: string
  readonly title: string
  readonly revision: number
  readonly createdAt: string
  readonly updatedAt: string
  readonly trackCount: number
  readonly clipCount: number
  readonly durationFrames: Frame
}
