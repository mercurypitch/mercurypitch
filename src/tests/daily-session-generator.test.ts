// ============================================================
// Daily session generator tests (use-daily-routine buildDailySession)
// ============================================================

import { describe, expect, it } from 'vitest'
import { APPLY_PHRASES, pickApplyPhrase } from '@/data/apply-melodies'
import { buildDailySession } from '@/features/routines/use-daily-routine'

describe('pickApplyPhrase', () => {
  it('is deterministic and wraps the pool', () => {
    expect(pickApplyPhrase(0)).toBe(APPLY_PHRASES[0])
    expect(pickApplyPhrase(APPLY_PHRASES.length)).toBe(APPLY_PHRASES[0])
    expect(pickApplyPhrase(1)).toBe(APPLY_PHRASES[1])
  })

  it('handles negative indices without throwing', () => {
    expect(pickApplyPhrase(-1)).toBe(APPLY_PHRASES[APPLY_PHRASES.length - 1])
  })
})

describe('buildDailySession', () => {
  it('produces the warm-up → review → grow → apply shape', () => {
    const s = buildDailySession(0)
    expect(s.segments).toHaveLength(4)
    expect(s.segments.map((seg) => seg.type)).toEqual([
      'warmup',
      'exercise',
      'exercise',
      'exercise',
    ])
  })

  it('is deterministic for the same day index', () => {
    expect(buildDailySession(12)).toEqual(buildDailySession(12))
  })

  it('rotates the warm-up pattern by day', () => {
    const a = buildDailySession(0).segments[0].config.pattern
    const b = buildDailySession(1).segments[0].config.pattern
    expect(a).not.toEqual(b)
  })

  it('reviews the supplied weak exercise, else a safe default', () => {
    expect(buildDailySession(0, 'vibrato').segments[1].config.exercise).toBe(
      'vibrato',
    )
    expect(buildDailySession(0).segments[1].config.exercise).toBe('long-note')
  })

  it('never grows the same skill it is reviewing', () => {
    // day 0 grows GROW_POOL[0] = interval-trainer; force a collision.
    const s = buildDailySession(0, 'interval-trainer')
    expect(s.segments[1].config.exercise).toBe('interval-trainer')
    expect(s.segments[2].config.exercise).not.toBe('interval-trainer')
  })

  it('applies on a real phrase: call-response on even days, sight-singing on odd', () => {
    const even = buildDailySession(0)
    expect(even.segments[3].config.exercise).toBe('call-response')
    expect(even.segments[3].config.notes).toEqual(pickApplyPhrase(0).notes)

    const odd = buildDailySession(1)
    expect(odd.segments[3].config.exercise).toBe('sight-singing')
  })
})
