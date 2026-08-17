// ============================================================
// The plain-drill session payload passes the worker's own gate
// ============================================================
//
// Repro: signed in on the dev domain, a full daily routine credited
// nothing — streak 0, "0 of 5 min", no session rows. The plain-exercise
// write had gained a comparabilityKey (CLAUDE-JOURNEY-007) without the
// sourceVersion the worker's evidence rule demands, so every create came
// back 400, the client swallowed it by design, and minutes, streak and
// badges never ran. Nothing ever held the exercise payload against
// `validateWrite`; this test closes that gap with the production builder
// and the production validator — no copies of either.

import { describe, expect, it } from 'vitest'
import { exerciseComparabilityKey, exerciseScoringVersion, } from '@/features/exercises/exercise-comparability'
import { EXERCISE_INTERVAL_TRAINER, EXERCISE_LONG_NOTE, EXERCISE_WARMUP, } from '@/features/exercises/types'
import type { ExerciseHistoryEntry } from '@/stores/exercise-history-store'
import { exerciseSessionPayload } from '@/stores/exercise-history-store'
import { validateWrite } from '../../workers/db-worker/src/validation'

function entry(type: ExerciseHistoryEntry['type']): ExerciseHistoryEntry {
  return { type, score: 82, metrics: { durationMs: 5200 }, completedAt: 1 }
}

describe('the plain-exercise session payload', () => {
  it('is accepted by the worker validation that rejected it in the field', () => {
    for (const type of [
      EXERCISE_LONG_NOTE,
      EXERCISE_INTERVAL_TRAINER,
      EXERCISE_WARMUP,
    ]) {
      const payload = exerciseSessionPayload(entry(type), 5200)
      expect(validateWrite('sessionRecords', payload)).toBeNull()
    }
  })

  it('carries the same scoring version its comparability key encodes', () => {
    // Two rulers must not diverge: the key's `v<n>` suffix is what threads
    // runs on Progress, the sourceVersion column is what the server audits.
    for (const type of [EXERCISE_LONG_NOTE, EXERCISE_INTERVAL_TRAINER]) {
      const payload = exerciseSessionPayload(entry(type), undefined)
      expect(payload.sourceVersion).toBe(exerciseScoringVersion(type))
      expect(exerciseComparabilityKey(type)).toBe(
        `voice:exercise:${type}:v${exerciseScoringVersion(type)}`,
      )
    }
    // The interval trainer's 2026-08 rescore bumped its ruler; the column
    // must say so, or old ~0 scores would thread against new real ones.
    expect(
      exerciseSessionPayload(entry(EXERCISE_INTERVAL_TRAINER), undefined)
        .sourceVersion,
    ).toBe(2)
  })
})
