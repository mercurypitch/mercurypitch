// ============================================================
// Daily session generator tests (use-daily-routine buildDailySession)
// ============================================================

import { describe, expect, it } from 'vitest'
import { APPLY_PHRASES, pickApplyPhrase } from '@/data/apply-melodies'
import type { RoutineTemplate } from '@/features/routines/types'
import { buildDailySession, materializeRoutine, } from '@/features/routines/use-daily-routine'

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

  it('never books the warm-up twice', () => {
    // The guided warm-up records a result like any other exercise and scores
    // under the "weak" threshold by nature, so the weakness picker offered it
    // as the review drill — on top of the warm-up segment already at index 0.
    const s = buildDailySession(0, 'warmup')
    expect(s.segments[0].type).toBe('warmup')
    expect(s.segments[1].config.exercise).toBe('long-note')
    expect(
      s.segments.filter((seg) => seg.config.exercise === 'warmup'),
    ).toHaveLength(0)
  })

  it('keeps the warm-up out of a themed grow pool too', () => {
    const s = buildDailySession(0, undefined, { pool: ['warmup', 'slide'] })
    expect(s.segments[2].config.exercise).toBe('slide')
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

  it('draws the grow slot from the guided-path theme pool when given', () => {
    const theme = { pool: ['siren', 'slide'] as const }
    const s = buildDailySession(0, undefined, {
      pool: [...theme.pool],
    })
    expect(theme.pool).toContain(s.segments[2].config.exercise)
  })

  it('theme pool avoids duplicating the review exercise when it can', () => {
    const s = buildDailySession(0, 'siren', { pool: ['siren', 'slide'] })
    expect(s.segments[1].config.exercise).toBe('siren')
    expect(s.segments[2].config.exercise).toBe('slide')
  })

  it("uses the theme's warm-up pattern override", () => {
    const s = buildDailySession(0, undefined, {
      pool: ['siren'],
      warmupPattern: 'lip-trill',
    })
    expect(s.segments[0].config.pattern).toBe('lip-trill')
  })
})

describe('materializeRoutine', () => {
  const withChallenge: RoutineTemplate = {
    id: 'test',
    name: 'Test',
    description: '',
    segments: [
      { type: 'warmup', durationSec: 90, config: { pattern: 'sirens' } },
      { type: 'exercise', durationSec: 180, config: { exercise: 'vibrato' } },
      {
        type: 'challenge-prep',
        durationSec: 120,
        config: { challengeCategory: 'perfect' },
      },
      { type: 'cooldown', durationSec: 60, config: { mode: 'free-sing' } },
    ],
  }

  // The Challenges tab has no idea it is servicing a routine and offers no way
  // back, so a routine containing one was abandoned at that step.
  it('drops the challenge detour at every length', () => {
    for (const length of ['short', 'standard', 'long'] as const) {
      const kinds = materializeRoutine(withChallenge, length).segments.map(
        (s) => s.type,
      )
      expect(kinds).toEqual(['warmup', 'exercise', 'cooldown'])
    }
  })

  it('leaves a standard-length routine otherwise untouched', () => {
    const out = materializeRoutine(withChallenge, 'standard')
    expect(out.segments.map((s) => s.durationSec)).toEqual([90, 180, 60])
    expect(out.name).toBe('Test')
  })

  it('scales durations, with a 30-second floor', () => {
    expect(
      materializeRoutine(withChallenge, 'short').segments.map(
        (s) => s.durationSec,
      ),
    ).toEqual([60, 105, 30])
    expect(
      materializeRoutine(withChallenge, 'long').segments.map(
        (s) => s.durationSec,
      ),
    ).toEqual([120, 255, 90])
  })
})
