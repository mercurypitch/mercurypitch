// ============================================================
// UVR Service — DB-backed UVR session & stem blob operations
// ============================================================

import { getDb } from '@/db'
import type { DurableWriteResult } from '@/db/durable-write'
import { durableWrite } from '@/db/durable-write'
import type { SessionGroupRecord, UvrSessionLyrics, UvrSessionRecord, UvrStemBlob, UvrStemFingerprint, } from '@/db/entities'
import { getUserId } from '@/db/seed'
import type { DatabaseAdapter } from '@/db/types'
import { IS_DEV } from '@/lib/defaults'

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

// ── Stem Blob Operations ─────────────────────────────────────────

/** Raw write — throws on failure. Callers pick the wrapper that fits:
 *  saveStemBlob (never throws) for non-critical paths, or saveStemBlobDurable
 *  (retries + reports) for the paid stem/original data that must not be lost. */
async function writeStemBlob(
  sessionId: string,
  stemType: 'vocal' | 'instrumental' | 'original',
  blob: Blob,
  fileName: string,
): Promise<string> {
  const db = await getDb()
  const repo = db.getRepository<UvrStemBlob>('uvrStemBlobs')
  const data = await blob.arrayBuffer()
  const created = await repo.create({
    sessionId,
    stemType,
    mimeType:
      blob.type || (fileName.endsWith('.mp3') ? 'audio/mpeg' : 'audio/wav'),
    data,
    size: blob.size,
    fileName,
  })
  return created.id
}

/** Best-effort save — logs and returns null on failure (never throws). */
export async function saveStemBlob(
  sessionId: string,
  stemType: 'vocal' | 'instrumental' | 'original',
  blob: Blob,
  fileName: string,
): Promise<string | null> {
  try {
    return await writeStemBlob(sessionId, stemType, blob, fileName)
  } catch (err) {
    // console.error (not dev-gated): a lost stem is a real, paid-for defect.
    console.error('[UvrService] saveStemBlob failed:', stemType, err)
    return null
  }
}

/** Durable save — awaited, retried once, returns a result the caller must act
 *  on (surface an error, fail the session) rather than silently losing audio. */
export function saveStemBlobDurable(
  sessionId: string,
  stemType: 'vocal' | 'instrumental' | 'original',
  blob: Blob,
  fileName: string,
): Promise<DurableWriteResult<string>> {
  return durableWrite(`save ${stemType} stem`, () =>
    writeStemBlob(sessionId, stemType, blob, fileName),
  )
}

/** How many stem blobs exist for a session — used to reconcile a session whose
 *  completion persist may have failed, and to prune orphaned "completed" rows. */
export async function countStemBlobs(sessionId: string): Promise<number> {
  try {
    const db = await getDb()
    const repo = db.getRepository<UvrStemBlob>('uvrStemBlobs')
    const blobs = await repo.findAll({ where: { sessionId } })
    return blobs.length
  } catch (err) {
    if (IS_DEV) console.warn('[UvrService] countStemBlobs failed:', err)
    return 0
  }
}

/** Whether a session has at least one playable stem (vocal or instrumental)
 *  persisted locally. The original blob alone doesn't make a session openable. */
export async function sessionHasPlayableStems(
  sessionId: string,
): Promise<boolean> {
  try {
    const db = await getDb()
    const repo = db.getRepository<UvrStemBlob>('uvrStemBlobs')
    const blobs = await repo.findAll({ where: { sessionId } })
    return blobs.some(
      (b) => b.stemType === 'vocal' || b.stemType === 'instrumental',
    )
  } catch (err) {
    if (IS_DEV)
      console.warn('[UvrService] sessionHasPlayableStems failed:', err)
    return false
  }
}

export async function getStemBlobUrl(
  sessionId: string,
  stemType: 'vocal' | 'instrumental' | 'original',
): Promise<string | null> {
  try {
    const db = await getDb()
    const repo = db.getRepository<UvrStemBlob>('uvrStemBlobs')
    const results = await repo.findAll({
      where: { sessionId, stemType },
      orderBy: 'createdAt',
      orderDir: 'desc',
      limit: 1,
    })
    if (results.length === 0) return null
    const entry = results[0]
    const blob = new Blob([entry.data], { type: entry.mimeType })
    return URL.createObjectURL(blob)
  } catch (err) {
    if (IS_DEV) console.warn('[UvrService] getStemBlobUrl failed:', err)
    return null
  }
}

