// ============================================================
// Voice Take Service — explicit, durable, local real-voice history
// ============================================================

import { ensurePersistentStorage, getDb } from '@/db'
import type { DurableWriteResult } from '@/db/durable-write'
import { durableWrite, hasRoomFor } from '@/db/durable-write'
import type { VoiceTakeAudioRecord, VoiceTakeContourRecord, VoiceTakeRecord, VoiceTakeSource, } from '@/db/entities'
import type { DatabaseAdapter } from '@/db/types'
import type { VoiceReflection } from '@/lib/domain/voice-reflections'
import { serializeVoiceReflections, VOICE_REFLECTIONS_VERSION, } from '@/lib/domain/voice-reflections'
import type { DecodedVoiceAtlasContour, VoiceAtlasContourPayloadV1, } from '@/lib/voice-contour'
import { decodeVoiceAtlasContour } from '@/lib/voice-contour'

interface LocalTransactionAdapter extends DatabaseAdapter {
  transactionLocal: DatabaseAdapter['transaction']
}

function supportsLocalTransactions(
  db: DatabaseAdapter,
): db is LocalTransactionAdapter {
  return (
    typeof (db as Partial<LocalTransactionAdapter>).transactionLocal ===
    'function'
  )
}

async function localTransaction<R>(
  db: DatabaseAdapter,
  fn: (transactionDb: DatabaseAdapter) => Promise<R>,
): Promise<R> {
  return supportsLocalTransactions(db)
    ? db.transactionLocal(fn)
    : db.transaction(fn)
}

/** The key-only deletes DexieAdapter offers (and HybridAdapter's local
 *  half reaches). An audio row is a whole recording, so a delete must
 *  never read one just to learn its id. */
interface StrictDeleteAdapter extends DatabaseAdapter {
  deleteByIdStrict(entityName: string, id: string): Promise<void>
  deleteByIndexStrict(
    entityName: string,
    indexName: string,
    value: string | number,
  ): Promise<void>
  clearStrict(entityName: string): Promise<void>
}

function requireStrictDeletes(db: DatabaseAdapter): StrictDeleteAdapter {
  const candidate = db as Partial<StrictDeleteAdapter>
  if (
    typeof candidate.deleteByIdStrict !== 'function' ||
    typeof candidate.deleteByIndexStrict !== 'function' ||
    typeof candidate.clearStrict !== 'function'
  ) {
    throw new Error(
      'Voice history needs a local database with key-only deletes',
    )
  }
  return db as StrictDeleteAdapter
}

export interface VoiceTakeDraft {
  source: VoiceTakeSource
  comparisonKey: string
  contextVersion?: number
  capturedAt?: string
  durationMs: number
  blob: Blob
  peaks: readonly number[] | Float32Array
  title: string
  context: Record<string, unknown>
  metrics?: Record<string, number | string | boolean | null>
  metricsVersion?: number
  contour?: VoiceAtlasContourPayloadV1
  roomId?: string
  favorite?: boolean
}

export interface VoiceStorageSnapshot {
  takeCount: number
  voiceBytes: number
  browserUsage: number | null
  browserQuota: number | null
  persistent: boolean | null
}

export type SaveVoiceTakeResult = DurableWriteResult<VoiceTakeRecord> & {
  roomAvailable: boolean
}

