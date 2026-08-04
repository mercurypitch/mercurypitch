// ============================================================
// The warm-up, authored
// ============================================================
//
// Two things have to hold for the move to have been safe.
//
// The first is that every authored block is publishable — not merely a
// well-formed object, but something `validate-exercise.ts` would accept from
// an admin. Content that only validates by accident is content that cannot be
// edited later, which was the entire point of moving it.
//
// The second is that the routine cannot tell. Segments key off six pattern
// ids, auto-advance keys off a step count, and the ribbon keys off the
// segment matching its exercise. None of that reads a target, so none of it
// should have noticed — but all of it would break silently rather than
// loudly, so it is pinned here.

import { describe, expect, it } from 'vitest'
import { WARMUP_EXERCISES, WARMUP_PATTERN_EXERCISES, warmupPatternExercises, warmupStepFromExercise, } from '@/features/exercises/warmup/warmup-exercises'
import type { WarmupPattern } from '@/features/exercises/warmup/warmup-steps'
import { buildWarmupSteps, normalizeWarmupPattern, WARMUP_PATTERN_LABELS, warmupTotalSeconds, } from '@/features/exercises/warmup/warmup-steps'
import { validateZenExercise } from '@/features/zen/validate-exercise'

const PATTERNS = Object.keys(WARMUP_PATTERN_LABELS) as WarmupPattern[]

describe('authored warm-up exercises', () => {
  it.each(WARMUP_EXERCISES.map((exercise) => [exercise.id, exercise] as const))(
    '%s passes the publishing validator',
    (_id, exercise) => {
      expect(validateZenExercise(exercise)).toEqual([])
    },
  )

  it('gives every exercise a unique id', () => {
    const ids = WARMUP_EXERCISES.map((exercise) => exercise.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  // A pattern naming an id nothing defines would silently shorten the warm-up
  // rather than fail, because the lookup skips what it cannot find.
  it('resolves every id every pattern names', () => {
    for (const pattern of PATTERNS) {
      expect(warmupPatternExercises(pattern)).toHaveLength(
        WARMUP_PATTERN_EXERCISES[pattern].length,
      )
    }
  })

  it('uses every authored exercise in at least one pattern', () => {
    const used = new Set(Object.values(WARMUP_PATTERN_EXERCISES).flat())
    for (const exercise of WARMUP_EXERCISES) {
      expect(used).toContain(exercise.id)
    }
  })
})

describe('projecting an exercise onto a warm-up step', () => {
  // The siren is the case the naive projection gets wrong: two glides that
  // meet at the top are one turning point in the melody, not two, and a
  // duplicated top note would make the reference playback stutter there.
  it('collapses the turn where one glide ends and the next begins', () => {
    const siren = WARMUP_EXERCISES.find(
      (exercise) => exercise.id === 'warmup-siren-up',
    )!
    expect(warmupStepFromExercise(siren).offsets).toEqual([0, 12, 0])
  })

  it('reads a scale back in the order it is sung', () => {
    const scale = WARMUP_EXERCISES.find(
      (exercise) => exercise.id === 'warmup-scale-low',
    )!
    expect(warmupStepFromExercise(scale).offsets).toEqual([
      0, 2, 4, 5, 7, 5, 4, 2, 0,
    ])
  })

  // Breath and amplitude blocks are invisible to the pitch tracker, so a step
  // built only from them is a timed step — the treatment the hardcoded list
  // always gave the breathing block.
  it('calls a block with nothing to track a breath step', () => {
    const breath = WARMUP_EXERCISES.find(
      (exercise) => exercise.id === 'warmup-breath-cycle',
    )!
    const step = warmupStepFromExercise(breath)

    expect(step.kind).toBe('breath')
    expect(step.offsets).toBeUndefined()
    expect(step.seconds).toBe(16)
  })

  it('reads a step length back in whole seconds', () => {
    for (const exercise of WARMUP_EXERCISES) {
      const step = warmupStepFromExercise(exercise)
      expect(step.seconds).toBe((exercise.loopBeats * 60) / exercise.bpm)
      expect(step.seconds).toBeGreaterThan(0)
    }
  })
})

describe('what the routine can still see', () => {
  it('keeps the six pattern ids stored segments are written with', () => {
    expect(normalizeWarmupPattern('lip-trill')).toBe('lip-trill')
    expect(normalizeWarmupPattern('sirens')).toBe('sirens')
    expect(normalizeWarmupPattern('ascending-scale')).toBe('ascending-scale')
    expect(normalizeWarmupPattern('gentle')).toBe('gentle')
    expect(normalizeWarmupPattern('cooldown')).toBe('cooldown')
    expect(normalizeWarmupPattern(undefined)).toBe('full')
    // Two legacy segment values that still have to land somewhere sensible.
    expect(normalizeWarmupPattern('free-sing')).toBe('cooldown')
    expect(normalizeWarmupPattern('humming')).toBe('cooldown')
  })

  // Auto-advance ticks a warm-up segment off on `stepsCompleted >=
  // totalSteps`. Both numbers come from this list, so what matters is that it
  // is non-empty and finite for every pattern the routine can generate.
  it('builds a runnable step list for every pattern', () => {
    for (const pattern of PATTERNS) {
      const steps = buildWarmupSteps(pattern)
      expect(steps.length).toBeGreaterThan(0)
      for (const step of steps) {
        expect(step.name).not.toBe('')
        expect(step.instruction).not.toBe('')
        expect(step.seconds).toBeGreaterThan(0)
        if (step.kind === 'sing') {
          expect(step.offsets?.length ?? 0).toBeGreaterThan(0)
        }
      }
    }
  })

  // The estimate printed on the idle card and used to size routine segments.
  // Merging the three breathing steps into one cycle moved no time around;
  // these are the durations the patterns had before the move.
  it('keeps every pattern the length it was', () => {
    const minutes = (pattern: WarmupPattern): number =>
      Math.round(warmupTotalSeconds(buildWarmupSteps(pattern)) / 60)

    expect(warmupTotalSeconds(buildWarmupSteps('gentle'))).toBeCloseTo(32.5, 5)
    expect(warmupTotalSeconds(buildWarmupSteps('cooldown'))).toBeCloseTo(
      23.15,
      5,
    )
    expect(minutes('full')).toBe(2)
  })
})