/** Delete all stored blobs for a session's stem (used when replacing a stem). */
export async function deleteStemBlobs(
  sessionId: string,
  stemType: 'vocal' | 'instrumental' | 'original',
): Promise<void> {
  try {
    const db = await getDb()
    const repo = db.getRepository<UvrStemBlob>('uvrStemBlobs')
    const rows = await repo.findAll({ where: { sessionId, stemType } })
    for (const row of rows) await repo.delete(row.id)
  } catch (err) {
    if (IS_DEV) console.warn('[UvrService] deleteStemBlobs failed:', err)
  }
}

export async function getStemBlob(
  sessionId: string,
  stemType: 'vocal' | 'instrumental' | 'original',
): Promise<Blob | null> {
  try {
    const db = await getDb()
    const repo = db.getRepository<UvrStemBlob>('uvrStemBlobs')
    const results = await repo.findAll({
      where: { sessionId, stemType } as Record<string, unknown>,
      orderBy: 'createdAt',
      orderDir: 'desc',
      limit: 1,
    })
    if (results.length === 0) return null
    const entry = results[0]
    return new Blob([entry.data], { type: entry.mimeType })
  } catch (err) {
    if (IS_DEV) console.warn('[UvrService] getStemBlob failed:', err)
    return null
  }
}

export async function getOriginalFileBlob(
  sessionId: string,
): Promise<File | null> {
  try {
    const db = await getDb()
    const repo = db.getRepository<UvrStemBlob>('uvrStemBlobs')

    const results = await repo.findAll({
      where: { sessionId, stemType: 'original' },
      orderBy: 'createdAt',
      orderDir: 'desc',
      limit: 1,
    })
    if (results.length === 0) return null
    const entry = results[0]
    return new File([entry.data], entry.fileName, { type: entry.mimeType })
  } catch (err) {
    if (IS_DEV) console.warn('[UvrService] getOriginalFileBlob failed:', err)
    return null
  }
}

export async function hydrateStemUrls(
  sessionId: string,
): Promise<{ vocal?: string; instrumental?: string } | null> {
  try {
    const [vocalUrl, instrUrl] = await Promise.all([
      getStemBlobUrl(sessionId, 'vocal'),
      getStemBlobUrl(sessionId, 'instrumental'),
    ])
    if (vocalUrl === null && instrUrl === null) {
      return null
    }
    const result: { vocal?: string; instrumental?: string } = {}
    if (vocalUrl !== null) result.vocal = vocalUrl
    if (instrUrl !== null) result.instrumental = instrUrl
    return result
  } catch (err) {
    if (IS_DEV) console.warn('[UvrService] hydrateStemUrls failed:', err)
    return null
  }
}

// ── Stem Fingerprint Operations ─────────────────────────────────

import type { MelodyFingerprint } from '@/lib/shazam/types'

export async function saveStemFingerprintData(
  sessionId: string,
  fingerprint: MelodyFingerprint,
): Promise<boolean> {
  try {
    const db = await getDb()
    const repo = db.getRepository<UvrStemFingerprint>('uvrStemFingerprints')

    // Upsert as create-then-delete: write the new row first, and only prune the
    // old ones once it succeeds. Delete-then-create would wipe the existing
    // fingerprint if the create threw (quota, lock), losing recoverable data.
    const existing = await repo.findAll({ where: { sessionId } })
    const created = await repo.create({
      sessionId,
      fingerprintJson: JSON.stringify(fingerprint),
    })
    for (const entry of existing) {
      if (entry.id !== created.id) await repo.delete(entry.id)
    }
    return true
  } catch (err) {
    if (IS_DEV)
      console.warn('[UvrService] saveStemFingerprintData failed:', err)
    return false
  }
}

export async function getStemFingerprintData(
  sessionId: string,
): Promise<MelodyFingerprint | null> {
  try {
    const db = await getDb()
    const repo = db.getRepository<UvrStemFingerprint>('uvrStemFingerprints')
    const results = await repo.findAll({
      where: { sessionId },
      orderBy: 'createdAt',
      orderDir: 'desc',
      limit: 1,
    })
    if (results.length === 0) return null
    return JSON.parse(results[0].fingerprintJson) as MelodyFingerprint
  } catch (err) {
    if (IS_DEV) console.warn('[UvrService] getStemFingerprintData failed:', err)
    return null
  }
}

