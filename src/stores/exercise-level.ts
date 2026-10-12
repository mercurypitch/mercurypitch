// ============================================================
// Exercise level — how strictly the premium exercises hear a voice
// ============================================================
//
// The level is the accuracy tier Settings already has: Learning, Singer or
// Professional. The owner's call (12 Oct 2026): "The same level can be
// reused yes, we already have it ofc.. just map our premium exercises
// correctly through that". Each exercise decides what a tier means for it
// (Long note: the band and the steadiness its lantern's top asks for,
// LANTERN_LEVELS in src/lib/hold/hold-engine.ts).
//
// The one module the premium exercises reach the tier through: they read
// and set the level here and never touch the tier itself (a test holds
// them to it). Setting it goes through applyAccuracyTier, the setter
// Settings' own control uses, so the tier's mic preset and score mode come
// with it exactly as they do from Settings.
//
// It lives in stores, not lib, because it reads a store, and lib may not
// (scripts/code-metrics.mjs, lib-no-stores).

import type { AccuracyTier } from './settings-store'
import { accuracyTier, applyAccuracyTier, getAccuracyTierInfo, } from './settings-store'

export type ExerciseLevel = AccuracyTier

/** Easiest first, as Settings lists the tiers. */
export const EXERCISE_LEVELS: readonly ExerciseLevel[] = [
  'learning',
  'singer',
  'professional',
]

/**
 * The tier's own default (settings-store.ts), for a stored tier this build
 * does not know: the tier's signal takes any string it finds.
 */
const DEFAULT_LEVEL: ExerciseLevel = 'singer'

function isExerciseLevel(value: unknown): value is ExerciseLevel {
  return EXERCISE_LEVELS.includes(value as ExerciseLevel)
}

/** The level's name, as Settings names the tier. */
export function exerciseLevelName(level: ExerciseLevel): string {
  return getAccuracyTierInfo(level).label
}

/** The singer's level: their accuracy tier, Singer until they pick another. */
export function exerciseLevel(): ExerciseLevel {
  const tier = accuracyTier()
  return isExerciseLevel(tier) ? tier : DEFAULT_LEVEL
}

/**
 * Picks the level for every exercise, as Settings picks the tier: the
 * tier, its mic preset and its score mode.
 */
export function setExerciseLevel(level: ExerciseLevel): void {
  if (isExerciseLevel(level)) applyAccuracyTier(level)
}
