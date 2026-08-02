// ============================================================
// Practice activity — one source for "did I practise that day"
// ============================================================
//
// Four things count as practice, and all four write a SessionRecord:
//
//   source: 'practice'   session mode (practice-session-store)
//   source: 'exercise'   the drills      (exercise-history-store)
//   source: 'challenge'  challenges      (challenge-attempt)
//   source: 'weekly'     Sing the Legend (weekly-attempt)
//
// The activity calendar and heatmap were reading `sessionResults` — a
// local signal that ONLY session mode appends to. So a singer could do
// exercises and challenges every day and the tracker stayed blank, which
// is exactly what it did. Worse, session mode itself only appends when a
// run produced a scored item, so even the one wired source could come up
// empty.
//
// Reading the records is the fix: it is the table every producer already
// writes, so nothing has to be remembered at four call sites.

import { createResource } from 'solid-js'
import type { SessionRecord, SessionSource } from '@/db/entities'
import { loadSessionRecords, sessionRecordVersion, } from '@/db/services/session-service'
import { authVersion } from '@/db/services/user-service'

/** How far back the calendar can ask about. 13 weeks of a few runs a day. */
const HISTORY_LIMIT = 500

/** A day, in the local timezone — not UTC. */
export function localDayKey(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  // toISOString() would bucket a 23:30 run into tomorrow for anyone east
  // of UTC, and yesterday's late practice into the wrong square.
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export interface DayActivity {
  count: number
  bestScore: number
  sources: Set<SessionSource>
}

/** Runs per local day, with what they were and how they went. */
export function activityByDay(
  records: readonly SessionRecord[],
): Map<string, DayActivity> {
  const map = new Map<string, DayActivity>()
  for (const r of records) {
    const key = localDayKey(r.endedAt ?? r.startedAt)
    if (key === '') continue
    const day = map.get(key) ?? {
      count: 0,
      bestScore: 0,
      sources: new Set<SessionSource>(),
    }
    day.count += 1
    day.bestScore = Math.max(day.bestScore, r.score ?? 0)
    // Rows written before `source` existed are free practice by definition.
    day.sources.add(r.source ?? 'practice')
    map.set(key, day)
  }
  return map
}

/** Human summary for a calendar cell's tooltip. */
export function describeDay(day: DayActivity | undefined): string {
  if (day === undefined || day.count === 0) return 'No practice'
  const LABELS: Record<SessionSource, string> = {
    practice: 'session',
    exercise: 'exercise',
    challenge: 'challenge',
    weekly: 'weekly challenge',
  }
  const kinds = [...day.sources].map((s) => LABELS[s] ?? s).sort()
  const runs = `${day.count} run${day.count === 1 ? '' : 's'}`
  return `${runs} (${kinds.join(', ')}) — best ${day.bestScore}%`
}

/**
 * Every practice record for the signed-in singer.
 *
 * Keyed on authVersion so switching account reloads, and on
 * sessionRecordVersion so finishing anything refreshes the calendar
 * without a reload.
 */
export function usePracticeActivity(): () => Map<string, DayActivity> {
  const [records] = createResource(
    () => [authVersion(), sessionRecordVersion()] as const,
    async () => await loadSessionRecords(HISTORY_LIMIT),
  )
  return () => activityByDay(records() ?? [])
}
