// ============================================================
// Launch Override — one-shot drill parameters for the next launch
// ============================================================
//
// When an exercise is started from a targeted drill (WeaknessPanel /
// PracticeSummaryCard), the drill carries a transient difficulty and/or
// target note. Rather than thread a prop through every exercise, the
// launcher stashes it here; the exercise reads it at start via
// `launchDifficulty` / `launchTargetNote`. Cleared on a normal launch or
// when the exercise is exited so it never leaks into the next session.

import type { ExerciseConfig, ExerciseType, GuidedPracticeLaunchConfig, } from '@/features/exercises/types'
import { clearExerciseLaunchOverride, exerciseLaunchDifficulty, exerciseLaunchGuidedPractice, exerciseLaunchPattern, exerciseLaunchTargetNote, exerciseLaunchTargetNotes, setExerciseLaunchOverride, } from '@/lib/domain/exercise-launch'
import { clampDifficulty } from './adaptive-difficulty'
import { getDifficulty } from './difficulty-store'

/** Set (or clear, when config is undefined) the override for the next launch. */
export function setLaunchOverride(
  type: ExerciseType,
  config: ExerciseConfig | undefined,
): void {
  setExerciseLaunchOverride(type, config)
}

export function clearLaunchOverride(): void {
  clearExerciseLaunchOverride()
}

/**
 * Effective difficulty (1-10) for launching `type`: a drill override wins,
 * otherwise the player's stored level. This is the value exercises should
 * scale their parameters by.
 */
export function launchDifficulty(type: ExerciseType): number {
  const requested = exerciseLaunchDifficulty(type)
  if (requested !== undefined) return clampDifficulty(requested)
  return getDifficulty(type)
}

/** Target note a drill requested for `type`, if any (else undefined). */
export function launchTargetNote(type: ExerciseType): string | undefined {
  return exerciseLaunchTargetNote(type)
}

/** Full target-note sequence a drill requested for `type` (else undefined). */
export function launchTargetNotes(type: ExerciseType): string[] | undefined {
  return exerciseLaunchTargetNotes(type)
}

/** Step-pattern a launch requested for `type` (e.g. warmup block), if any. */
export function launchPattern(type: ExerciseType): string | undefined {
  return exerciseLaunchPattern(type)
}

/** Reviewed guided-practice prescription attached to this one launch. */
export function launchGuidedPractice(
  type: ExerciseType,
): GuidedPracticeLaunchConfig | undefined {
  return exerciseLaunchGuidedPractice(type)
}
