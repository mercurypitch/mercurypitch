// ============================================================
// Exercise deep-link slug map tests
// ============================================================
// Guards the marketing deep-link contract (`/exercises/<slug>`): the path
// matcher and the slug → launch-intent registry the about-landing relies on.

import { describe, expect, it } from 'vitest'
import { VIEW_FOR_DRILL } from '@/features/ear-lab/drill-views'
import { typesFor } from '@/features/exercises/cadence/cadence-rounds'
import { CHORD_SETS, isChordStackerChord, } from '@/features/exercises/chord-stacker/chord-stacker-chords'
import { isDroneTuning } from '@/features/exercises/drone-intonation/drone-tuning'
import { droneIntervalLabel } from '@/features/exercises/drone-intonation/use-drone-intonation-controller'
import { isWebRoom } from '@/features/exercises/rooms/web-room-ids'
import { SCALE_RUNNER_SCALES } from '@/features/exercises/scale-runner/scale-runner-scales'
import { hintLine } from '@/features/exercises/sing-in-time/in-time-words'
import { EXERCISE_SLUG_PATH, EXERCISE_SLUGS, } from '@/features/exercises/slug-map'
import { EXERCISE_CADENCE, EXERCISE_CHORD_STACKER, EXERCISE_DRONE_INTONATION, EXERCISE_HARMONY_LAKE, EXERCISE_INTERVAL_TRAINER, EXERCISE_NOTE_READING, EXERCISE_SCALE_RUNNER, EXERCISE_SING_IN_TIME, } from '@/features/exercises/types'
import { difficultyLabel } from '@/features/practice-intelligence/adaptive-difficulty'
import { clearLaunchOverride, launchIntervals, setLaunchOverride, } from '@/features/practice-intelligence/launch-override'
import { TAB_JAM, TAB_KARAOKE } from '@/features/tabs/constants'
import { resolveEarSubset } from '@/lib/ear/subsets'
import { noteToMidi } from '@/lib/frequency-to-note'
import { fitPhraseToRange, fitScaleBaseNote, getComfortableMidiRange, } from '@/lib/vocal-range'
import type { VocalRangePreset } from '@/stores/settings-store'
import { VOCAL_RANGES } from '@/stores/settings-store'

// ── EXERCISE_SLUG_PATH ────────────────────────────────────────

describe('EXERCISE_SLUG_PATH', () => {
  it('matches /exercises/<slug> and captures the slug', () => {
    expect('/exercises/perfect-octave'.match(EXERCISE_SLUG_PATH)?.[1]).toBe(
      'perfect-octave',
    )
    // Trailing slash is allowed.
    expect('/exercises/speed-scales/'.match(EXERCISE_SLUG_PATH)?.[1]).toBe(
      'speed-scales',
    )
    // An unknown but well-formed slug still matches (handled as "not found").
    expect('/exercises/nope'.match(EXERCISE_SLUG_PATH)?.[1]).toBe('nope')
  })

  it('rejects non-matching paths', () => {
    expect('/exercises'.match(EXERCISE_SLUG_PATH)).toBeNull()
    expect('/exercises/'.match(EXERCISE_SLUG_PATH)).toBeNull()
    expect('/exercises/Bad-Slug'.match(EXERCISE_SLUG_PATH)).toBeNull() // uppercase
    expect('/exercises/a_b'.match(EXERCISE_SLUG_PATH)).toBeNull() // underscore
    expect('/exercises/a/b'.match(EXERCISE_SLUG_PATH)).toBeNull() // nested
    expect('/foo/perfect-octave'.match(EXERCISE_SLUG_PATH)).toBeNull()
  })
})

// ── EXERCISE_SLUGS registry ───────────────────────────────────

