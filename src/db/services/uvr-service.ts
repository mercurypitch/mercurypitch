// ============================================================
// UVR Service — DB-backed UVR session & stem blob operations
// ============================================================

import type { UvrSessionRecord, UvrStemBlob } from '@/db/entities'
import { getDb } from '@/db'
import { getUserId } from '@/db/seed'

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
      mimeType: blob.type || (fileName.endsWith('.mp3') ? 'audio/mpeg' : 'audio/wav'),
      data,
      size: blob.size,
      fileName,
    })
    console.log(`[UVR] saveStemBlob OK: sessionId=${sessionId} stemType=${stemType} size=${blob.size} id=${created.id}`)
    return created.id
  } catch (err) {
    console.error('[UVR] saveStemBlob ERROR:', err)
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
      where: { sessionId, stemType } as Record<string, unknown>,
      orderBy: 'createdAt',
      orderDir: 'desc',
      limit: 1,
    })
    console.log(`[UVR] getStemBlobUrl sessionId=${sessionId} stemType=${stemType} found=${results.length}`)
    if (results.length === 0) return null
    const entry = results[0]
    console.log(`[UVR] getStemBlobUrl entry:`, {
      id: entry.id,
      sessionId: entry.sessionId,
      stemType: entry.stemType,
      mimeType: entry.mimeType,
      size: entry.size,
      dataBytes: entry.data?.byteLength,
    })
    const blob = new Blob([entry.data], { type: entry.mimeType })
    const url = URL.createObjectURL(blob)
    console.log(`[UVR] getStemBlobUrl created blob URL: ${url.substring(0, 50)}...`)
    return url
  } catch (err) {
    console.error(`[UVR] getStemBlobUrl ERROR:`, err)
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
      where: { sessionId, stemType: 'original' } as Record<string, unknown>,
      orderBy: 'createdAt',
      orderDir: 'desc',
      limit: 1,
    })
    if (results.length === 0) return null
    const entry = results[0]
    return new File([entry.data], entry.fileName, { type: entry.mimeType })
  } catch {
    return null
  }
}

export async function hydrateStemUrls(
  sessionId: string,
): Promise<{ vocal?: string; instrumental?: string } | null> {
  console.log(`[UVR] hydrateStemUrls called for sessionId=${sessionId}`)
  try {
    const [vocalUrl, instrUrl] = await Promise.all([
      getStemBlobUrl(sessionId, 'vocal'),
      getStemBlobUrl(sessionId, 'instrumental'),
    ])
    console.log(`[UVR] hydrateStemUrls results: vocal=${vocalUrl?.substring(0, 40)} instr=${instrUrl?.substring(0, 40)}`)
    if (vocalUrl === null && instrUrl === null) {
      console.warn('[UVR] hydrateStemUrls: no stems found in IndexedDB for', sessionId)
      return null
    }
    const result: { vocal?: string; instrumental?: string } = {}
    if (vocalUrl !== null) result.vocal = vocalUrl
    if (instrUrl !== null) result.instrumental = instrUrl
    return result
  } catch (err) {
    console.error('[UVR] hydrateStemUrls ERROR:', err)
    return null
  }
}

// ── Session Record Operations ────────────────────────────────────

export async function saveUvrSession(
  session: {
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
  },
): Promise<string | null> {
  try {
    const db = await getDb()
    const repo = db.getRepository<UvrSessionRecord>('uvrSessions')

    // Upsert: delete existing record for this session if present
    const existing = await repo.findAll({
      where: { appSessionId: session.sessionId } as Record<string, unknown>,
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
  } catch {
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
      where: { fileHash } as Record<string, unknown>,
      limit: 1,
    })
    if (results.length === 0) return null
    return { sessionId: results[0].appSessionId }
  } catch {
    return null
  }
}

export async function deleteUvrSessionFromDb(sessionId: string): Promise<void> {
  try {
    const db = await getDb()

    // Delete associated stem blobs
    const blobRepo = db.getRepository<UvrStemBlob>('uvrStemBlobs')
    const blobs = await blobRepo.findAll({
      where: { sessionId } as Record<string, unknown>,
    })
    for (const blob of blobs) {
      // Revoke any active blob URLs created from this data
      await blobRepo.delete(blob.id)
    }

    // Delete session record
    const repo = db.getRepository<UvrSessionRecord>('uvrSessions')
    const existing = await repo.findAll({
      where: { appSessionId: sessionId } as Record<string, unknown>,
      limit: 1,
    })
    for (const rec of existing) {
      await repo.delete(rec.id)
    }
  } catch {
    // Best-effort cleanup
  }
}
