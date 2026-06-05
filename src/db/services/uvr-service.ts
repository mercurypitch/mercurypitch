// ============================================================
// UVR Service — DB-backed UVR session & stem blob operations
// ============================================================

import { getDb } from '@/db'
import type { SessionGroupRecord, UvrSessionRecord, UvrStemBlob, } from '@/db/entities'
import { getUserId } from '@/db/seed'
import { IS_DEV } from '@/lib/defaults'

// ── Stem Blob Operations ─────────────────────────────────────────

export async function saveStemBlob(
  sessionId: string,
  stemType: 'vocal' | 'instrumental' | 'original',
  blob: Blob,
  fileName: string,
): Promise<string | null> {
  try {
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
  } catch (err) {
    if (IS_DEV) console.warn('[UvrService] saveStemBlob failed:', err)
    return null
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

export async function getStemBlob(
  sessionId: string,
  stemType: 'vocal' | 'instrumental' | 'original',
): Promise<Blob | null> {
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
    return new Blob([entry.data], { type: entry.mimeType })
  } catch {
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

import type { UvrStemFingerprint } from '@/db/entities'
import type { MelodyFingerprint } from '@/lib/shazam/types'

export async function saveStemFingerprintData(
  sessionId: string,
  fingerprint: MelodyFingerprint,
): Promise<boolean> {
  try {
    const db = await getDb()
    const repo = db.getRepository<UvrStemFingerprint>('uvrStemFingerprints')

    // Upsert: delete existing entry for this session
    const existing = await repo.findAll({
      where: { sessionId },
      limit: 1,
    })
    for (const entry of existing) {
      await repo.delete(entry.id)
    }

    await repo.create({
      sessionId,
      fingerprintJson: JSON.stringify(fingerprint),
    })
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

export async function deleteUvrSessionFromDb(sessionId: string): Promise<void> {
  try {
    const db = await getDb()

    // Delete associated stem blobs
    const blobRepo = db.getRepository<UvrStemBlob>('uvrStemBlobs')
    const blobs = await blobRepo.findAll({
      where: { sessionId },
    })
    for (const blob of blobs) {
      await blobRepo.delete(blob.id)
    }

    // Delete stem fingerprint
    await deleteStemFingerprintData(sessionId)

    // Delete session record
    const repo = db.getRepository<UvrSessionRecord>('uvrSessions')
    const existing = await repo.findAll({
      where: { appSessionId: sessionId },
      limit: 1,
    })
    for (const rec of existing) {
      await repo.delete(rec.id)
    }
  } catch (err) {
    if (IS_DEV) console.warn('[UvrService] deleteUvrSessionFromDb failed:', err)
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