export async function getAllStemFingerprintData(): Promise<
  MelodyFingerprint[]
> {
  try {
    const db = await getDb()
    const repo = db.getRepository<UvrStemFingerprint>('uvrStemFingerprints')
    const results = await repo.findAll({})
    return results.map((entry) =>
      JSON.parse(entry.fingerprintJson),
    ) as MelodyFingerprint[]
  } catch (err) {
    if (IS_DEV)
      console.warn('[UvrService] getAllStemFingerprintData failed:', err)
    return []
  }
}

export async function deleteStemFingerprintData(
  sessionId: string,
): Promise<void> {
  try {
    const db = await getDb()
    const repo = db.getRepository<UvrStemFingerprint>('uvrStemFingerprints')
    const existing = await repo.findAll({
      where: { sessionId },
    })
    for (const entry of existing) {
      await repo.delete(entry.id)
    }
  } catch (err) {
    if (IS_DEV)
      console.warn('[UvrService] deleteStemFingerprintData failed:', err)
  }
}

// ── Session Record Operations ────────────────────────────────────

export async function saveUvrSession(session: {
  sessionId: string
  status: string
  progress: number
  originalFileName: string
  originalFileSize: number
  originalFileType: string
  processingMode: string
  provider?: string
  numChunks?: number
  processingTime?: number
  error?: string
  fileHash?: string
  vocalStemId?: string
  instrumentalStemId?: string
  originalFileBlobId?: string
}): Promise<string | null> {
  try {
    const db = await getDb()
    const repo = db.getRepository<UvrSessionRecord>('uvrSessions')

    // Upsert: delete existing record for this session if present
    const existing = await repo.findAll({
      where: { appSessionId: session.sessionId },
      limit: 1,
    })
    if (existing.length > 0) {
      await repo.delete(existing[0].id)
    }

    const created = await repo.create({
      appSessionId: session.sessionId,
      userId: getUserId(),
      status: session.status,
      progress: session.progress,
      fileHash: session.fileHash,
      originalFileName: session.originalFileName,
      originalFileSize: session.originalFileSize,
      originalFileType: session.originalFileType,
      processingMode: session.processingMode,
      provider: session.provider,
      numChunks: session.numChunks,
      processingTime: session.processingTime,
      error: session.error,
      vocalStemId: session.vocalStemId,
      instrumentalStemId: session.instrumentalStemId,
      originalFileBlobId: session.originalFileBlobId,
    })
    return created.id
  } catch (err) {
    if (IS_DEV) console.warn('[UvrService] saveUvrSession failed:', err)
    return null
  }
}

export async function findSessionByFileHash(
  fileHash: string,
): Promise<{ sessionId: string } | null> {
  try {
    const db = await getDb()
    const repo = db.getRepository<UvrSessionRecord>('uvrSessions')
    const results = await repo.findAll({
      where: { fileHash },
      limit: 1,
    })
    if (results.length === 0) return null
    return { sessionId: results[0].appSessionId }
  } catch (err) {
    if (IS_DEV) console.warn('[UvrService] findSessionByFileHash failed:', err)
    return null
  }
}

export async function deleteUvrSessionFromDb(
  sessionId: string,
): Promise<boolean> {
  try {
    const db = await getDb()

    // Blobs first, then fingerprint, then the session record LAST — so if a
    // step fails the session row still exists and the user can retry the
    // delete, rather than a deleted session leaving orphaned blobs behind.
    const blobRepo = db.getRepository<UvrStemBlob>('uvrStemBlobs')
    const blobs = await blobRepo.findAll({ where: { sessionId } })
    for (const blob of blobs) {
      await blobRepo.delete(blob.id)
    }

    await deleteStemFingerprintData(sessionId)

    const repo = db.getRepository<UvrSessionRecord>('uvrSessions')
    // No limit — remove every record for this appSessionId, in case a
    // concurrent persist ever created a duplicate row.
    const existing = await repo.findAll({ where: { appSessionId: sessionId } })
    for (const rec of existing) {
      await repo.delete(rec.id)
    }
    return true
  } catch (err) {
    console.error('[UvrService] deleteUvrSessionFromDb failed:', err)
    return false
  }
}

