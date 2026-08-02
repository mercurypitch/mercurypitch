// ============================================================
// Voice Take Service — explicit, durable, local real-voice history
// ============================================================

import { ensurePersistentStorage, getDb } from '@/db'
import type { DurableWriteResult } from '@/db/durable-write'
import { durableWrite, hasRoomFor } from '@/db/durable-write'
import type { VoiceTakeAudioRecord, VoiceTakeRecord, VoiceTakeSource, } from '@/db/entities'
import type { DatabaseAdapter } from '@/db/types'

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
  const roomAvailable = await hasRoomFor(draft.blob.size)
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
        roomId: draft.roomId,
      })
      await audioRepo.create({
        takeId: created.id,
        mimeType: created.mimeType,
        size: draft.blob.size,
        data: bytes,
      })
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
  })
}

export async function getVoiceTakeBlob(takeId: string): Promise<Blob | null> {
  const db = await getDb()
  const rows = await db
    .getRepository<VoiceTakeAudioRecord>('voiceTakeAudio')
    .findAll({ where: { takeId }, limit: 1 })
  const row = rows[0]
  return row === undefined ? null : new Blob([row.data], { type: row.mimeType })
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
      const takes = await takeRepo.findAll({ where: { comparisonKey } })
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
      const audioRepo =
        transactionDb.getRepository<VoiceTakeAudioRecord>('voiceTakeAudio')
      const rows = await audioRepo.findAll({ where: { takeId } })
      for (const row of rows) await audioRepo.delete(row.id)
      await transactionDb
        .getRepository<VoiceTakeRecord>('voiceTakes')
        .delete(takeId)
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
      const takeRepo =
        transactionDb.getRepository<VoiceTakeRecord>('voiceTakes')
      const audioRepo =
        transactionDb.getRepository<VoiceTakeAudioRecord>('voiceTakeAudio')
      const [takes, audioRows] = await Promise.all([
        takeRepo.findAll(),
        audioRepo.findAll(),
      ])
      for (const row of audioRows) await audioRepo.delete(row.id)
      for (const take of takes) await takeRepo.delete(take.id)
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
    voiceBytes: takes.reduce((total, take) => total + take.sizeBytes, 0),
    browserUsage,
    browserQuota,
    persistent,
  }
}
