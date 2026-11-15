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
import { clearExerciseLaunchOverride, exerciseLaunchChords, exerciseLaunchDifficulty, exerciseLaunchGuidedPractice, exerciseLaunchIntervals, exerciseLaunchInversions, exerciseLaunchPattern, exerciseLaunchScale, exerciseLaunchTargetNote, exerciseLaunchTargetNotes, exerciseLaunchTuning, setExerciseLaunchOverride, } from '@/lib/domain/exercise-launch'
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

/** The widest interval a launch may ask for: the octave, as wide as the
 *  Interval Trainer's own pool reaches above its start note. */
const MAX_LAUNCH_INTERVAL = 12

/**
 * Intervals a launch asked `type` to drill, in semitones above the start
 * note, each upward: whole semitones from 1 to an octave, each once, in the
 * order given. Undefined when no launch asked, or when nothing it asked for
 * is usable, so the exercise falls back to its own pool.
 */
export function launchIntervals(type: ExerciseType): number[] | undefined {
  const requested = exerciseLaunchIntervals(type)
  if (requested === undefined) return undefined
  const usable = [
    ...new Set(
      requested.filter(
        (s) => Number.isInteger(s) && s >= 1 && s <= MAX_LAUNCH_INTERVAL,
      ),
    ),
  ]
  return usable.length > 0 ? usable : undefined
}

/**
 * Scale a launch asked `type` to open on, by the exercise's own name for it
 * (Scale Runner's `harmonic-minor`), if any. The name is whatever the launch
 * wrote: the exercise keeps it only when its own list has it.
 */
export function launchScale(type: ExerciseType): string | undefined {
  return exerciseLaunchScale(type)
}

/**
 * Chord types a launch asked `type` to deal, by the exercise's own names
 * for them (Chord Stacker's `major`, `dom7`), each once, in the order
 * given. The names are whatever the launch wrote: the exercise keeps those
 * its own list has, and falls back to its setup's set when none is.
 */
export function launchChords(type: ExerciseType): string[] | undefined {
  const requested = exerciseLaunchChords(type)
  if (requested === undefined) return undefined
  const named = [...new Set(requested)]
  return named.length > 0 ? named : undefined
}

/** Whether a launch asked `type` to turn its chords over (undefined when
 *  it did not say, so the exercise keeps the singer's own choice). */
export function launchInversions(type: ExerciseType): boolean | undefined {
  return exerciseLaunchInversions(type)
}

/**
 * The tuning a launch asked `type` to score in, by the exercise's own name
 * for it (Drone Intonation's `pure`), if any. The exercise keeps it only
 * when its own list has it, and keeps the singer's choice otherwise.
 */
export function launchTuning(type: ExerciseType): string | undefined {
  return exerciseLaunchTuning(type)
}

/** Reviewed guided-practice prescription attached to this one launch. */
export function launchGuidedPractice(
  type: ExerciseType,
): GuidedPracticeLaunchConfig | undefined {
  return exerciseLaunchGuidedPractice(type)
}
