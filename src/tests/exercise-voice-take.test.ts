import { describe, expect, it } from 'vitest'
import { exerciseComparisonKey, exerciseThreadTitle, } from '@/features/exercises/exercise-voice-take'

describe('exercise voice-take context', () => {
  it('keeps equivalent configurations in one comparison thread', () => {
    const first = exerciseComparisonKey({
      type: 'slide',
      targetNotes: ['C4', 'E4'],
      pattern: 'smooth',
    })
    const equivalent = exerciseComparisonKey({
      pattern: 'smooth',
      targetNotes: ['C4', 'E4'],
      type: 'slide',
    })

    expect(equivalent).toBe(first)
    expect(first).toMatch(/^exercise:slide:[a-z0-9]+:v1$/)
  })

  it('separates different targets and exercise variants', () => {
    const baseline = exerciseComparisonKey({
      type: 'vibrato',
      targetNote: 'C4',
      pattern: 'natural',
    })

    expect(
      exerciseComparisonKey({
        type: 'vibrato',
        targetNote: 'D4',
        pattern: 'natural',
      }),
    ).not.toBe(baseline)
    expect(
      exerciseComparisonKey({
        type: 'vibrato',
        targetNote: 'C4',
        pattern: 'wide',
      }),
    ).not.toBe(baseline)
  })

  it('names a thread from its repeatable musical context', () => {
    expect(
      exerciseThreadTitle('Long Note Practice', {
        type: 'long-note',
        targetNote: 'A3',
      }),
    ).toBe('Long Note Practice · A3')
    expect(
      exerciseThreadTitle('Slide Practice', {
        type: 'slide',
        targetNotes: ['C4', 'G4'],
      }),
    ).toBe('Slide Practice · C4 to G4')
  })
})
