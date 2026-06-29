// ============================================================
// Exercise deep-link slugs — marketing URL → in-app launch intent
// ============================================================
//
// The about-landing (about.mercurypitch.com) links its Community "Try"
// buttons to clean deep-link URLs of the form
// `https://mercurypitch.com/exercises/<slug>`. Each slug maps to a launch
// intent the app applies on startup (see `applyExerciseSlug` in App.tsx):
// open a top-level tab, or open an exercise on its setup screen pre-configured
// with target notes (the user presses Start — see the note there on why we
// don't auto-start).
//
// Slugs are lowercase kebab-case (`[a-z0-9-]+`). Add new ones freely — the
// landing just needs the agreed string and the app maps it to an action here.
// Keep this registry in sync with the landing's Try-button hrefs
// (packages/mercurypitch/src/components/Community.astro).

import type { ExerciseType } from '@/features/exercises/types'
import { EXERCISE_INTERVAL_TRAINER, EXERCISE_SCALE_RUNNER, } from '@/features/exercises/types'
import type { ActiveTab } from '@/features/tabs/constants'
import { TAB_JAM, TAB_KARAOKE } from '@/features/tabs/constants'

/** Open an exercise on its setup screen, pre-configured (the user presses Start). */
export interface ExerciseLaunch {
  kind: 'exercise'
  exercise: ExerciseType
  /** Explicit target-note sequence (e.g. `['C4', 'C5']`) handed to the
   *  one-shot launch override; the exercise reads its start note from it. */
  notes?: string[]
  /** Seeded melody id (see `seedDefaultSession` in `src/stores/melody-store.ts`,
   *  e.g. `scale-major-c4`) to derive the target notes from when `notes` is
   *  not given. */
  scaleId?: string
  /** One-shot launch difficulty (1-10); higher = faster / harder. */
  difficulty?: number
}

/** Open a top-level tab/view (e.g. Karaoke, Jam). */
export interface TabLaunch {
  kind: 'tab'
  tab: ActiveTab
}

export type Launch = ExerciseLaunch | TabLaunch

/** Marketing slug → launch intent. */
export const EXERCISE_SLUGS: Record<string, Launch> = {
  // Interval exercise on an octave (C4 → C5).
  'perfect-octave': {
    kind: 'exercise',
    exercise: EXERCISE_INTERVAL_TRAINER,
    notes: ['C4', 'C5'],
  },
  // Scale-runner on the seeded C-major scale, fast tempo.
  'speed-scales': {
    kind: 'exercise',
    exercise: EXERCISE_SCALE_RUNNER,
    scaleId: 'scale-major-c4',
    difficulty: 8,
  },
  // Open the Karaoke view.
  'karaoke-duel': { kind: 'tab', tab: TAB_KARAOKE },
  // Open the Jam view.
  'jam-relay': { kind: 'tab', tab: TAB_JAM },
}

/** Matches `/exercises/<slug>` with an optional trailing slash. */
export const EXERCISE_SLUG_PATH = /^\/exercises\/([a-z0-9-]+)\/?$/
