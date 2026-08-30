// Play-along song ports describe target-aware prepared backing without owning playback.
// ============================================================

import { encodedAudioBudgetBytes } from '@/lib/audio-memory-budget'

export type PlayAlongStemKind =
  | 'vocal'
  | 'instrumental'
  | 'drums'
  | 'bass'
  | 'guitar'
  | 'piano'
  | 'other'

export type PlayAlongTargetStemKind = 'drums' | 'bass' | 'guitar' | 'piano'

export interface PlayAlongTargetPolicy<
  TTarget extends PlayAlongTargetStemKind = PlayAlongTargetStemKind,
> {
  target: TTarget
  /** Whether the isolated source target starts muted when full parts exist. */
  muteTargetByDefault: boolean
  /** Every part that must exist before a partial split may replace two-stem backing. */
  requiredPartKinds: readonly Exclude<
    PlayAlongStemKind,
    'vocal' | 'instrumental'
  >[]
  /**
   * Reconstruct a target-free backing from the aligned instrumental and the
   * isolated target. The cloud split must still contain every required part;
   * this only compacts the local playback representation after that proof.
   */
  reconstructBackingFromInstrumental?: boolean
}

export const GUITAR_PLAY_ALONG_POLICY = {
  target: 'guitar',
  muteTargetByDefault: true,
  requiredPartKinds: [],
} as const satisfies PlayAlongTargetPolicy<'guitar'>

export const DRUM_PLAY_ALONG_POLICY = {
  target: 'drums',
  muteTargetByDefault: false,
  requiredPartKinds: ['drums', 'bass', 'guitar', 'piano', 'other'],
  reconstructBackingFromInstrumental: true,
} as const satisfies PlayAlongTargetPolicy<'drums'>

export interface PlayAlongSongSummary {
  sessionId: string
  title: string
  createdAt: number
  source?: 'device' | 'demo'
  subtitle?: string
}

export interface PlayAlongStemAsset {
  kind: PlayAlongStemKind
  url: string
  /** Stored audio handle when the song lives on this device (absent for
   *  streamed demo songs). Enables windowed playback of oversized mixes. */
  blob?: Blob
  mimeType?: string
  sizeBytes: number
  durationSeconds?: number
}

export type PlayAlongDefaultMix<
  TTarget extends PlayAlongTargetStemKind = PlayAlongTargetStemKind,
> =
  | {
      kind: 'parts'
      audible: readonly PlayAlongStemKind[]
      muted: readonly [] | readonly [TTarget]
    }
  | {
      /** The target remains inside this premixed accompaniment. */
      kind: 'mixed-instrumental'
      audible: readonly ('vocal' | 'instrumental')[]
      muted: readonly []
    }

export interface PlayAlongBackingLease<
  TTarget extends PlayAlongTargetStemKind = PlayAlongTargetStemKind,
> {
  sessionId: string
  title: string
  stems: readonly PlayAlongStemAsset[]
  defaultMix: PlayAlongDefaultMix<TTarget>
  source?: 'device' | 'demo'
  release(): void
}

export interface PlayAlongReleasableBacking {
  sessionId: string
  release(): void
}

/**
 * Metadata-only prepared backing selected from a catalog.
 *
 * `load` is the explicit boundary that may read durable audio and mint object
 * URLs. Calling `release` aborts an in-flight load and releases a successful
 * hydrated lease. Catalog selection itself never copies stem payloads.
 */
export interface PlayAlongBackingSource<
  TTarget extends PlayAlongTargetStemKind = PlayAlongTargetStemKind,
> extends PlayAlongReleasableBacking {
  title: string
  stemKinds: readonly PlayAlongStemKind[]
  plannedMix: PlayAlongDefaultMix<TTarget>
  /** Longest persisted requested-stem duration, without reading audio bytes. */
  durationSeconds: number | null
  source?: 'device' | 'demo'
  load(
    options: PlayAlongBackingLoadOptions,
  ): Promise<PlayAlongBackingLoadResult<TTarget>>
}