export async function saveVoiceTake(
  draft: VoiceTakeDraft,
): Promise<SaveVoiceTakeResult> {
  const contourJson =
    draft.contour === undefined ? undefined : JSON.stringify(draft.contour)
  const contourBytes =
    contourJson === undefined ? 0 : new TextEncoder().encode(contourJson).length
  const roomAvailable = await hasRoomFor(draft.blob.size + contourBytes)
  if (!roomAvailable) {
    return { ok: false, quotaExceeded: true, roomAvailable }
  }

  const result = await durableWrite('save voice take', async () => {
    const bytes = await draft.blob.arrayBuffer()
    const db = await getDb()
    return localTransaction(db, async (transactionDb) => {
      const takeRepo =
        transactionDb.getRepository<VoiceTakeRecord>('voiceTakes')
      const audioRepo =
        transactionDb.getRepository<VoiceTakeAudioRecord>('voiceTakeAudio')
      const contourRepo =
        transactionDb.getRepository<VoiceTakeContourRecord>('voiceTakeContours')
      const created = await takeRepo.create({
        source: draft.source,
        comparisonKey: draft.comparisonKey,
        contextVersion: draft.contextVersion ?? 1,
        capturedAt: draft.capturedAt ?? new Date().toISOString(),
        durationMs: Math.max(0, Math.round(draft.durationMs)),
        mimeType: draft.blob.type || 'application/octet-stream',
        sizeBytes: draft.blob.size,
        peaks: Array.from(draft.peaks, (peak) =>
          Math.max(0, Math.min(1, Number(peak) || 0)),
        ),
        title: draft.title.trim() || 'Untitled take',
        favorite: draft.favorite ?? false,
        contextJson: JSON.stringify(draft.context),
        metricsJson:
          draft.metrics === undefined
            ? undefined
            : JSON.stringify(draft.metrics),
        metricsVersion:
          draft.metrics === undefined ? undefined : (draft.metricsVersion ?? 1),
        contourVersion: draft.contour?.v,
        contourPointCount: draft.contour?.p.length,
        contourBytes: contourJson === undefined ? undefined : contourBytes,
        roomId: draft.roomId,
      })
      await audioRepo.create({
        takeId: created.id,
        mimeType: created.mimeType,
        size: draft.blob.size,
        data: bytes,
      })
      if (draft.contour !== undefined && contourJson !== undefined) {
        await contourRepo.create({
          takeId: created.id,
          contourVersion: draft.contour.v,
          analysisSource: draft.contour.s,
          pointCount: draft.contour.p.length,
          payloadJson: contourJson,
        })
      }
      return created
    })
  })

  if (result.ok) void ensurePersistentStorage('voice-takes')
  return { ...result, roomAvailable }
}

export async function listVoiceTakes(): Promise<VoiceTakeRecord[]> {
  const db = await getDb()
  return db.getRepository<VoiceTakeRecord>('voiceTakes').findAll({
    orderBy: 'capturedAt',
    orderDir: 'desc',
    throwOnError: true,
  })
}

export async function getVoiceTakeBlob(takeId: string): Promise<Blob | null> {
  const db = await getDb()
  const rows = await db
    .getRepository<VoiceTakeAudioRecord>('voiceTakeAudio')
    .findAll({ where: { takeId }, limit: 1, throwOnError: true })
  const row = rows[0]
  return row === undefined ? null : new Blob([row.data], { type: row.mimeType })
}

/**
 * Load and validate one take's optional local Voice Atlas contour.
 * Missing, corrupt, or unreadable analysis stays best-effort and returns null;
 * the authoritative take metadata and audio readers reject storage failures.
 */
export async function getVoiceTakeContour(
  takeId: string,
): Promise<DecodedVoiceAtlasContour | null> {
  try {
    const db = await getDb()
    const rows = await db
      .getRepository<VoiceTakeContourRecord>('voiceTakeContours')
      .findAll({ where: { takeId }, limit: 1, throwOnError: true })
    return rows[0] === undefined
      ? null
      : decodeVoiceAtlasContour(rows[0].payloadJson)
  } catch {
    // Atlas analysis is optional replay decoration. Keep the take playable
    // when that auxiliary store is unavailable or its payload is invalid.
    return null
  }
}

export async function updateVoiceTake(
  takeId: string,
  patch: Pick<Partial<VoiceTakeRecord>, 'title' | 'favorite'>,
): Promise<VoiceTakeRecord | null> {
  try {
    const db = await getDb()
    return await db
      .getRepository<VoiceTakeRecord>('voiceTakes')
      .update(takeId, patch)
  } catch {
    return null
  }
}

/** Replace one take's bounded, subjective replay markers. */
export async function updateVoiceTakeReflections(
  takeId: string,
  reflections: readonly VoiceReflection[],
): Promise<VoiceTakeRecord | null> {
  try {
    const db = await getDb()
    return await db
      .getRepository<VoiceTakeRecord>('voiceTakes')
      .update(takeId, {
        reflectionsJson: serializeVoiceReflections(reflections),
        reflectionsVersion: VOICE_REFLECTIONS_VERSION,
      })
  } catch {
    return null
  }
}