describe('EXERCISE_SLUGS', () => {
  it('maps the four landing slugs to the agreed launch intents', () => {
    expect(EXERCISE_SLUGS['perfect-octave']).toEqual({
      kind: 'exercise',
      exercise: EXERCISE_INTERVAL_TRAINER,
      notes: ['C4', 'C5'],
    })
    expect(EXERCISE_SLUGS['speed-scales']).toEqual({
      kind: 'exercise',
      exercise: EXERCISE_SCALE_RUNNER,
      scaleId: 'scale-major-c4',
      difficulty: 8,
    })
    expect(EXERCISE_SLUGS['karaoke-duel']).toEqual({
      kind: 'tab',
      tab: TAB_KARAOKE,
    })
    expect(EXERCISE_SLUGS['jam-relay']).toEqual({ kind: 'tab', tab: TAB_JAM })
  })

  it("opens Interval Trainer on Lesson 9's five leaps for leap-ladder", () => {
    expect(EXERCISE_SLUGS['leap-ladder']).toEqual({
      kind: 'exercise',
      exercise: EXERCISE_INTERVAL_TRAINER,
      intervals: [3, 4, 7, 5, 12],
    })
  })

  it("opens Drone Intonation on Lesson 10's two thirds for thirds-on-a-drone, on the piano's notes", () => {
    // Lessons 10 and 24's cards say the link scores to the piano's notes,
    // so it does not take the singer's saved tuning.
    expect(EXERCISE_SLUGS['thirds-on-a-drone']).toEqual({
      kind: 'exercise',
      exercise: EXERCISE_DRONE_INTONATION,
      intervals: [3, 4],
      tuning: 'piano',
    })
  })

  it("opens Scale Runner on Lesson 20's two pentatonics, at a slow level", () => {
    expect(EXERCISE_SLUGS['pentatonic-run']).toEqual({
      kind: 'exercise',
      exercise: EXERCISE_SCALE_RUNNER,
      scale: 'pentatonic',
      difficulty: 2,
    })
    expect(EXERCISE_SLUGS['minor-pentatonic-run']).toEqual({
      kind: 'exercise',
      exercise: EXERCISE_SCALE_RUNNER,
      scale: 'pentatonic-minor',
      difficulty: 2,
    })
  })

  it("opens Lesson 20's pentatonics at a level the app calls Beginner", () => {
    // The lesson's plan asks for a slow level: no score on its page rewards
    // speed. Lesson 25's minors keep the singer's own.
    const levels = ['pentatonic-run', 'minor-pentatonic-run'].map((slug) => {
      const launch = EXERCISE_SLUGS[slug]
      return launch.kind === 'exercise' ? launch.difficulty : undefined
    })
    const minor = EXERCISE_SLUGS['harmonic-minor-run']

    expect(levels.map((l) => difficultyLabel(l ?? 5))).toEqual([
      'Beginner',
      'Beginner',
    ])
    expect(minor.kind === 'exercise' ? minor.difficulty : 0).toBeUndefined()
  })

  it("opens Interval Trainer on Lesson 23's three perfect intervals for perfect-intervals", () => {
    expect(EXERCISE_SLUGS['perfect-intervals']).toEqual({
      kind: 'exercise',
      exercise: EXERCISE_INTERVAL_TRAINER,
      intervals: [5, 7, 12],
    })
  })

  it("opens Drone Intonation on Lesson 24's fifth, major third and octave, tuned pure, for harmony-on-a-drone", () => {
    expect(EXERCISE_SLUGS['harmony-on-a-drone']).toEqual({
      kind: 'exercise',
      exercise: EXERCISE_DRONE_INTONATION,
      intervals: [7, 4, 12],
      tuning: 'pure',
    })
  })

  it('opens Chord Stacker on the four triads in root position for triads', () => {
    expect(EXERCISE_SLUGS.triads).toEqual({
      kind: 'exercise',
      exercise: EXERCISE_CHORD_STACKER,
      chords: [...CHORD_SETS.triads],
      inversions: false,
    })
  })

  it("opens Scale Runner on Lesson 25's two minors, from A", () => {
    expect(EXERCISE_SLUGS['harmonic-minor-run']).toEqual({
      kind: 'exercise',
      exercise: EXERCISE_SCALE_RUNNER,
      notes: ['A3', 'A4'],
      scale: 'harmonic-minor',
    })
    expect(EXERCISE_SLUGS['melodic-minor-run']).toEqual({
      kind: 'exercise',
      exercise: EXERCISE_SCALE_RUNNER,
      notes: ['A3', 'A4'],
      scale: 'melodic-minor',
    })
  })

  it("starts Lesson 25's minors on an A whose whole run fits every voice", () => {
    // Scale Runner runs an octave up from the launch's first note, which
    // the app fits to the singer's range first (applyExerciseSlug). Fitted
    // on that note alone, a mezzo-soprano's run would end on the top note
    // of her range; the slug names the run's last note too, so the whole
    // octave is placed.
    const launch = EXERCISE_SLUGS['harmonic-minor-run']
    const notes = launch.kind === 'exercise' ? (launch.notes ?? []) : []

    const starts = (Object.keys(VOCAL_RANGES) as VocalRangePreset[]).map(
      (preset) => {
        const start = fitPhraseToRange(notes, preset)[0]
        const { min, max } = getComfortableMidiRange(preset)
        const midi = noteToMidi(start)
        return {
          preset,
          start,
          // Room above the run's top note, and below its first.
          fits: midi >= min && midi + 12 <= max,
          unfolded: fitScaleBaseNote(start, preset) === start,
        }
      },
    )

    expect(starts.map((s) => s.start.replace(/\d+$/, ''))).toEqual(
      starts.map(() => 'A'),
    )
    expect(starts.filter((s) => !s.fits || !s.unfolded)).toEqual([])
    // The mezzo-soprano's two fitting octaves tie; she gets the lower.
    expect(starts.find((s) => s.preset === 'mezzo-soprano')?.start).toBe('A3')
  })

  it("opens the Harmony room, one of the web's, for harmony-line", () => {
    const launch = EXERCISE_SLUGS['harmony-line']

    expect(launch).toEqual({
      kind: 'exercise',
      exercise: EXERCISE_HARMONY_LAKE,
    })
    // A slug for a room the web does not open would land on a bare panel.
    expect(isWebRoom(launch.kind === 'exercise' ? launch.exercise : null)).toBe(
      true,
    )
  })

  it("opens Read the Note on the singer's own level for read-the-note", () => {
    expect(EXERCISE_SLUGS['read-the-note']).toEqual({
      kind: 'exercise',
      exercise: EXERCISE_NOTE_READING,
    })
  })

  it("opens Name the Cadence on Lesson 28's four cadences for name-the-cadence", () => {
    const launch = EXERCISE_SLUGS['name-the-cadence']

    expect(launch).toEqual({
      kind: 'exercise',
      exercise: EXERCISE_CADENCE,
      difficulty: 7,
    })
    // The lesson names four; the level every singer starts on asks for three.
    const level = launch.kind === 'exercise' ? (launch.difficulty ?? 5) : 5
    expect(typesFor(level)).toEqual([
      'perfect',
      'imperfect',
      'plagal',
      'interrupted',
    ])
    expect(typesFor(5)).toHaveLength(3)
  })

  it("opens Sing It in Time on Lesson 18's two bars for sing-it-in-time", () => {
    const launch = EXERCISE_SLUGS['sing-it-in-time']

    expect(launch).toEqual({
      kind: 'exercise',
      exercise: EXERCISE_SING_IN_TIME,
      difficulty: 5,
    })
    // The lesson's checkpoint: quarters and halves, steps and thirds, at 60.
    const level = launch.kind === 'exercise' ? (launch.difficulty ?? 5) : 5
    expect(hintLine(level)).toBe(
      '3 tunes · 60 BPM · quarters and halves, steps and thirds',
    )
  })

  it("opens the Ear Lab's drills on Season 2's five sets", () => {
    const sets = [
      'quarters-halves-and-eighths',
      'three-four-or-six-eight',
      'perfect-or-tritone',
      'te-or-ti',
      'major-or-dominant-seventh',
    ].map((slug) => EXERCISE_SLUGS[slug])

    expect(sets).toEqual([
      {
        kind: 'ear-drill',
        drill: 'chart',
        items: [
          'c-q3',
          'c-q4',
          'c-q-rest',
          'c-e-and',
          'c-e-one',
          'c-e-off',
          'c-e-run',
          'c-e-across',
        ],
      },
      {
        kind: 'ear-drill',
        drill: 'subdivide',
        items: ['metre:3-4:a', 'metre:3-4:b', 'metre:6-8:a', 'metre:6-8:b'],
      },
      {
        kind: 'ear-drill',
        drill: 'leap',
        items: ['leap:P4', 'leap:TT', 'leap:P5', 'leap:P8'],
      },
      {
        kind: 'ear-drill',
        drill: 'gravity',
        items: ['gravity:deg-11', 'gravity:deg-12'],
      },
      {
        kind: 'ear-drill',
        drill: 'stack',
        items: ['stack:maj', 'stack:dom7'],
      },
    ])
  })

  it('names for every ear-drill slug a drill the Ear Lab opens, and a set of it whole', () => {
    // A drill with no view would land on the bench, and an item its bank
    // lacks would open the drill whole: either would lose the set silently.
    const ear = Object.entries(EXERCISE_SLUGS).flatMap(([slug, launch]) =>
      launch.kind === 'ear-drill' ? [{ slug, launch }] : [],
    )

    const lost = ear.filter(({ launch }) => {
      const subset = resolveEarSubset(launch.drill, launch.items)
      return (
        VIEW_FOR_DRILL[launch.drill] === undefined ||
        subset === null ||
        subset.itemIds.length !== launch.items?.length
      )
    })

    expect(ear).toHaveLength(5)
    expect(lost).toEqual([])
  })

  it('keys are lowercase kebab-case', () => {
    for (const slug of Object.keys(EXERCISE_SLUGS)) {
      expect(slug).toMatch(/^[a-z0-9-]+$/)
    }
  })

  it('every launch has a coherent shape', () => {
    for (const launch of Object.values(EXERCISE_SLUGS)) {
      if (launch.kind === 'exercise') {
        expect(typeof launch.exercise).toBe('string')
        // A launch targets the exercise via either explicit notes or a scaleId
        // (or neither, falling back to the exercise's own default).
        if (launch.notes !== undefined) {
          expect(launch.notes.length).toBeGreaterThan(0)
        }
      } else if (launch.kind === 'ear-drill') {
        expect(typeof launch.drill).toBe('string')
      } else {
        expect(launch.kind).toBe('tab')
        expect(typeof launch.tab).toBe('string')
      }
    }
  })

  it('lists only intervals the launch keeps as written', () => {
    // launchIntervals drops what is not a whole upward semitone up to an
    // octave, and repeats; a slug that wrote one would lose it silently.
    const withIntervals = Object.values(EXERCISE_SLUGS).flatMap((launch) =>
      launch.kind === 'exercise' && launch.intervals !== undefined
        ? [{ exercise: launch.exercise, intervals: launch.intervals }]
        : [],
    )

    const kept = withIntervals.map(({ exercise, intervals }) => {
      setLaunchOverride(exercise, { type: exercise, intervals })
      return launchIntervals(exercise)
    })
    clearLaunchOverride()

    expect(withIntervals.length).toBeGreaterThan(0)
    expect(kept).toEqual(withIntervals.map(({ intervals }) => intervals))
  })

  it('lists for Drone Intonation only intervals its own pool names', () => {
    // Drone drills only the launch intervals it has a name for, so a slug
    // that wrote another would lose it there silently.
    const forDrone = Object.values(EXERCISE_SLUGS).flatMap((launch) =>
      launch.kind === 'exercise' &&
      launch.exercise === EXERCISE_DRONE_INTONATION
        ? (launch.intervals ?? [])
        : [],
    )

    const unnamed = forDrone.filter((s) => droneIntervalLabel(s) === undefined)

    expect(forDrone.length).toBeGreaterThan(0)
    expect(unnamed).toEqual([])
  })

  it('names a scale only for Scale Runner, and only one it runs', () => {
    // Scale Runner alone reads a launch's scale, and opens on its first
    // choice for a name off its list, so a slug that wrote one for another
    // drill, or misspelt it, would lose it silently.
    const withScale = Object.values(EXERCISE_SLUGS).flatMap((launch) =>
      launch.kind === 'exercise' && launch.scale !== undefined
        ? [{ exercise: launch.exercise, scale: launch.scale }]
        : [],
    )
    const listed: readonly string[] = SCALE_RUNNER_SCALES.map((s) => s.value)

    const misplaced = withScale.filter(
      ({ exercise, scale }) =>
        exercise !== EXERCISE_SCALE_RUNNER || !listed.includes(scale),
    )

    expect(withScale.length).toBeGreaterThan(0)
    expect(misplaced).toEqual([])
  })

  it('names chords only for Chord Stacker, and only ones it plays', () => {
    // Chord Stacker keeps a launch's chords that are on its own list and
    // deals from its setup's set when none is, so a slug that wrote one for
    // another drill, or misspelt it, would lose it silently.
    const withChords = Object.values(EXERCISE_SLUGS).flatMap((launch) =>
      launch.kind === 'exercise' &&
      (launch.chords !== undefined || launch.inversions !== undefined)
        ? [launch]
        : [],
    )

    const misplaced = withChords.filter(
      (launch) =>
        launch.exercise !== EXERCISE_CHORD_STACKER ||
        !(launch.chords ?? []).every(isChordStackerChord),
    )

    expect(withChords.length).toBeGreaterThan(0)
    expect(misplaced).toEqual([])
  })

  it('names a tuning only for Drone Intonation, and only one of its two', () => {
    // Drone keeps a launch's tuning only when it is `piano` or `pure`, so
    // a slug that wrote one for another drill, or misspelt it, would lose
    // it silently.
    const withTuning = Object.values(EXERCISE_SLUGS).flatMap((launch) =>
      launch.kind === 'exercise' && launch.tuning !== undefined ? [launch] : [],
    )

    const misplaced = withTuning.filter(
      (launch) =>
        launch.exercise !== EXERCISE_DRONE_INTONATION ||
        !isDroneTuning(launch.tuning),
    )

    expect(withTuning.length).toBeGreaterThan(0)
    expect(misplaced).toEqual([])
  })

  it('unknown slugs resolve to undefined (own-property only)', () => {
    expect(EXERCISE_SLUGS['does-not-exist']).toBeUndefined()
    // Prototype keys must not leak through as launch intents.
    expect(Object.hasOwn(EXERCISE_SLUGS, 'constructor')).toBe(false)
  })
})
