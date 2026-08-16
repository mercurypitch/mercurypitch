// The warm-up's approach run, pinned.
//
// The complaint this answers: the scale started the very instant the
// breathing step ended, with ~0.16 s between its notes. Three things fix it
// and each is pinned here — the count-in every authored block always
// carried is finally honored (applyLeadIn), every sung note has a
// breathable rest behind it, and the count-in is audible via a ticker that
// fires each beat exactly once.

import { describe, expect, it } from 'vitest'
import { WARMUP_EXERCISES } from '@/features/exercises/warmup/warmup-exercises'
import { applyLeadIn, createLeadInTicker, leadInSeconds, } from '@/features/exercises/warmup/warmup-lead-in'
import { warmupTotalSeconds } from '@/features/exercises/warmup/warmup-steps'
import { validateZenExercise } from '@/features/zen/validate-exercise'

describe('applyLeadIn', () => {
  it('shifts every target late by the count-in and extends the loop', () => {
    for (const exercise of WARMUP_EXERCISES) {
      const played = applyLeadIn(exercise)
      expect(played.loopBeats).toBe(exercise.loopBeats + exercise.countInBeats)
      played.targets.forEach((target, index) => {
        const authored = exercise.targets[index]!
        expect(target.startBeat).toBeCloseTo(
          authored.startBeat + exercise.countInBeats,
          4,
        )
        expect(target.durationBeats).toBe(authored.durationBeats)
      })
    }
  })

  it('consumes the count-in, so applying twice cannot double it', () => {
    for (const exercise of WARMUP_EXERCISES) {
      const once = applyLeadIn(exercise)
      expect(once.countInBeats).toBe(0)
      expect(applyLeadIn(once)).toBe(once)
    }
  })

  it('passes an exercise with no count-in through untouched', () => {
    const flat = { ...WARMUP_EXERCISES[0]!, countInBeats: 0 }
    expect(applyLeadIn(flat)).toBe(flat)
  })

  // The transformed exercise is what the session actually runs; it has to
  // be as publishable as the authored one or the shift broke an invariant
  // (targets beyond the loop is the one this construction risks).
  it.each(WARMUP_EXERCISES.map((exercise) => [exercise.id, exercise] as const))(
    '%s still passes the publishing validator after the shift',
    (_id, exercise) => {
      expect(validateZenExercise(applyLeadIn(exercise))).toEqual([])
    },
  )

  it('reads the lead-in length in seconds at the authored tempo', () => {
    // Every warm-up block: two beats at 60 BPM — two seconds of approach.
    expect(leadInSeconds(WARMUP_EXERCISES[0]!)).toBe(2)
  })
})

describe('every sung note leaves room to breathe', () => {
  const melodies = WARMUP_EXERCISES.filter(
    (exercise) =>
      exercise.targets.length > 2 &&
      exercise.targets.every((t) => (t.kind ?? 'pitch') === 'pitch'),
  )

  it('separates consecutive notes by at least a quarter beat', () => {
    // The old implicit rest (18% of the slot) came to 0.16 s on the scales
    // — the "near-zero rest" of the original complaint.
    expect(melodies.length).toBeGreaterThan(0)
    for (const exercise of melodies) {
      const targets = [...exercise.targets].sort(
        (a, b) => a.startBeat - b.startBeat,
      )
      for (let i = 1; i < targets.length; i++) {
        const rest =
          targets[i]!.startBeat -
          (targets[i - 1]!.startBeat + targets[i - 1]!.durationBeats)
        expect(rest).toBeGreaterThanOrEqual(0.25 - 1e-3)
      }
    }
  })

  it('gives the nine-note scales a twelve-beat loop', () => {
    // Eight beats put 0.89 s a note; the owner called that step "really
    // difficult". Twelve is a third more room at the same tempo.
    for (const id of ['warmup-scale-low', 'warmup-scale-high']) {
      const scale = WARMUP_EXERCISES.find((e) => e.id === id)!
      expect(scale.loopBeats).toBe(12)
      expect(scale.targets).toHaveLength(9)
    }
  })
})

describe('the total estimate', () => {
  it('treats a step with no lead-in as costing only its loop', () => {
    // WarmupStep leaves leadInSeconds optional for hand-built steps; the
    // estimate must not price an approach run a step does not have.
    const bare = {
      name: 'Hold',
      kind: 'breath' as const,
      instruction: 'Hold.',
      seconds: 10,
    }
    expect(warmupTotalSeconds([bare])).toBe(10)
  })
})

describe('the count-in ticker', () => {
  it('fires each lead-in beat exactly once as the clock crosses it', () => {
    const ticker = createLeadInTicker()
    expect(ticker.sample(0, 2, 1)).toBe(0)
    expect(ticker.sample(0.4, 2, 1)).toBeNull()
    expect(ticker.sample(1.02, 2, 1)).toBe(1)
    expect(ticker.sample(1.6, 2, 1)).toBeNull()
  })

  it('goes quiet once the lead-in is over', () => {
    const ticker = createLeadInTicker()
    expect(ticker.sample(0, 2, 1)).toBe(0)
    expect(ticker.sample(2.0, 2, 1)).toBeNull()
    expect(ticker.sample(3.5, 2, 1)).toBeNull()
  })

  it('does not burst beats a stalled frame jumped over', () => {
    // A click is a pulse the singer breathes to; two landing in one frame
    // are a stumble. Only the newly-current beat fires.
    const ticker = createLeadInTicker()
    expect(ticker.sample(0, 4, 1)).toBe(0)
    expect(ticker.sample(2.9, 4, 1)).toBe(2)
    expect(ticker.sample(3.1, 4, 1)).toBe(3)
  })

  it('ignores a clock that has not started', () => {
    const ticker = createLeadInTicker()
    expect(ticker.sample(-0.1, 2, 1)).toBeNull()
  })

  it('starts over when reset for the next step', () => {
    const ticker = createLeadInTicker()
    expect(ticker.sample(0, 2, 1)).toBe(0)
    ticker.reset()
    expect(ticker.sample(0.1, 2, 1)).toBe(0)
  })
})
