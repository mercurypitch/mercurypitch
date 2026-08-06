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
