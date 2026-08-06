// UVR read service exposes strict local snapshots for standalone playback rooms.
// ============================================================

import type { UvrSessionRecord, UvrStemBlob, UvrStemType } from '@/db/entities'
import { getLocalDatabase } from '@/db/local-database'

export interface UvrStemSnapshotEntry {
  kind: UvrStemType
  mimeType: string
  data: ArrayBuffer
  sizeBytes: number
}

const PLAYABLE_STEM_KINDS: readonly Exclude<UvrStemType, 'original'>[] = [
  'vocal',
  'instrumental',
  'drums',
  'bass',
  'guitar',
  'piano',
  'other',
]

/** Read session metadata while preserving IndexedDB failures for the caller. */
export function readUvrSessionRecords(): Promise<UvrSessionRecord[]> {
  return getLocalDatabase().readAllStrict<UvrSessionRecord>('uvrSessions')
}

/**
 * Read every durable stem for one session exactly once, keeping only the
 * newest row per kind. The returned snapshot drives both backing selection
 * and URL hydration, avoiding a metadata scan followed by repeated blob reads.
 */
export async function readUvrStemSnapshot(
  sessionId: string,
): Promise<readonly UvrStemSnapshotEntry[]> {
  const rows = await getLocalDatabase().readByIndexStrict<UvrStemBlob>(
    'uvrStemBlobs',
    'sessionId',
    sessionId,
  )
  const latestByKind = new Map<UvrStemType, UvrStemBlob>()
  for (const row of rows) {
    const existing = latestByKind.get(row.stemType)
    if (existing === undefined || row.createdAt > existing.createdAt) {
      latestByKind.set(row.stemType, row)
    }
  }

  return Object.freeze(
    [...latestByKind.values()]
      .filter((row) => row.stemType !== 'original')
      .map((row) => ({
        kind: row.stemType,
        mimeType: row.mimeType,
        data: row.data,
        sizeBytes: row.size,
      })),
  )
}

/**
 * Discover playable kinds with index counts only. No audio payload is copied
 * into JavaScript while Guitar Night decides between a two-stem and part mix.
 */
export async function readUvrStemManifest(
  sessionId: string,
): Promise<readonly Exclude<UvrStemType, 'original'>[]> {
  const database = getLocalDatabase()
  const counts = await Promise.all(
    PLAYABLE_STEM_KINDS.map((kind) =>
      database.countByCompoundIndexStrict(
        'uvrStemBlobs',
        '[sessionId+stemType]',
        [sessionId, kind],
      ),
    ),
  )
  return Object.freeze(
    PLAYABLE_STEM_KINDS.filter((_, index) => (counts[index] ?? 0) > 0),
  )
}

/** Hydrate only the selected kinds, retaining the newest row per kind. */
export async function readUvrStemSelection(
  sessionId: string,
  requested: readonly UvrStemType[],
): Promise<readonly UvrStemSnapshotEntry[]> {
  const database = getLocalDatabase()
  const uniqueKinds = [...new Set(requested)].filter(
    (kind) => kind !== 'original',
  )
  const rowsByKind = await Promise.all(
    uniqueKinds.map((kind) =>
      database.readByCompoundIndexStrict<UvrStemBlob>(
        'uvrStemBlobs',
        '[sessionId+stemType]',
        [sessionId, kind],
      ),
    ),
  )

  return Object.freeze(
    rowsByKind.flatMap((rows) => {
      const newest = rows.reduce<UvrStemBlob | null>((latest, row) => {
        if (latest === null || row.createdAt > latest.createdAt) return row
        return latest
      }, null)
      if (newest === null) return []
      return [
        {
          kind: newest.stemType,
          mimeType: newest.mimeType,
          data: newest.data,
          sizeBytes: newest.size,
        },
      ]
    }),
  )
}
