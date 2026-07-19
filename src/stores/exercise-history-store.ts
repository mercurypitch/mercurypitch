import { addScoredMs, NOMINAL_RUN_MS } from '@/db/services/practice-minutes'
import { recordChallengeAttempt } from '@/features/challenges/challenge-attempt'
import { recordWeeklyAttempt } from '@/features/challenges/weekly-attempt'
import type { ExerciseType } from '@/features/exercises/types'
import { autoAdvanceRoutineSegment } from '@/features/routines/use-daily-routine'
import { trackEvent } from '@/lib/analytics'
import { createPersistedSignal } from '@/lib/storage'
import { recordActivity } from './usage-store'

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

const [history, setHistory] = createPersistedSignal<ExerciseHistoryEntry[]>(
  STORAGE_KEY,
  [],
)

export function exerciseHistory(): ExerciseHistoryEntry[] {
  return history()
}

export function recordExerciseResult(entry: ExerciseHistoryEntry): void {
  setHistory((prev) => {
    const next = [entry, ...prev]
    return next.slice(0, 100) // keep last 100 entries
  })

  // If this run was launched from a challenge, report the score back so the
  // challenge records the attempt (and completes when the target is met).
  void recordChallengeAttempt({ type: entry.type, score: entry.score })
  // Same return path for a weekly "Sing the Legend" attempt.
  void recordWeeklyAttempt({ type: entry.type, score: entry.score })

  // Auto-advance daily routine if this exercise matches the current segment
  autoAdvanceRoutineSegment(entry.type, entry.metrics)

  // Credit practice minutes toward today's daily goal (which bumps the streak
  // once met). Leaderboard standings are derived server-side from
  // sessionRecords, so exercises no longer post leaderboard entries.
  const runMs = entry.metrics.durationMs ?? entry.metrics.elapsedMs
  void addScoredMs(runMs !== undefined && runMs > 0 ? runMs : NOMINAL_RUN_MS)

  trackEvent('session_complete')
  recordActivity()
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