/**
 * Delete a session group and, optionally, every canonical member in one local
 * database transaction. Keeping the group record, sessions, blobs,
 * fingerprints, and lyrics in the same boundary prevents a reload from
 * exposing a partially deleted group after a storage failure.
 */
export async function deleteSessionGroupFromDb(
  groupId: string,
  sessionIds: string[],
  deleteSessions: boolean,
): Promise<boolean> {
  try {
    const db = await getDb()
    const deleteRecords = async (
      transactionDb: DatabaseAdapter,
    ): Promise<void> => {
      const groupRepo =
        transactionDb.getRepository<SessionGroupRecord>('sessionGroups')
      const sessionRepo =
        transactionDb.getRepository<UvrSessionRecord>('uvrSessions')

      if (!deleteSessions) {
        const records = await sessionRepo.findAll({
          where: { groupId } as Record<string, unknown>,
        })
        for (const record of records) {
          await sessionRepo.update(record.id, { groupId: undefined })
        }
        await groupRepo.delete(groupId)
        return
      }

      const blobRepo = transactionDb.getRepository<UvrStemBlob>('uvrStemBlobs')
      const fingerprintRepo = transactionDb.getRepository<UvrStemFingerprint>(
        'uvrStemFingerprints',
      )
      const lyricsRepo =
        transactionDb.getRepository<UvrSessionLyrics>('uvrSessionLyrics')

      const canonicalSessionIds = new Set(sessionIds)
      const persistedMembers = await sessionRepo.findAll({
        where: { groupId } as Record<string, unknown>,
      })
      for (const member of persistedMembers) {
        canonicalSessionIds.add(member.appSessionId)
      }

      for (const sessionId of canonicalSessionIds) {
        const blobs = await blobRepo.findAll({ where: { sessionId } })
        for (const blob of blobs) await blobRepo.delete(blob.id)

        const fingerprints = await fingerprintRepo.findAll({
          where: { sessionId },
        })
        for (const fingerprint of fingerprints) {
          await fingerprintRepo.delete(fingerprint.id)
        }

        const lyrics = await lyricsRepo.findAll({ where: { sessionId } })
        for (const entry of lyrics) await lyricsRepo.delete(entry.id)

        const sessions = await sessionRepo.findAll({
          where: { appSessionId: sessionId },
        })
        for (const session of sessions) await sessionRepo.delete(session.id)
      }

      await groupRepo.delete(groupId)
    }

    if (supportsLocalTransactions(db)) {
      await db.transactionLocal(deleteRecords)
    } else {
      await db.transaction(deleteRecords)
    }
    return true
  } catch (err) {
    console.error('[UvrService] deleteSessionGroupFromDb failed:', err)
    return false
  }
}

export async function deleteAllUvrSessionsFromDb(): Promise<void> {
  try {
    const db = await getDb()

    // Delete all stem blobs
    const blobRepo = db.getRepository<UvrStemBlob>('uvrStemBlobs')
    const blobs = await blobRepo.findAll({})
    for (const blob of blobs) {
      await blobRepo.delete(blob.id)
    }

    // Delete all stem fingerprints
    const fpRepo = db.getRepository<UvrStemFingerprint>('uvrStemFingerprints')
    const fpEntries = await fpRepo.findAll({})
    for (const entry of fpEntries) {
      await fpRepo.delete(entry.id)
    }

    // Delete all session records
    const repo = db.getRepository<UvrSessionRecord>('uvrSessions')
    const existing = await repo.findAll({})
    for (const rec of existing) {
      await repo.delete(rec.id)
    }

    // Clear sessionIds from all groups
    const groupRepo = db.getRepository<SessionGroupRecord>('sessionGroups')
    const groups = await groupRepo.findAll({})
    for (const g of groups) {
      await groupRepo.update(g.id, {
        sessionIds: [],
      } as Partial<SessionGroupRecord>)
    }
  } catch (err) {
    if (IS_DEV)
      console.warn('[UvrService] deleteAllUvrSessionsFromDb failed:', err)
  }
}
