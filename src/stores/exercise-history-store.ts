// ============================================================
// Exercise History Store — completed-run log and per-exercise stats
// ============================================================
//
// `recordExerciseResult` is the single funnel every exercise calls on finish,
// and it fans out well beyond local history: challenge and weekly attempts,
// routine auto-advance, survey completions, and the sessionRecords write
// (which itself credits practice minutes) all hang off it. Adding a new
// exercise means calling this once, not wiring each consumer -- and calling
// it twice double-counts practice credit.

import { checkAndGrantBadges } from '@/db/services/badge-grant-engine'
import { saveSessionRecord } from '@/db/services/session-service'
import { recordChallengeAttempt } from '@/features/challenges/challenge-attempt'
import { recordWeeklyAttempt } from '@/features/challenges/weekly-attempt'
import type { ExerciseType } from '@/features/exercises/types'
import type { ExerciseVoiceCaptureOutcome } from '@/features/exercises/use-base-exercise'
import { exerciseLabel } from '@/features/routines/segment-labels'
import { autoAdvanceRoutineSegment } from '@/features/routines/use-daily-routine'
import { createPersistedSignal } from '@/lib/storage'
import { recordCompletion } from './usage-store'

const STORAGE_KEY = 'mercurypitch_exercise_history'

export interface ExerciseHistoryEntry {
  type: ExerciseType
  score: number
  metrics: Record<string, number>
  completedAt: number
}

export interface ExerciseStats {
  bestScore: number
  totalPlays: number
  lastScore: number
  lastPlayedAt: number
  avgScore: number
}

export interface ExerciseResultRecordOptions {
  /** Present only when a Weekly Legend run hands off its temporary replay. */
  weeklyVoiceCapture?: ExerciseVoiceCaptureOutcome
}

const [history, setHistory] = createPersistedSignal<ExerciseHistoryEntry[]>(
  STORAGE_KEY,
  [],
)

export function exerciseHistory(): ExerciseHistoryEntry[] {
  return history()
}

export function recordExerciseResult(
  entry: ExerciseHistoryEntry,
  options?: ExerciseResultRecordOptions,
): void {
  setHistory((prev) => {
    const next = [entry, ...prev]
    return next.slice(0, 100) // keep last 100 entries
  })

  // Auto-advance daily routine if this exercise matches the current segment
  autoAdvanceRoutineSegment(entry.type, entry.metrics)
  // session_complete fires in saveSessionRecord — every branch below funnels
  // into it exactly once, so firing here too would double the funnel metric.
  // recordCompletion counts a FINISHED run for the survey gate (and counts
  // as activity too, so recordActivity is folded in).
  recordCompletion()

  // Persisting the run is async and order-dependent: a run launched from a
  // challenge or weekly is recorded by that path (with source 'challenge' /
  // 'weekly'), and must NOT also be written as a plain exercise — that would
  // double it on the leaderboard and double-credit practice minutes. So ask
  // those paths first, and only write a 'source: exercise' record when
  // neither claimed the run. Each path credits practice minutes exactly once
  // via saveSessionRecord; there is no separate addScoredMs here anymore.
  void (async () => {
    // Call both unconditionally (not short-circuited): a mismatched-type run
    // is how each path learns the user moved on and disarms itself.
    const consumedChallenge = await recordChallengeAttempt({
      type: entry.type,
      score: entry.score,
    })
    const consumedWeekly = await recordWeeklyAttempt({
      type: entry.type,
      score: entry.score,
      voiceCapture: options?.weeklyVoiceCapture,
    })
    if (consumedChallenge || consumedWeekly) return

    const runMs = entry.metrics.durationMs ?? entry.metrics.elapsedMs
    await saveSessionRecord({
      melodyName: `Exercise: ${exerciseLabel(entry.type)}`,
      score: entry.score,
      accuracy: entry.score,
      notesHit: 0,
      notesTotal: 0,
      durationMs: runMs !== undefined && runMs > 0 ? runMs : undefined,
      source: 'exercise',
    })
    // The other three surfaces — session, challenge, weekly — each run the
    // grant pass after saving. This one never did, so drills earned nothing
    // until some OTHER surface happened to trigger a pass, at which point
    // everything they had earned unlocked in one heap. Half the goals count
    // drills (Drill Sergeant, Drill Habit, Well Rounded, every note and day
    // total), so this was not a small gap.
    await checkAndGrantBadges()
  })()
}

export function getExerciseStats(type: ExerciseType): ExerciseStats {
  const entries = history().filter((e) => e.type === type)
  if (entries.length === 0) {
    return {
      bestScore: 0,
      totalPlays: 0,
      lastScore: 0,
      lastPlayedAt: 0,
      avgScore: 0,
    }
  }
  const scores = entries.map((e) => e.score)
  return {
    bestScore: Math.max(...scores),
    totalPlays: entries.length,
    lastScore: entries[0].score,
    lastPlayedAt: entries[0].completedAt,
    avgScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
  }
}

export function clearExerciseHistory(): void {
  setHistory([])
}