/** Rename every take in one user-created thread without changing its identity. */
export async function renameFreeformVoiceThread(
  comparisonKey: string,
  title: string,
): Promise<boolean> {
  const nextTitle = title.trim()
  if (comparisonKey === '' || nextTitle === '') return false
  try {
    const db = await getDb()
    await localTransaction(db, async (transactionDb) => {
      const takeRepo =
        transactionDb.getRepository<VoiceTakeRecord>('voiceTakes')
      const takes = await takeRepo.findAll({
        where: { comparisonKey },
        throwOnError: true,
      })
      if (
        takes.length === 0 ||
        takes.some((take) => take.source !== 'freeform')
      ) {
        throw new Error('Freeform voice thread not found')
      }

      for (const take of takes) {
        let context: Record<string, unknown> = {}
        try {
          const parsed = JSON.parse(take.contextJson) as unknown
          if (
            typeof parsed === 'object' &&
            parsed !== null &&
            !Array.isArray(parsed)
          ) {
            context = parsed as Record<string, unknown>
          }
        } catch {
          // Preserve the usable take even if its optional context was corrupt.
        }
        await takeRepo.update(take.id, {
          title: nextTitle,
          contextJson: JSON.stringify({
            ...context,
            threadTitle: nextTitle,
            prompt: nextTitle,
          }),
        })
      }
    })
    return true
  } catch {
    return false
  }
}

export async function deleteVoiceTake(takeId: string): Promise<boolean> {
  try {
    const db = await getDb()
    await localTransaction(db, async (transactionDb) => {
      // Dependent rows go by their takeId index, never by value: reading an
      // audio row to learn its id copied the whole recording into memory on
      // its way to the bin. One transaction over all three stores, so a
      // failure anywhere leaves nothing half-deleted.
      const local = requireStrictDeletes(transactionDb)
      await local.deleteByIndexStrict('voiceTakeAudio', 'takeId', takeId)
      await local.deleteByIndexStrict('voiceTakeContours', 'takeId', takeId)
      await local.deleteByIdStrict('voiceTakes', takeId)
    })
    return true
  } catch {
    return false
  }
}

/** Delete one complete practice thread while leaving every other take intact. */
export async function deleteVoiceThread(
  comparisonKey: string,
): Promise<boolean> {
  if (comparisonKey === '') return false
  try {
    const db = await getDb()
    await localTransaction(db, async (transactionDb) => {
      const takeRepo =
        transactionDb.getRepository<VoiceTakeRecord>('voiceTakes')
      const local = requireStrictDeletes(transactionDb)
      // The take rows are small; their dependants are deleted by index.
      const takes = await takeRepo.findAll({
        where: { comparisonKey },
        throwOnError: true,
      })
      if (takes.length === 0) throw new Error('Voice thread not found')
      for (const take of takes) {
        await local.deleteByIndexStrict('voiceTakeAudio', 'takeId', take.id)
        await local.deleteByIndexStrict('voiceTakeContours', 'takeId', take.id)
        await local.deleteByIdStrict('voiceTakes', take.id)
      }
    })
    return true
  } catch {
    return false
  }
}

export async function wipeVoiceTakes(): Promise<boolean> {
  try {
    const db = await getDb()
    await localTransaction(db, async (transactionDb) => {
      // Whole stores, cleared by key: the wipe used to load the entire audio
      // library into memory to iterate its ids. Sequential, inside the one
      // transaction, so a failure rolls all three back.
      const local = requireStrictDeletes(transactionDb)
      await local.clearStrict('voiceTakeAudio')
      await local.clearStrict('voiceTakeContours')
      await local.clearStrict('voiceTakes')
    })
    return true
  } catch {
    return false
  }
}

export async function getVoiceStorageSnapshot(): Promise<VoiceStorageSnapshot> {
  const takes = await listVoiceTakes()
  let browserUsage: number | null = null
  let browserQuota: number | null = null
  let persistent: boolean | null = null
  try {
    const estimate = await navigator.storage?.estimate?.()
    browserUsage = estimate?.usage ?? null
    browserQuota = estimate?.quota ?? null
    persistent =
      navigator.storage?.persisted === undefined
        ? null
        : await navigator.storage.persisted()
  } catch {
    // The app's own byte count remains useful without StorageManager.
  }
  return {
    takeCount: takes.length,
    voiceBytes: takes.reduce(
      (total, take) => total + take.sizeBytes + (take.contourBytes ?? 0),
      0,
    ),
    browserUsage,
    browserQuota,
    persistent,
  }
}
