// ============================================================
// Exercise Launch Context — one scoped drill configuration
// ============================================================
//
// Navigation, recommendation, and exercise features all participate in one
// launch. This neutral handoff keeps their shared configuration out of any
// one feature while preserving the existing one-shot lifecycle.

import { createSignal } from 'solid-js'
import type { ExerciseConfig, ExerciseType, GuidedPracticeLaunchConfig, } from './exercise-contracts'

const [launchOverride, setLaunchOverride] = createSignal<{
  type: ExerciseType
  config: ExerciseConfig
} | null>(null)

export function setExerciseLaunchOverride(
  type: ExerciseType,
  config: ExerciseConfig | undefined,
): void {
  setLaunchOverride(config === undefined ? null : { type, config })
}

export function clearExerciseLaunchOverride(): void {
  setLaunchOverride(null)
}

export function exerciseLaunchDifficulty(
  type: ExerciseType,
): number | undefined {
  const current = launchOverride()
  return current?.type === type ? current.config.difficulty : undefined
}

export function exerciseLaunchTargetNote(
  type: ExerciseType,
): string | undefined {
  const current = launchOverride()
  if (current?.type !== type) return undefined
  return current.config.targetNote ?? current.config.targetNotes?.[0]
}

export function exerciseLaunchTargetNotes(
  type: ExerciseType,
): string[] | undefined {
  const current = launchOverride()
  return current?.type === type ? current.config.targetNotes : undefined
}

export function exerciseLaunchPattern(type: ExerciseType): string | undefined {
  const current = launchOverride()
  return current?.type === type ? current.config.pattern : undefined
}

export function exerciseLaunchGuidedPractice(
  type: ExerciseType,
): GuidedPracticeLaunchConfig | undefined {
  const current = launchOverride()
  return current?.type === type ? current.config.guidedPractice : undefined
}