/**
 * Device-aware, so a workstation is not held to a phone's ceiling. A function
 * rather than a constant because the answer depends on the device the room
 * opened on. See `@/lib/audio-memory-budget` for what the browser will admit.
 */
export function defaultPlayAlongEncodedByteBudget(): number {
  return encodedAudioBudgetBytes()
}

/**
 * One sentence both rooms share for the encoded-byte ceiling. It names the
 * ceiling as a size limit, never as missing audio: the files are present, and
 * the same song still opens in the stem mixer, which has no such ceiling.
 * Uncompressed WAV parts reach it far sooner than MP3 or Opus of the same song.
 */
export function playAlongEncodedBudgetCopy(
  requiredBytes?: number,
  budgetBytes?: number,
): string {
  const mib = (value: number): number =>
    Math.max(0, Math.round(value / (1024 * 1024)))
  const sizes =
    requiredBytes !== undefined &&
    Number.isFinite(requiredBytes) &&
    budgetBytes !== undefined &&
    Number.isFinite(budgetBytes)
      ? ` Its parts total about ${mib(requiredBytes)} MB against a ${mib(
          budgetBytes,
        )} MB ceiling.`
      : ''
  return `This song's audio is here, but it is too large to open in this room.${sizes} Re-prepare it from a compressed source, or shorten it.`
}

export interface PlayAlongBackingLoadOptions {
  signal: AbortSignal
  /** Cumulative encoded row-size ceiling, before object URLs are allocated. */
  encodedByteBudget?: number
}

export type PlayAlongBackingLoadResult<
  TTarget extends PlayAlongTargetStemKind = PlayAlongTargetStemKind,
> =
  | { ok: true; lease: PlayAlongBackingLease<TTarget> }
  | { ok: false; code: 'missing-local-audio' | 'aborted' }
  | {
      ok: false
      code: 'encoded-budget'
      requiredBytes: number
      budgetBytes: number
    }

export type PlayAlongOpenBackingResult<
  TTarget extends PlayAlongTargetStemKind = PlayAlongTargetStemKind,
> = PlayAlongOpenResult<PlayAlongBackingLease<TTarget>>

export type PlayAlongOpenBackingSourceResult<
  TTarget extends PlayAlongTargetStemKind = PlayAlongTargetStemKind,
> = PlayAlongOpenResult<PlayAlongBackingSource<TTarget>>

export type PlayAlongOpenResult<TBacking extends PlayAlongReleasableBacking> =
  | { ok: true; lease: TBacking }
  | {
      ok: false
      code: 'not-found' | 'not-completed' | 'missing-local-audio' | 'aborted'
    }
  /**
   * A room that opens its lease eagerly hits the encoded-byte ceiling here
   * rather than at load(). It must stay a distinct code: folding it into
   * `missing-local-audio` tells the player their audio is gone when it is
   * present and simply larger than the ceiling.
   */
  | {
      ok: false
      code: 'encoded-budget'
      requiredBytes: number
      budgetBytes: number
    }

export interface PlayAlongSongCatalogPort<
  TBacking extends PlayAlongReleasableBacking,
> {
  initialize(): Promise<void>
  completedSongs(): readonly PlayAlongSongSummary[]
  openSession(
    sessionId: string,
    signal: AbortSignal,
  ): Promise<PlayAlongOpenResult<TBacking>>
}

export type PlayAlongSongPort<
  TTarget extends PlayAlongTargetStemKind = PlayAlongTargetStemKind,
> = PlayAlongSongCatalogPort<PlayAlongBackingLease<TTarget>>

export type PlayAlongSongSourcePort<
  TTarget extends PlayAlongTargetStemKind = PlayAlongTargetStemKind,
> = PlayAlongSongCatalogPort<PlayAlongBackingSource<TTarget>>

