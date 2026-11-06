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
/** Where a take came from: a practice take, a picked file, or recorded in the Studio. */
export type SourceKind = VoiceTakeSource | 'file' | 'recording'

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
  /** Volume and pan lines over the song (automation.ts); absent, the faders hold still. */
  readonly automation?: StudioLaneAutomation
  /**
   * The instrument the singer picked, a glyph id (lib/studio/instruments).
   * Absent, the lane draws what its name and role say; saved only when picked,
   * so a song nobody picked for opens in a Studio from before the field. An
   * id this build does not draw is kept and passed over.
   */
  readonly instrument?: string
}

/** A point on a lane's line: the control's value at this frame of the song. */
export interface StudioAutomationPoint {
  readonly frame: Frame
  readonly value: number
}

/**
 * A lane's volume line, in fader decibels, and its pan line, -1 full left
 * to 1 full right: each straight between its points, in time order, and
 * flat beyond its first and last. A line left out leaves its control where
 * the fader or the knob is.
 */
export interface StudioLaneAutomation {
  readonly volume?: readonly StudioAutomationPoint[]
  readonly pan?: readonly StudioAutomationPoint[]
}

export interface FadeRamp {
  readonly fromSourceFrame: Frame
  readonly toSourceFrame: Frame
}

/**
 * A loop take's passes (clip-passes.ts): `count` stretches of `frames` each,
 * back to back in the clip's one audio from source frame `firstFrame`, every
 * one sung over the same range. Which one plays is where the clip's source
 * frames sit, so it cannot disagree with what is heard.
 */
export interface StudioClipPasses {
  readonly firstFrame: Frame
  readonly frames: Frame
  readonly count: number
}

export interface StudioClip {
  readonly id: string
  readonly trackId: string
  /** The audio the clip plays: for a loop take, the whole capture, one pass of it heard. */
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
  /** A loop take's passes, its source frames inside one of them; absent for any other clip. */
  readonly passes?: StudioClipPasses
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
  /**
   * How the canonical copy keeps its samples: absent for 32-bit floats,
   * 'int16' for Save space's 16-bit steps (canonical-pcm16.ts). A take keeps
   * the format it was imported with whatever the setting is later. A build
   * from before Save space refuses a take with this field.
   */
  readonly canonicalPcmFormat?: 'int16'
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

/**
 * Audio handed over as bytes the caller no longer uses: a restored backup or
 * a copied song. Storage keeps these buffers as they are, without a copy.
 */
export interface StudioAssetBytes {
  readonly asset: StudioAsset
  readonly original: ArrayBuffer
  readonly canonicalPcm: ArrayBuffer
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
