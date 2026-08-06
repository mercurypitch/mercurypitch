// Guitar Night song ports describe prepared local backing without owning playback.
// ============================================================

export type GuitarNightStemKind =
  | 'vocal'
  | 'instrumental'
  | 'drums'
  | 'bass'
  | 'guitar'
  | 'piano'
  | 'other'

export interface GuitarNightSongSummary {
  sessionId: string
  title: string
  createdAt: number
}

export interface GuitarNightStemAsset {
  kind: GuitarNightStemKind
  url: string
  sizeBytes: number
  durationSeconds?: number
}

export type GuitarNightDefaultMix =
  | {
      kind: 'parts'
      audible: readonly GuitarNightStemKind[]
      muted: readonly [] | readonly ['guitar']
    }
  | {
      kind: 'mixed-instrumental'
      audible: readonly ('vocal' | 'instrumental')[]
      muted: readonly []
    }

export interface GuitarNightBackingLease {
  sessionId: string
  title: string
  stems: readonly GuitarNightStemAsset[]
  defaultMix: GuitarNightDefaultMix
  release(): void
}

export type GuitarNightOpenBackingResult =
  | { ok: true; lease: GuitarNightBackingLease }
  | {
      ok: false
      code: 'not-found' | 'not-completed' | 'missing-local-audio' | 'aborted'
    }

export interface GuitarNightSongPort {
  initialize(): Promise<void>
  completedSongs(): readonly GuitarNightSongSummary[]
  openSession(
    sessionId: string,
    signal: AbortSignal,
  ): Promise<GuitarNightOpenBackingResult>
}

export interface GuitarNightBackingPlan {
  kind: GuitarNightDefaultMix['kind']
  requested: readonly GuitarNightStemKind[]
}

const PART_STEMS: readonly GuitarNightStemKind[] = [
  'drums',
  'bass',
  'guitar',
  'piano',
  'other',
]

export function planGuitarNightBacking(
  available: readonly GuitarNightStemKind[],
): GuitarNightBackingPlan {
  const kinds = new Set(available)
  const accompanimentParts = PART_STEMS.filter(
    (kind) => kind !== 'guitar' && kinds.has(kind),
  )

  if (accompanimentParts.length > 0) {
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

/**
 * Resolve the default mix from the stems that were actually leased. Durable
 * blobs can disappear between discovery and hydration, so UI claims must not
 * rely on the earlier availability snapshot.
 */
export function resolveGuitarNightDefaultMix(
  leased: readonly GuitarNightStemKind[],
): GuitarNightDefaultMix | null {
  const kinds = new Set(leased)
  const accompanimentParts = PART_STEMS.filter(
    (kind) => kind !== 'guitar' && kinds.has(kind),
  )

  if (accompanimentParts.length > 0) {
    return {
      kind: 'parts',
      audible: leased.filter((kind) => kind !== 'guitar'),
      muted: kinds.has('guitar') ? ['guitar'] : [],
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
