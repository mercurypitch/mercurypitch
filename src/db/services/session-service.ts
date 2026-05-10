// ============================================================
// Session Service — DB-backed session record operations
// ============================================================

import { getDb } from '@/db'
import type { SessionRecord } from '@/db/entities'
import { getUserId } from '@/db/seed'

export async function saveSessionRecord(data: {
  melodyName: string
  score: number
  notesHit: number
  notesTotal: number
  accuracy: number
  streak: number
}): Promise<SessionRecord | null> {
  try {
    const db = await getDb()
    const repo = db.getRepository<SessionRecord>('sessionRecords')
    const now = new Date().toISOString()
    return repo.create({
      userId: getUserId(),
      melodyName: data.melodyName,
      startedAt: now,
      endedAt: now,
      score: data.score,
      accuracy: data.accuracy,
      notesHit: data.notesHit,
      notesTotal: data.notesTotal,
      streak: data.streak,
      results: [],
    })
  } catch {
    return null
  }
}

export async function loadSessionRecords(limit = 50): Promise<SessionRecord[]> {
  try {
    const db = await getDb()
    const repo = db.getRepository<SessionRecord>('sessionRecords')
    return repo.findAll({
      where: { userId: getUserId() } as Record<string, unknown>,
      orderBy: 'endedAt',
      orderDir: 'desc',
      limit,
    })
  } catch {
    return []
  }
}
