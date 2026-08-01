import { describe, expect, it } from 'vitest'
import { convertExerciseTarget, createGlideTarget, createNoteTarget, duplicateExerciseTarget, exerciseTargetKind, MIN_TARGET_DURATION_BEATS, moveExerciseTarget, removeExerciseTarget, resizeExerciseTarget, snapTimelineBeat, updateExerciseTarget, } from '@/features/admin/exercises/exercise-authoring-model'
import type { ZenExerciseDefinition } from '@/features/zen/types'

const exercise = (): ZenExerciseDefinition => ({
  id: 'test-pattern',
  version: 1,
  title: 'Test Pattern',
  category: 'scales',
  level: 'foundation',
  summary: 'A test exercise.',
  goal: 'Test the authoring model.',
  instructions: 'Sing each target.',
  bpm: 80,
  countInBeats: 2,
  loopBeats: 8,
  defaultRootMidi: 60,
  targets: [
    {
      id: 'note-1',
      startBeat: 1,
      durationBeats: 1,
      semitone: 0,
      cue: 'Ah',
      showCue: true,
    },
  ],
  defaultTargetVisibility: 'on',
  defaultProgressCue: 'playhead',
  scoring: {
    pitchWeight: 0.55,
    coverageWeight: 0.25,
    steadinessWeight: 0.2,
    toleranceCents: 100,
  },
})

describe('exercise authoring model', () => {
  it('creates note and glide targets without mutating the source exercise', () => {
    const source = exercise()
    const withNote = createNoteTarget(source, {
      atBeat: 3,
      semitone: 4,
      cue: 'Mam',
    })
    const withGlide = createGlideTarget(withNote, {
      atBeat: 5,
      semitone: 7,
      cue: 'Noo',
    })

    expect(source.targets).toHaveLength(1)
    expect(withGlide.targets).toHaveLength(3)
    expect(withGlide.targets[1]).toMatchObject({
      id: 'note-2',
      startBeat: 3,
      semitone: 4,
      cue: 'Mam',
    })
    expect(withGlide.targets[2]).toMatchObject({
      id: 'glide-1',
      startBeat: 5,
      semitone: 7,
      endSemitone: 12,
    })
  })

  it('updates, moves, and resizes targets with immutable clamped timing', () => {
    const source = exercise()
    const edited = updateExerciseTarget(source, 'note-1', {
      cue: 'NG',
      startBeat: 7.75,
      durationBeats: 2,
    })
    const moved = moveExerciseTarget(edited, 'note-1', -1, 2)
    const resized = resizeExerciseTarget(moved, 'note-1', 'end', 8)

    expect(source.targets[0].cue).toBe('Ah')
    expect(edited.targets[0]).toMatchObject({
      cue: 'NG',
      startBeat: 6,
      durationBeats: 2,
    })
    expect(moved.targets[0]).toMatchObject({
      startBeat: 5,
      semitone: 2,
    })
    expect(resized.targets[0].durationBeats).toBe(3)
  })

  it('keeps authored targets above the runtime validation duration floor', () => {
    const resized = resizeExerciseTarget(exercise(), 'note-1', 'end', 1.01)

    expect(resized.targets[0].durationBeats).toBe(MIN_TARGET_DURATION_BEATS)
  })

  it('duplicates, converts, and removes targets with stable unique IDs', () => {
    const source = exercise()
    const duplicated = duplicateExerciseTarget(source, 'note-1')
    const glide = convertExerciseTarget(duplicated, 'note-2', 'glide')
    const restoredNote = convertExerciseTarget(glide, 'note-2', 'note')
    const removed = removeExerciseTarget(restoredNote, 'note-1')

    expect(duplicated.targets.map((target) => target.id)).toEqual([
      'note-1',
      'note-2',
    ])
    expect(exerciseTargetKind(glide.targets[1])).toBe('glide')
    expect(exerciseTargetKind(restoredNote.targets[1])).toBe('note')
    expect(removed.targets.map((target) => target.id)).toEqual(['note-2'])
  })

  it('snaps pointer timing to quarter-beat positions', () => {
    expect(snapTimelineBeat(1.12)).toBe(1)
    expect(snapTimelineBeat(1.14)).toBe(1.25)
    expect(snapTimelineBeat(2.88)).toBe(3)
  })
})
