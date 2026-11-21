import { describe, expect, it } from 'vitest'
import { EXERCISE_LONG_NOTE, EXERCISE_NOTE_READING, EXERCISE_SING_IN_TIME, EXERCISE_SLIDE, EXERCISE_VIBRATO, EXERCISE_WARMUP, } from '@/lib/domain/exercise-contracts'
import { exerciseComparisonKey, exerciseThreadTitle, } from './exercise-voice-take'

// A kept take stores its thread title in the take itself, so an internal
// value written there stays in Hear Yourself for good. 0.9.31's first build
// titled a Sing It in Time take "Sing It in Time · level:5".

describe('exerciseThreadTitle', () => {
  it('names a Sing It in Time level the way the drill does, never by its internal pattern', () => {
    expect(
      exerciseThreadTitle('Sing It in Time', {
        type: EXERCISE_SING_IN_TIME,
        pattern: 'level:5',
      }),
    ).toBe('Sing It in Time · Level 5')
  })

  it('adds the style or routine after the note, so two variants on one note read apart', () => {
    const vibrato = (pattern: string) =>
      exerciseThreadTitle('Vibrato Practice', {
        type: EXERCISE_VIBRATO,
        targetNote: 'A3',
        pattern,
      })
    expect(vibrato('medium')).toBe('Vibrato Practice · A3 · Natural')
    expect(vibrato('slow')).toBe('Vibrato Practice · A3 · Slow & Wide')
    expect(
      exerciseThreadTitle('Warm-up', {
        type: EXERCISE_WARMUP,
        targetNote: 'C4',
        pattern: 'lip-trill',
      }),
    ).toBe('Warm-up · C4 · Lip trills')
  })

  it('leaves out a pattern it has no words for', () => {
    expect(
      exerciseThreadTitle('Sing It in Time', {
        type: EXERCISE_SING_IN_TIME,
        pattern: 'tempo:fast',
      }),
    ).toBe('Sing It in Time')
    expect(
      exerciseThreadTitle('Long Note', {
        type: EXERCISE_LONG_NOTE,
        targetNote: 'G3',
        pattern: 'internal-value',
      }),
    ).toBe('Long Note · G3')
    expect(
      exerciseThreadTitle('Vibrato Practice', {
        type: EXERCISE_VIBRATO,
        targetNote: 'A3',
        pattern: 'toString',
      }),
    ).toBe('Vibrato Practice · A3')
  })

  it('names notes and ranges as before', () => {
    expect(
      exerciseThreadTitle('Slide', {
        type: EXERCISE_SLIDE,
        targetNotes: ['C4', 'G4'],
      }),
    ).toBe('Slide · C4 to G4')
    expect(
      exerciseThreadTitle('Long Note', {
        type: EXERCISE_LONG_NOTE,
        targetNotes: ['E3', 'E3'],
      }),
    ).toBe('Long Note · E3')
    expect(
      exerciseThreadTitle('Read the Note', { type: EXERCISE_NOTE_READING }),
    ).toBe('Read the Note')
  })
})

describe('exerciseComparisonKey', () => {
  it('keys a thread by the pattern itself, unchanged by the title', () => {
    const five = exerciseComparisonKey({
      type: EXERCISE_SING_IN_TIME,
      pattern: 'level:5',
    })
    expect(five).toBe('exercise:sing-in-time:mp014q:v1')
    expect(
      exerciseComparisonKey({
        type: EXERCISE_SING_IN_TIME,
        pattern: 'level:6',
      }),
    ).not.toBe(five)
    expect(
      exerciseComparisonKey({
        type: EXERCISE_VIBRATO,
        targetNote: 'A3',
        pattern: 'medium',
      }),
    ).toBe('exercise:vibrato:e5fg5:v1')
  })
})
