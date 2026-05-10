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
    return created.id
  } catch {
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
    if (results.length === 0) return null
    const blob = new Blob([results[0].data], { type: results[0].mimeType })
    return URL.createObjectURL(blob)
  } catch {
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
    if (vocalUrl === null && instrUrl === null) return null
    const result: { vocal?: string; instrumental?: string } = {}
    if (vocalUrl !== null) result.vocal = vocalUrl
    if (instrUrl !== null) result.instrumental = instrUrl
    return result
  } catch {
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
