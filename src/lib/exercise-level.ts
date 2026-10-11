// ============================================================
// Exercise level — how strictly the premium exercises hear a voice
// ============================================================
//
// One setting for every premium exercise: Beginner, Singer or Pro. The
// owner's call (11 Oct 2026): a beginner fills the Long note lantern
// without a perfect 12 seconds, and Pro makes a high score harder to get;
// "its an exercise, not a challenge". Beginner is where everyone starts.
// Each exercise decides what a level means for it (Long note: the band and
// the steadiness its lantern's top asks for, LANTERN_LEVELS in
// src/lib/hold/hold-engine.ts).
//
// Synced with the account (the `pitchperfect_` prefix, settings-service.ts),
// as the accuracy tier and Long note's remembered note are: it describes the
// singer, not the phone, so a second phone opens at the level they picked.
//
// Built on first read, not on import, like last-exercise.ts: nothing at this
// module's top level touches storage.
//
// The one module that knows where the level lives. Everything else, tests
// too, reads and sets it through exerciseLevel and setExerciseLevel (a test
// here holds the code to that), so keeping the level somewhere else, the
// accuracy tier in Settings say, changes this file and the marker the
// bundle check looks for (apps/mercurypitch/scripts/assert-bundle.mjs).

import type { Signal } from 'solid-js'
import { createPersistedSignal } from '@/lib/storage'

export type ExerciseLevel = 'beginner' | 'singer' | 'pro'

/** Easiest first. */
export const EXERCISE_LEVELS: readonly ExerciseLevel[] = [
  'beginner',
  'singer',
  'pro',
]

export const EXERCISE_LEVEL_KEY = 'pitchperfect_premium_exercise_level'

const NAMES: Record<ExerciseLevel, string> = {
  beginner: 'Beginner',
  singer: 'Singer',
  pro: 'Pro',
}

export function isExerciseLevel(value: unknown): value is ExerciseLevel {
  return value === 'beginner' || value === 'singer' || value === 'pro'
}

/** The level's name as the screen shows it. */
export function exerciseLevelName(level: ExerciseLevel): string {
  return NAMES[level]
}

let record: Signal<ExerciseLevel> | undefined

function stored(): Signal<ExerciseLevel> {
  record ??= createPersistedSignal<ExerciseLevel>(
    EXERCISE_LEVEL_KEY,
    'beginner',
    { validator: isExerciseLevel },
  )
  return record
}

/** The singer's level; Beginner until they pick another. */
export function exerciseLevel(): ExerciseLevel {
  return stored()[0]()
}

export function setExerciseLevel(level: ExerciseLevel): void {
  if (isExerciseLevel(level)) stored()[1](level)
}
