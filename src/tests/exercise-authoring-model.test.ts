import { describe, expect, it } from 'vitest'
import { convertExerciseTarget, createBreathTarget, createGlideTarget, createHoldTarget, createNoteTarget, duplicateExerciseTarget, exerciseTargetKind, MIN_TARGET_DURATION_BEATS, moveExerciseTarget, removeExerciseTarget, resizeExerciseTarget, snapTimelineBeat, updateExerciseTarget, } from '@/features/admin/exercises/exercise-authoring-model'
import type { ZenExerciseDefinition } from '@/features/zen/types'
import { validateZenExercise } from '@/features/zen/validate-exercise'

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

// ============================================================
// Blocks the pitch tracker cannot hear
// ============================================================
//
// A warm-up is not four notes in a row. It is a hiss, a breath, a lip trill —
// things a pitch tracker has nothing to say about. Schema version 2 gave the
// runtime a way to store them; these are what let somebody build one without
// hand-writing JSON.
//
// Every test here ends at the validator, because the editor's real contract is
// not "produces an object" but "produces something publishable". The two
// fields that say what a block is are mutually exclusive, and it is the
// conversion path — note to hold, hold back to glide — where a stale
// `endSemitone` or `kind` would survive to be rejected at publish time.

describe('unpitched authoring blocks', () => {
  it('creates a hold and a breath that both validate', () => {
    const source = exercise()
    const withHold = createHoldTarget(source, {
      atBeat: 2,
      durationBeats: 2,
      cue: 'Sss',
    })
    const withBoth = createBreathTarget(withHold, { atBeat: 5 })

    expect(withBoth.targets.map(exerciseTargetKind)).toEqual([
      'note',
      'hold',
      'breath',
    ])
    expect(validateZenExercise(withBoth)).toEqual([])
    // Ids say what the block is, so the event list and the summary line read
    // as an author wrote them rather than as "note-2, note-3".
    expect(withBoth.targets.map((target) => target.id)).toEqual([
      'note-1',
      'hold-1',
      'breath-1',
    ])
    expect(source.targets).toHaveLength(1)
  })

  // The validator rejects `endSemitone` on anything but a sung block, so a
  // glide that becomes a hold has to shed it on the way through rather than
  // carrying a dead field to the publish step.
  it('drops the glide pitch when a sung block becomes a hold', () => {
    const glide = createGlideTarget(exercise(), { semitone: 0 })
    expect(glide.targets[1].endSemitone).toBe(5)

    const hold = convertExerciseTarget(glide, 'glide-1', 'hold')
    expect(hold.targets[1].endSemitone).toBeUndefined()
    expect(hold.targets[1].kind).toBe('amplitude')
    expect(validateZenExercise(hold)).toEqual([])
  })

  // And the reverse: a block that comes back to being sung sheds `kind`
  // entirely, which is what keeps an all-sung exercise byte-identical to the
  // version-one shape it started as.
  it('sheds the kind when a breath becomes a note again', () => {
    const breath = createBreathTarget(exercise())
    const note = convertExerciseTarget(breath, 'breath-1', 'note')

    expect('kind' in note.targets[1]).toBe(false)
    expect(exerciseTargetKind(note.targets[1])).toBe('note')
  })

  it('gives a hold turned glide a pitch to glide to', () => {
    const hold = createHoldTarget(exercise())
    const glide = convertExerciseTarget(hold, 'hold-1', 'glide')

    expect(glide.targets[1].kind).toBeUndefined()
    expect(glide.targets[1].endSemitone).toBe(glide.targets[1].semitone + 5)
    expect(validateZenExercise(glide)).toEqual([])
  })

  it('keeps a duplicate on the same side of the pitch line', () => {
    const hold = createHoldTarget(exercise())
    const twice = duplicateExerciseTarget(hold, 'hold-1')

    expect(twice.targets.map((target) => target.id)).toContain('hold-2')
    expect(exerciseTargetKind(twice.targets[2])).toBe('hold')
  })
})