export interface PlayAlongBackingPlan {
  kind: PlayAlongDefaultMix['kind']
  requested: readonly PlayAlongStemKind[]
}

export const PLAY_ALONG_STEM_KINDS: readonly PlayAlongStemKind[] = [
  'vocal',
  'instrumental',
  'drums',
  'bass',
  'guitar',
  'piano',
  'other',
]

const PLAY_ALONG_STEM_KIND_SET = new Set<PlayAlongStemKind>(
  PLAY_ALONG_STEM_KINDS,
)

const PART_STEMS: readonly Exclude<
  PlayAlongStemKind,
  'vocal' | 'instrumental'
>[] = ['drums', 'bass', 'guitar', 'piano', 'other']

export function hasUsablePlayAlongParts<
  TTarget extends PlayAlongTargetStemKind,
>(
  available: readonly PlayAlongStemKind[],
  policy: PlayAlongTargetPolicy<TTarget>,
): boolean {
  const kinds = new Set(available)
  if (policy.requiredPartKinds.length > 0) {
    return policy.requiredPartKinds.every((kind) => kinds.has(kind))
  }
  return PART_STEMS.some((kind) => kind !== policy.target && kinds.has(kind))
}

export function isPlayAlongStemKind(kind: string): kind is PlayAlongStemKind {
  return PLAY_ALONG_STEM_KIND_SET.has(kind as PlayAlongStemKind)
}

/**
 * Prefer reconstructed band parts only when at least one non-target
 * accompaniment part exists. A lone isolated target cannot replace backing;
 * in that case the honest choice is the premixed instrumental.
 */
export function planPlayAlongBacking<TTarget extends PlayAlongTargetStemKind>(
  available: readonly PlayAlongStemKind[],
  policy: PlayAlongTargetPolicy<TTarget>,
): PlayAlongBackingPlan {
  const kinds = new Set(available)

  if (hasUsablePlayAlongParts(available, policy)) {
    if (
      policy.reconstructBackingFromInstrumental === true &&
      kinds.has('instrumental') &&
      kinds.has(policy.target)
    ) {
      return {
        kind: 'parts',
        requested: [
          ...(kinds.has('vocal') ? (['vocal'] as const) : []),
          'instrumental',
          policy.target,
        ],
      }
    }
    return {
      kind: 'parts',
      requested: [
        ...(kinds.has('vocal') ? (['vocal'] as const) : []),
        ...PART_STEMS.filter((kind) => kinds.has(kind)),
      ],
    }
  }

  return {
    kind: 'mixed-instrumental',
    requested: (['vocal', 'instrumental'] as const).filter((kind) =>
      kinds.has(kind),
    ),
  }
}

/** Resolve mix claims from the stems that actually survived lease hydration. */
export function resolvePlayAlongDefaultMix<
  TTarget extends PlayAlongTargetStemKind,
>(
  leased: readonly PlayAlongStemKind[],
  policy: PlayAlongTargetPolicy<TTarget>,
  options: { reconstructionProven?: boolean } = {},
): PlayAlongDefaultMix<TTarget> | null {
  const kinds = new Set(leased)

  const reconstructsTarget =
    options.reconstructionProven === true &&
    policy.reconstructBackingFromInstrumental === true &&
    kinds.has('instrumental') &&
    kinds.has(policy.target)

  if (reconstructsTarget || hasUsablePlayAlongParts(leased, policy)) {
    return {
      kind: 'parts',
      audible: policy.muteTargetByDefault
        ? leased.filter((kind) => kind !== policy.target)
        : leased,
      muted:
        policy.muteTargetByDefault && kinds.has(policy.target)
          ? [policy.target]
          : [],
    }
  }

  if (!kinds.has('instrumental')) return null
  return {
    kind: 'mixed-instrumental',
    audible: leased.filter(
      (kind): kind is 'vocal' | 'instrumental' =>
        kind === 'vocal' || kind === 'instrumental',
    ),
    muted: [],
  }
}
