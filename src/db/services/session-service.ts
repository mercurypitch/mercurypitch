// ============================================================
// Session Service — DB-backed session record operations
// ============================================================

import { createSignal } from 'solid-js'
import { getDb } from '@/db'
import type { PracticeResultRecord, SessionRecord, SessionSource, } from '@/db/entities'
import { addScoredMs, NOMINAL_RUN_MS } from '@/db/services/practice-minutes'
import { getCurrentStreak } from '@/db/services/streak-service'
import { getAuthHeaders, getUserId } from '@/db/services/user-service'
import { trackEvent } from '@/lib/analytics'
import { API_BASE_URL } from '@/lib/defaults'

/**
 * Bumped whenever a session record lands. Every producer — session mode,
 * exercises, challenges, the weekly attempt — funnels through
 * saveSessionRecord, so anything keyed on this refreshes for all four
 * without each caller having to remember to say so.
 */
const [sessionRecordVersion, bumpSessionRecordVersion] = createSignal(0)
export { sessionRecordVersion }

const MAX_MEASURED_SESSION_MS = 86_400_000

export async function saveSessionRecord(
  data: {
    melodyId?: string
    melodyName: string
    score: number
    notesHit: number
    notesTotal: number
    accuracy: number
    /** Real practice duration if known; else estimated from note count. */
    durationMs?: number
    /** Tags the attempt to a weekly "Sing the Legend" challenge (board ranking). */
    weeklyChallengeId?: string
    /**
     * What kind of attempt this was. Only fixed tasks are publicly ranked
     * (see leaderboardConfig.eligibleSources) — free practice is personal,
     * because scores across self-chosen melodies aren't comparable.
     * Defaults to 'practice' so an un-tagged caller is never published.
     */
    source?: SessionSource
    instrument?: 'voice' | 'piano' | 'guitar'
    startedAt?: string
    endedAt?: string
    sourceRef?: string
    sourceVersion?: number
    comparabilityKey?: string
    avgCents?: number
    rating?: string
    results?: PracticeResultRecord[]
  },
  expectedUserId = getUserId(),
): Promise<SessionRecord | null> {
  const ownerId = expectedUserId
  try {
    if (getUserId() !== ownerId) return null
    const db = await getDb()
    if (getUserId() !== ownerId) return null
    const repo = db.getRepository<SessionRecord>('sessionRecords')
    const now = new Date().toISOString()
    const endedAt = validIso(data.endedAt) ?? now
    const measuredDurationMs =
      data.durationMs !== undefined &&
      Number.isFinite(data.durationMs) &&
      data.durationMs > 0 &&
      data.durationMs <= MAX_MEASURED_SESSION_MS
        ? Math.round(data.durationMs)
        : undefined
    const startedAt =
      validIso(data.startedAt) ??
      (measuredDurationMs === undefined
        ? endedAt
        : new Date(Date.parse(endedAt) - measuredDurationMs).toISOString())
    const streakBefore = await getCurrentStreak(ownerId)
    if (getUserId() !== ownerId) return null

    // Persist the evidence before mutating the device's practice accumulator.
    // A failed create must not advance minutes or streak, because retrying it
    // would otherwise credit one finished run twice without a session row.
    let record = await repo.create({
      userId: ownerId,
      ...(data.melodyId !== undefined ? { melodyId: data.melodyId } : {}),
      melodyName: data.melodyName,
      startedAt,
      endedAt,
      score: data.score,
      accuracy: data.accuracy,
      notesHit: data.notesHit,
      notesTotal: data.notesTotal,
      streak: streakBefore,
      source: data.source ?? 'practice',
      instrument: data.instrument ?? 'voice',
      ...(measuredDurationMs !== undefined
        ? { durationMs: measuredDurationMs }
        : {}),
      ...(data.sourceRef !== undefined ? { sourceRef: data.sourceRef } : {}),
      ...(data.sourceVersion !== undefined
        ? { sourceVersion: data.sourceVersion }
        : {}),
      ...(data.comparabilityKey !== undefined
        ? { comparabilityKey: data.comparabilityKey }
        : {}),
      ...(data.avgCents !== undefined ? { avgCents: data.avgCents } : {}),
      ...(data.rating !== undefined ? { rating: data.rating } : {}),
      ...(data.weeklyChallengeId !== undefined
        ? { weeklyChallengeId: data.weeklyChallengeId }
        : {}),
      results: data.results ?? [],
    })
    if (getUserId() !== ownerId) return null

    // Credit practice minutes toward today's daily goal only after the record
    // exists. If the non-critical credit/update path is unavailable, keep the
    // saved session rather than pretending the entire practice was lost.
    const creditMs =
      measuredDurationMs ?? Math.max(NOMINAL_RUN_MS, data.notesTotal * 2500)
    let streak = streakBefore
    try {
      streak = Math.max(streakBefore, await addScoredMs(creditMs, ownerId))
      if (getUserId() !== ownerId) return null
      if (streak !== record.streak) {
        try {
          record = await repo.update(record.id, { streak })
        } catch {
          // The authoritative practice row already exists. A stale streak
          // snapshot on that row is safer than discarding or duplicating it.
        }
      }
    } catch {
      // The session itself is still valid evidence even when streak credit is
      // temporarily unavailable.
    }
    if (getUserId() !== ownerId) return null
    trackEvent('session_complete')
    bumpSessionRecordVersion((v) => v + 1)
    return record
  } catch {
    return null
  }
}

