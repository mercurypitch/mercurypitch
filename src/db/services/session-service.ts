// ============================================================
// Session Service — DB-backed session record operations
// ============================================================

import { createSignal } from 'solid-js'
import { getDb } from '@/db'
import type { PracticeResultRecord, SessionRecord, SessionSource, } from '@/db/entities'
import { addScoredMs, NOMINAL_RUN_MS } from '@/db/services/practice-minutes'
import { getCurrentStreak } from '@/db/services/streak-service'
import { getUserId } from '@/db/services/user-service'
import { trackEvent } from '@/lib/analytics'
import { firstValueForSession, trackFirstValue } from '@/lib/first-value'
import { showNotification } from '@/stores/notifications-store'

/**
 * One toast per failure, replacing the last: three runs in a row while
 * offline should read as one warning, not a stack of three.
 */
export const SESSION_SAVE_FAILURE_CHANNEL = 'session-save'

export const SESSION_SAVE_FAILURE_MESSAGE =
  'Your run was scored, but it could not be saved to your account. Check your connection and try another run.'

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
    trackFirstValue(firstValueForSession(record.source ?? 'practice'))
    bumpSessionRecordVersion((v) => v + 1)
    return record
  } catch (error) {
    // Signed out (or switched account) while the write was in flight: the
    // record belongs to nobody who is here, and the silent null is right.
    // Anything else is a real loss -- a 429 storm, an offline moment, a 5xx
    // past the adapter's retries -- and for years it wore the same null as
    // "signed out", so the singer learned about it from DevTools or never.
    // Every producer (session, exercises, challenges, the weekly attempt)
    // funnels through here, so one warning covers all four.
    if (getUserId() === ownerId) reportSessionSaveFailure(error)
    return null
  }
}

function reportSessionSaveFailure(error: unknown): void {
  console.warn('[session] the run could not be saved:', error)
  try {
    showNotification(SESSION_SAVE_FAILURE_MESSAGE, 'warning', {
      channel: SESSION_SAVE_FAILURE_CHANNEL,
    })
  } catch {
    // The toast must never turn a lost save into a thrown error.
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

// The bounded Progress read lives in a module of its own, so a page that needs
// only that read (the Voice Mirror's weekly Check-up, counting the practice
// between its two weeks) does not carry the rest of this service with it.
export type { ProgressSessionRecords } from './progress-session-records'
export { loadProgressSessionRecords } from './progress-session-records'
