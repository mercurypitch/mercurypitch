// ── Jam catalogue ────────────────────────────────────────────────────
// Turns the app's practice content into something a jam room can run.
//
// The room's shared surface is a piano roll: target notes on a beat grid,
// scored against every peer's live pitch. So anything that reduces to a
// target contour can be jammed. Two families cannot, and are listed as
// EXCLUDED below rather than quietly missing:
//
//   - metric drills (vibrato, dynamic-swell) score a rate or an envelope,
//     not a pitch target -- they need their own lane on the canvas.
//   - coached multi-block flows (warmup, routine-runner) are a sequence of
//     stages with spoken cues, not one contour.
//   - call/response drills (call-response, mirror-melody) need a phrase
//     played to the room first. That is a room mode, not a target.
//
// Nothing here touches the wire protocol. selectJamExercise already
// broadcasts a whole MelodyData, so the host builds the target in its own
// vocal range and every peer receives exactly the same notes.

import type { WeeklyChallenge } from '@/features/challenges/weekly-service'
import type { ExerciseType } from '@/features/exercises/types'
import { EXERCISE_ARPEGGIO_JUMPER, EXERCISE_CHORD_STACKER, EXERCISE_DRONE_INTONATION, EXERCISE_INTERVAL_TRAINER, EXERCISE_LONG_NOTE, EXERCISE_PITCH_HOLD, EXERCISE_PITCH_PURSUIT, EXERCISE_SCALE_RUNNER, EXERCISE_SIGHT_SINGING, EXERCISE_SIREN, EXERCISE_SLIDE, EXERCISE_STACCATO, } from '@/features/exercises/types'
import type { PathWeek } from '@/features/path/path-content'
import { midiToFrequency, midiToNoteName, noteToMidi, } from '@/lib/frequency-to-note'
import type { MelodyData, MelodyItem, NoteName } from '@/types'

/** Which shelf of the picker an entry came from. */
export type JamSourceKind = 'exercise' | 'weekly' | 'ascent' | 'melody'

export interface JamCatalogEntry {
  /** Stable across rebuilds -- used as the picker's list key. */
  id: string
  kind: JamSourceKind
  name: string
  /** One line under the name: what the room is about to sing. */
  detail: string
  /** Built lazily: the octave depends on the host's range setting. */
  build: () => MelodyData
}

// ── Exercise blueprints ──────────────────────────────────────────────
// Notes are written at octave 4 and transposed to the host's range when
// built. Durations are in beats.

interface JamDrill {
  title: string
  notes: string[]
  beatsPerNote: number
  bpm: number
  /** What the room should listen for. */
  blurb: string
}

const JAM_DRILLS: Partial<Record<ExerciseType, JamDrill>> = {
  [EXERCISE_LONG_NOTE]: {
    title: 'Long Note',
    notes: ['C4'],
    beatsPerNote: 8,
    bpm: 80,
    blurb: 'One note, held together. Steady beats loud.',
  },
  [EXERCISE_PITCH_HOLD]: {
    title: 'Pitch Hold',
    notes: ['C4', 'E4', 'G4'],
    beatsPerNote: 4,
    bpm: 80,
    blurb: 'Land each note and stay there.',
  },
  [EXERCISE_SIREN]: {
    title: 'Siren',
    notes: ['C4', 'E4', 'G4', 'C5', 'G4', 'E4', 'C4'],
    beatsPerNote: 1,
    bpm: 70,
    blurb: 'Glide up and back down without a break.',
  },
  [EXERCISE_SLIDE]: {
    title: 'Slide In/Out',
    notes: ['C4', 'G4', 'C4', 'A4', 'C4'],
    beatsPerNote: 2,
    bpm: 80,
    blurb: 'Clean transitions -- no scooping, no overshoot.',
  },
  [EXERCISE_PITCH_PURSUIT]: {
    title: 'Pitch Pursuit',
    notes: ['C4', 'D4', 'F4', 'E4', 'G4', 'F4', 'A4', 'G4'],
    beatsPerNote: 1,
    bpm: 100,
    blurb: 'Chase a moving target. Reaction over precision.',
  },
  [EXERCISE_INTERVAL_TRAINER]: {
    title: 'Intervals',
    notes: ['C4', 'E4', 'C4', 'G4', 'C4', 'C5'],
    beatsPerNote: 2,
    bpm: 90,
    blurb: 'Hear the gap before you sing it.',
  },
  [EXERCISE_SCALE_RUNNER]: {
    title: 'Scale Runner',
    notes: ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'],
    beatsPerNote: 1,
    bpm: 100,
    blurb: 'Even tone through every degree.',
  },
  [EXERCISE_ARPEGGIO_JUMPER]: {
    title: 'Arpeggio Jumper',
    notes: ['C4', 'E4', 'G4', 'C5', 'G4', 'E4', 'C4'],
    beatsPerNote: 1,
    bpm: 110,
    blurb: 'Leap between chord tones. Clean attack, no sliding.',
  },
  [EXERCISE_STACCATO]: {
    title: 'Staccato',
    notes: ['C4', 'E4', 'G4', 'C5', 'G4', 'E4', 'C4'],
    beatsPerNote: 0.5,
    bpm: 100,
    blurb: 'Short, crisp, dead on the beat.',
  },
  [EXERCISE_CHORD_STACKER]: {
    title: 'Chord Stacker',
    notes: ['C4', 'E4', 'G4', 'B4'],
    beatsPerNote: 4,
    bpm: 80,
    blurb: 'One voice per chord tone -- pick yours and hold it.',
  },
  [EXERCISE_DRONE_INTONATION]: {
    title: 'Drone Intonation',
    notes: ['C4', 'D4', 'E4', 'F4', 'G4', 'F4', 'E4', 'D4', 'C4'],
    beatsPerNote: 2,
    bpm: 70,
    blurb: 'Tune each degree against the room.',
  },
  [EXERCISE_SIGHT_SINGING]: {
    title: 'Sight Singing',
    notes: ['C4', 'E4', 'D4', 'F4', 'E4', 'G4', 'F4', 'E4', 'D4', 'C4'],
    beatsPerNote: 1,
    bpm: 90,
    blurb: 'Read it and sing it. No reference note.',
  },
}

