// ============================================================
// Session Service — DB-backed session record operations
// ============================================================

import { getDb } from '@/db'
import type { SessionRecord } from '@/db/entities'
import { getUserId } from '@/db/seed'
import { addScoredMs, NOMINAL_RUN_MS } from '@/db/services/practice-minutes'
import { trackEvent } from '@/lib/analytics'

export async function saveSessionRecord(data: {
  melodyName: string
  score: number
  notesHit: number
  notesTotal: number
  accuracy: number
  /** Real practice duration if known; else estimated from note count. */
  durationMs?: number
  /** Tags the attempt to a weekly "Sing the Legend" challenge (board ranking). */
  weeklyChallengeId?: string
}): Promise<SessionRecord | null> {
  try {
    const db = await getDb()
    const repo = db.getRepository<SessionRecord>('sessionRecords')
    const now = new Date().toISOString()
    // Credit practice minutes toward today's daily goal; the accumulator bumps
    // the streak once the goal is met and returns the current streak value.
    const creditMs =
      data.durationMs ?? Math.max(NOMINAL_RUN_MS, data.notesTotal * 2500)
    const streak = await addScoredMs(creditMs)
    trackEvent('session_complete')
    return await repo.create({
      userId: getUserId(),
      melodyName: data.melodyName,
      startedAt: now,
      endedAt: now,
      score: data.score,
      accuracy: data.accuracy,
      notesHit: data.notesHit,
      notesTotal: data.notesTotal,
      streak,
      ...(data.weeklyChallengeId !== undefined
        ? { weeklyChallengeId: data.weeklyChallengeId }
        : {}),
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
    return await repo.findAll({
      where: { userId: getUserId() },
      orderBy: 'endedAt',
      orderDir: 'desc',
      limit,
    })
  } catch {
    return []
  }
}
