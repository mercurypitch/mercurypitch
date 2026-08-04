// ============================================================
// Segment labels (routine list naming)
// ============================================================

import { describe, expect, it } from 'vitest'
import { exerciseLabel, segmentVariantLabel, } from '@/features/routines/segment-labels'
import type { RoutineSegment } from '@/features/routines/types'

const seg = (
  type: RoutineSegment['type'],
  config: RoutineSegment['config'] = {},
): RoutineSegment => ({ type, durationSec: 60, config })

describe('exerciseLabel', () => {
  it('title-cases a slug', () => {
    expect(exerciseLabel('long-note')).toBe('Long Note')
    expect(exerciseLabel('warmup')).toBe('Warmup')
  })
})

describe('segmentVariantLabel', () => {
  it('names which warm-up routine a segment runs', () => {
    // Two warm-up segments in one routine used to read as the same row
    // listed twice; the chip is what tells sirens from lip trills.
    expect(segmentVariantLabel(seg('warmup', { pattern: 'sirens' }))).toBe(
      'Sirens',
    )
    expect(segmentVariantLabel(seg('warmup', { pattern: 'lip-trill' }))).toBe(
      'Lip trills',
    )
  })

  it('falls back to the full warm-up when no pattern is set', () => {
    expect(segmentVariantLabel(seg('warmup'))).toBe('Full')
  })

  it('reads a cool-down through `mode`, as the launcher does', () => {
    expect(segmentVariantLabel(seg('cooldown', { mode: 'humming' }))).toBe(
      'Cool-down',
    )
  })

  it('covers a warm-up booked as an exercise segment', () => {
    expect(
      segmentVariantLabel(
        seg('exercise', { exercise: 'warmup', pattern: 'gentle' }),
      ),
    ).toBe('Gentle')
  })

  it('says nothing for exercises that have only one mode', () => {
    expect(
      segmentVariantLabel(seg('exercise', { exercise: 'long-note' })),
    ).toBeUndefined()
  })
})