/** Kept as documentation: these need work beyond a target contour. */
export const JAM_EXCLUDED_EXERCISES: ReadonlyArray<{
  type: string
  why: string
}> = [
  { type: 'vibrato', why: 'scores rate and depth, not a pitch target' },
  { type: 'dynamic-swell', why: 'scores a volume envelope, not a contour' },
  { type: 'warmup', why: 'a coached multi-block flow, not one contour' },
  { type: 'routine-runner', why: 'a sequence of drills, not one contour' },
  { type: 'call-response', why: 'needs a phrase played to the room first' },
  { type: 'mirror-melody', why: 'needs a phrase played to the room first' },
]

// ── Building ─────────────────────────────────────────────────────────

/**
 * Notes written at octave 4, shifted into the host's range. Melodies are
 * broadcast whole, so this is the host's choice for everyone -- which is
 * the same deal as the host owning BPM.
 */
function transposeSemitones(defaultOctave: number): number {
  return (defaultOctave - 4) * 12
}

function buildItems(
  notes: string[],
  beatsPerNote: number,
  semitoneShift: number,
): MelodyItem[] {
  const items: MelodyItem[] = []
  notes.forEach((name, i) => {
    let midi: number
    try {
      midi = noteToMidi(name) + semitoneShift
    } catch {
      return
    }
    if (!Number.isFinite(midi)) return
    items.push({
      id: i + 1,
      note: {
        midi,
        // midiToNoteName carries the octave ("G4"); NoteName is the bare
        // letter and renderers append the octave themselves, so "G4" here
        // would display as "G44".
        name: midiToNoteName(midi).replace(/-?\d+$/, '') as NoteName,
        octave: Math.floor(midi / 12) - 1,
        freq: midiToFrequency(midi),
      },
      duration: beatsPerNote,
      startBeat: i * beatsPerNote,
    })
  })
  return items
}

function drillToMelody(
  id: string,
  drill: JamDrill,
  defaultOctave: number,
): MelodyData {
  const now = Date.now()
  return {
    id,
    name: drill.title,
    bpm: drill.bpm,
    key: 'C',
    scaleType: 'major',
    createdAt: now,
    updatedAt: now,
    items: buildItems(
      drill.notes,
      drill.beatsPerNote,
      transposeSemitones(defaultOctave),
    ),
  }
}

// ── Shelves ──────────────────────────────────────────────────────────

/** Every exercise that reduces to a target contour, in catalogue order. */
export function jamExerciseEntries(defaultOctave: number): JamCatalogEntry[] {
  return Object.entries(JAM_DRILLS).map(([type, drill]) => ({
    id: `exercise:${type}`,
    kind: 'exercise' as const,
    name: drill.title,
    detail: `${drill.notes.length} note${drill.notes.length === 1 ? '' : 's'} · ${drill.bpm} bpm · ${drill.blurb}`,
    build: () => drillToMelody(`jam-exercise-${type}`, drill, defaultOctave),
  }))
}

/**
 * This week's challenge, as a room target. targetItems is already
 * MelodyItem[], so it needs no transposition -- the challenge is the same
 * notes for everyone, which is the whole point of a shared board.
 */
export function jamWeeklyEntry(
  weekly: WeeklyChallenge | null,
): JamCatalogEntry | null {
  if (weekly === null || weekly.targetItems.length === 0) return null
  return {
    id: `weekly:${weekly.id}`,
    kind: 'weekly',
    name: weekly.title,
    detail: `This week's challenge · ${weekly.targetItems.length} notes · target ${weekly.targetScore}`,
    build: () => ({
      id: `jam-weekly-${weekly.id}`,
      name: weekly.title,
      bpm: 90,
      key: 'C',
      scaleType: 'major',
      createdAt: Date.parse(weekly.startsAt),
      updatedAt: Date.now(),
      items: weekly.targetItems,
    }),
  }
}

/** The drills this Ascent week favours, minus the ones a room cannot run. */
export function jamAscentEntries(
  week: PathWeek | null,
  defaultOctave: number,
): JamCatalogEntry[] {
  if (week === null) return []
  return week.exercises.flatMap((type) => {
    const drill = JAM_DRILLS[type]
    if (drill === undefined) return []
    return [
      {
        id: `ascent:${week.order}:${type}`,
        kind: 'ascent' as const,
        name: drill.title,
        detail: `Week ${week.order} · ${week.title} · ${drill.blurb}`,
        build: () => drillToMelody(`jam-ascent-${type}`, drill, defaultOctave),
      },
    ]
  })
}

/** Saved melodies -- the room's original and only shelf. */
export function jamMelodyEntries(melodies: MelodyData[]): JamCatalogEntry[] {
  return melodies.map((melody) => ({
    id: `melody:${melody.id}`,
    kind: 'melody' as const,
    name: melody.name,
    detail: `${melody.bpm} bpm · ${melody.key} ${melody.scaleType}`,
    build: () => melody,
  }))
}
