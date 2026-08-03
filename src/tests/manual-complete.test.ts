// ============================================================
// Ticking a routine segment by hand
// ============================================================
//
// The tick predates segments being real exercises. It used to be the
// only way to record a warm-up that was just a note saying "do lip
// rolls". Now most segments launch a scored drill that records itself,
// so a hand-tick credits the streak, the calendar and the badge engine
// for a run that never happened.
//
// The rule this pins: ask only where there is something to falsify.

import { describe, expect, it } from 'vitest'
import { manualCompletePrompt, segmentSelfReports, } from '@/features/routines/manual-complete'
import type { RoutineSegment } from '@/features/routines/types'

const seg = (over: Partial<RoutineSegment>): RoutineSegment =>
  ({
    type: 'exercise',
    durationSec: 120,
    config: {},
    ...over,
  }) as RoutineSegment

describe('segmentSelfReports', () => {
  it('is true for a segment that launches a scored drill', () => {
    expect(
      segmentSelfReports(seg({ config: { exercise: 'long-note' } as never })),
    ).toBe(true)
  })

  it('is false for a guided warm-up, which carries a pattern and no score', () => {
    // Nothing to falsify, so it keeps its one-click tick — this is the
    // "special case" the manual tick exists for.
    expect(
      segmentSelfReports(
        seg({ type: 'warmup', config: { pattern: 'lip-rolls' } as never }),
      ),
    ).toBe(false)
  })

  it('is false for a segment with no config at all', () => {
    expect(segmentSelfReports(seg({ config: {} }))).toBe(false)
  })

  it('does not throw on a missing segment', () => {
    expect(segmentSelfReports(undefined)).toBe(false)
  })
})

describe('manualCompletePrompt', () => {
  it('names the drill it is about to mark done', () => {
    const { message } = manualCompletePrompt(
      seg({ config: { exercise: 'siren' } as never }),
    )
    expect(message).toContain('siren')
  })

  it('says what the tick actually costs', () => {
    const { message } = manualCompletePrompt(
      seg({ config: { exercise: 'long-note' } as never }),
    )
    // The point of the confirm is that this is not free.
    expect(message).toContain('records no practice')
    expect(message).toContain('streak')
  })

  it('offers the two honest reasons rather than just scolding', () => {
    const { message } = manualCompletePrompt(
      seg({ config: { exercise: 'long-note' } as never }),
    )
    expect(message).toContain('away from the app')
    expect(message).toContain('failed to save')
  })

  it('reads sensibly with no segment', () => {
    expect(manualCompletePrompt(undefined).message).toContain('this drill')
  })
})
