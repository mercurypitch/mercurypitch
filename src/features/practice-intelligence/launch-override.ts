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

import { createSignal } from 'solid-js'
import type { ExerciseConfig, ExerciseType } from '@/features/exercises/types'
import { clampDifficulty } from './adaptive-difficulty'
import { getDifficulty } from './difficulty-store'

const [override, setOverride] = createSignal<{
  type: ExerciseType
  config: ExerciseConfig
} | null>(null)

/** Set (or clear, when config is undefined) the override for the next launch. */
export function setLaunchOverride(
  type: ExerciseType,
  config: ExerciseConfig | undefined,
): void {
  setOverride(config ? { type, config } : null)
}

export function clearLaunchOverride(): void {
  setOverride(null)
}

/**
 * Effective difficulty (1-10) for launching `type`: a drill override wins,
 * otherwise the player's stored level. This is the value exercises should
 * scale their parameters by.
 */
export function launchDifficulty(type: ExerciseType): number {
  const o = override()
  if (o && o.type === type && o.config.difficulty != null) {
    return clampDifficulty(o.config.difficulty)
  }
  return getDifficulty(type)
}

/** Target note a drill requested for `type`, if any (else undefined). */
export function launchTargetNote(type: ExerciseType): string | undefined {
  const o = override()
  if (!o || o.type !== type) return undefined
  return o.config.targetNote ?? o.config.targetNotes?.[0]
}

/** Full target-note sequence a drill requested for `type` (else undefined). */
export function launchTargetNotes(type: ExerciseType): string[] | undefined {
  const o = override()
  return o && o.type === type ? o.config.targetNotes : undefined
}
