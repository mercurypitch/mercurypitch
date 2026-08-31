// UVR read service exposes strict local snapshots for standalone playback rooms.
// ============================================================

import type { UvrSessionRecord, UvrStemBlob, UvrStemType } from '@/db/entities'
import { getLocalDatabase } from '@/db/local-database'
import { queueStemRowBlobMigration } from '@/db/services/uvr-stem-migration'

export interface UvrStemSnapshotEntry {
  kind: UvrStemType
  mimeType: string
  /** ArrayBuffer for legacy rows, Blob for migrated ones — read via
   *  src/db/stem-blob-data.ts. */
  data: ArrayBuffer | Blob
  sizeBytes: number
}

export type UvrBudgetedStemSelection =
  | {
      ok: true
      snapshot: readonly UvrStemSnapshotEntry[]
      totalBytes: number
    }
  | {
      ok: false
      requiredBytes: number
      budgetBytes: number
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
      .map((row) => {
        queueStemRowBlobMigration(row)
        return {
          kind: row.stemType,
          mimeType: row.mimeType,
          data: row.data,
          sizeBytes: row.size,
        }
      }),
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
      database.readLatestByCompoundPrefixStrict<UvrStemBlob>(
        'uvrStemBlobs',
        '[sessionId+stemType+createdAt]',
        [sessionId, kind],
      ),
    ),
  )

  return Object.freeze(
    rowsByKind.flatMap((newest) => {
      if (newest === null) return []
      if (newest === undefined) return []
      queueStemRowBlobMigration(newest)
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

/**
 * Hydrate requested rows sequentially and stop before retaining a selection
 * whose authoritative persisted sizes exceed the caller's encoded budget.
 *
 * This is the explicit-Play path. It intentionally avoids `Promise.all`: at
 * most one not-yet-budgeted stem row is materialized at a time, cancellation
 * is checked between every IndexedDB read, and no object URL is created here.
 */
export async function readUvrStemSelectionWithinBudget(
  sessionId: string,
  requested: readonly UvrStemType[],
  options: { signal: AbortSignal; budgetBytes: number },
): Promise<UvrBudgetedStemSelection> {
  const database = getLocalDatabase()
  const uniqueKinds = [...new Set(requested)].filter(
    (kind) => kind !== 'original',
  )
  const budgetBytes = Math.max(0, Math.floor(options.budgetBytes))
  const snapshot: UvrStemSnapshotEntry[] = []
  let totalBytes = 0

  for (const kind of uniqueKinds) {
    if (options.signal.aborted) {
      throw new DOMException('The operation was aborted.', 'AbortError')
    }
    const newest = await database.readLatestByCompoundPrefixStrict<UvrStemBlob>(
      'uvrStemBlobs',
      '[sessionId+stemType+createdAt]',
      [sessionId, kind],
    )
    if (options.signal.aborted) {
      throw new DOMException('The operation was aborted.', 'AbortError')
    }
    if (newest === undefined) continue

    const rowBytes = Number.isFinite(newest.size)
      ? Math.max(0, Math.ceil(newest.size))
      : Number.MAX_SAFE_INTEGER
    const requiredBytes = Math.min(
      Number.MAX_SAFE_INTEGER,
      totalBytes + rowBytes,
    )
    if (requiredBytes > budgetBytes) {
      return { ok: false, requiredBytes, budgetBytes }
    }
    totalBytes = requiredBytes
    queueStemRowBlobMigration(newest)
    snapshot.push({
      kind: newest.stemType,
      mimeType: newest.mimeType,
      data: newest.data,
      sizeBytes: newest.size,
    })
  }

  return {
    ok: true,
    snapshot: Object.freeze(snapshot),
    totalBytes,
  }
}