function validIso(value: string | undefined): string | null {
  if (value === undefined || !Number.isFinite(Date.parse(value))) return null
  return new Date(value).toISOString()
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

/**
 * Fetch the heavy note-by-note analytics JSON for a session from the cloud (R2).
 * These are stripped from the D1 sessionRecords row to save bandwidth, so they
 * must be fetched explicitly when needed (e.g. restoring history on a new device).
 */
export async function loadSessionAnalytics(
  sessionId: string,
): Promise<PracticeResultRecord[] | null> {
  const headers = getAuthHeaders()
  if (headers.Authorization == null || headers.Authorization === '') return null
  if (API_BASE_URL == null || API_BASE_URL === '') return null
  try {
    const res = await fetch(
      `${API_BASE_URL}/api/sessionRecords/${sessionId}/analytics`,
      {
        headers,
      },
    )
    if (!res.ok) return null
    return (await res.json()) as PracticeResultRecord[]
  } catch {
    return null
  }
}

export interface ProgressSessionRecords {
  records: SessionRecord[]
  /** False only when the audited repository read itself failed. */
  available: boolean
  /** False when the safety ceiling was reached before the repository count. */
  complete: boolean
  totalAvailable: number | null
}

/**
 * Load a bounded, paginated Progress history without calling a truncated page
 * "all time". The caller receives completeness explicitly and can label the
 * coverage honestly when the safety ceiling is reached.
 */
export async function loadProgressSessionRecords(
  options: {
    pageSize?: number
    maxRecords?: number
  } = {},
): Promise<ProgressSessionRecords> {
  const pageSize = Math.min(1000, Math.max(1, options.pageSize ?? 500))
  const maxRecords = Math.max(pageSize, options.maxRecords ?? 5000)
  const ownerId = getUserId()

  try {
    const db = await getDb()
    if (getUserId() !== ownerId) throw new Error('identity changed')
    const repo = db.getRepository<SessionRecord>('sessionRecords')
    const where = { userId: ownerId }
    const initialTotal = await repo.count({ where, throwOnError: true })
    const records: SessionRecord[] = []
    const seen = new Set<string>()
    const target = Math.min(initialTotal, maxRecords)
    let offset = 0

    while (offset < target) {
      const requested = Math.min(pageSize, target - offset)
      const page = await repo.findAll({
        where,
        orderBy: 'endedAt',
        orderDir: 'desc',
        limit: requested,
        offset,
        throwOnError: true,
      })
      if (getUserId() !== ownerId) throw new Error('identity changed')
      if (page.length === 0) break
      offset += page.length
      for (const record of page) {
        if (seen.has(record.id)) continue
        seen.add(record.id)
        records.push(record)
      }
      if (page.length < requested) break
    }

    records.sort((a, b) => {
      const ended = b.endedAt.localeCompare(a.endedAt)
      return ended !== 0 ? ended : b.id.localeCompare(a.id)
    })
    const finalTotal = await repo.count({ where, throwOnError: true })
    if (getUserId() !== ownerId) throw new Error('identity changed')
    const stableRead =
      initialTotal === finalTotal && records.length === initialTotal
    const totalAvailable = finalTotal >= records.length ? finalTotal : null

    return {
      records,
      available: true,
      complete: initialTotal <= maxRecords && stableRead,
      totalAvailable,
    }
  } catch {
    return {
      records: [],
      available: false,
      complete: false,
      totalAvailable: null,
    }
  }
}
