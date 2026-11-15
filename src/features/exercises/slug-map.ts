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
// (packages/mercurypitch/src/components/Community.astro). Lessons have slugs
// of their own too, each named beside its entry below: `leap-ladder` is
// Lesson 9's practice card and `thirds-on-a-drone` Lesson 10's, and Season
// 2's follow them.

import type { ScaleRunnerScale } from '@/features/exercises/scale-runner/scale-runner-scales'
import type { ExerciseType } from '@/features/exercises/types'
import { EXERCISE_DRONE_INTONATION, EXERCISE_HARMONY_LAKE, EXERCISE_INTERVAL_TRAINER, EXERCISE_SCALE_RUNNER, } from '@/features/exercises/types'
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
  /** Intervals to drill, in semitones above the start note, each upward
   *  (e.g. `[5, 7]`), in place of the exercise's own pool: whole semitones
   *  1 to 12, each once. Interval Trainer reads it, and Drone Intonation
   *  the ones its own pool names. */
  intervals?: number[]
  /** The scale Scale Runner opens on, by its own name for it, in place of
   *  the first on its list. The singer can still pick another. */
  scale?: ScaleRunnerScale
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
  // Interval exercise on Lesson 9's leaps (Landing a leap): the minor and
  // major thirds, the fifth, the fourth and the octave, each upward.
  'leap-ladder': {
    kind: 'exercise',
    exercise: EXERCISE_INTERVAL_TRAINER,
    intervals: [3, 4, 7, 5, 12],
  },
  // Drone exercise on Lesson 10's thirds (Major and minor): the minor and
  // the major third above the drone, each upward.
  'thirds-on-a-drone': {
    kind: 'exercise',
    exercise: EXERCISE_DRONE_INTONATION,
    intervals: [3, 4],
  },
  // Scale exercise on Lesson 20's two scales (Runs and the pentatonic
  // scale): the pentatonic the lesson runs, and the minor pentatonic it
  // meets. Both open at a slow level, the app's Beginner, as the lesson's
  // plan asks: nothing on that page rewards speed.
  'pentatonic-run': {
    kind: 'exercise',
    exercise: EXERCISE_SCALE_RUNNER,
    scale: 'pentatonic',
    difficulty: 2,
  },
  'minor-pentatonic-run': {
    kind: 'exercise',
    exercise: EXERCISE_SCALE_RUNNER,
    scale: 'pentatonic-minor',
    difficulty: 2,
  },
  // Interval exercise on Lesson 23's perfect intervals (Perfect, major,
  // minor and the tritone): the fourth, the fifth and the octave, each
  // upward.
  'perfect-intervals': {
    kind: 'exercise',
    exercise: EXERCISE_INTERVAL_TRAINER,
    intervals: [5, 7, 12],
  },
  // Drone exercise on Lesson 24's notes (Harmony against a drone): the
  // fifth, the major third and the octave above the drone.
  'harmony-on-a-drone': {
    kind: 'exercise',
    exercise: EXERCISE_DRONE_INTONATION,
    intervals: [7, 4, 12],
  },
  // Scale exercise on Lesson 25's two minors (Minor, properly), from A as
  // the lesson sings them, at the singer's own level. The notes are the
  // run's first and its last, so the octave that fits the singer is chosen
  // for the whole run and not for its first note alone.
  'harmonic-minor-run': {
    kind: 'exercise',
    exercise: EXERCISE_SCALE_RUNNER,
    notes: ['A3', 'A4'],
    scale: 'harmonic-minor',
  },
  'melodic-minor-run': {
    kind: 'exercise',
    exercise: EXERCISE_SCALE_RUNNER,
    notes: ['A3', 'A4'],
    scale: 'melodic-minor',
  },
  // Harmony, the room where Merc sings a short line and the singer sings it
  // a third above him: the second voice of Lessons 26 and 28 (A second
  // voice; Cadences, form and a song in two parts). A room, so the web opens
  // it over the whole window (src/features/exercises/rooms).
  'harmony-line': {
    kind: 'exercise',
    exercise: EXERCISE_HARMONY_LAKE,
  },
  // Open the Karaoke view.
  'karaoke-duel': { kind: 'tab', tab: TAB_KARAOKE },
  // Open the Jam view.
  'jam-relay': { kind: 'tab', tab: TAB_JAM },
}

/** Matches `/exercises/<slug>` with an optional trailing slash. */
export const EXERCISE_SLUG_PATH = /^\/exercises\/([a-z0-9-]+)\/?$/
