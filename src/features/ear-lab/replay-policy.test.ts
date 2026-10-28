// Hear it again: once before the answer on a practice question, never
// before the answer on a rated or sealed one, as often as wanted after
// any answer, and never over a sound already playing.

import { describe, expect, it } from 'vitest'
import type { ReplayState } from './replay-policy'
import { canReplay, PRACTICE_REPLAYS_PER_QUESTION } from './replay-policy'

const state = (over: Partial<ReplayState>): ReplayState => ({
  run: 'practice',
  beat: 'answer',
  sounding: false,
  usedThisQuestion: 0,
  ...over,
})

describe('canReplay', () => {
  it('gives a practice question one replay before its answer', () => {
    expect(PRACTICE_REPLAYS_PER_QUESTION).toBe(1)
    expect(canReplay(state({ usedThisQuestion: 0 }))).toBe(true)
    expect(canReplay(state({ usedThisQuestion: 1 }))).toBe(false)
  })

  it('gives a rated question and a sealed one none before the answer', () => {
    expect(canReplay(state({ run: 'rated' }))).toBe(false)
    expect(canReplay(state({ run: 'sealed' }))).toBe(false)
  })

  it('opens every run to replays once answered, however many were used', () => {
    for (const run of ['practice', 'rated', 'sealed'] as const) {
      expect(
        canReplay(state({ run, beat: 'reveal', usedThisQuestion: 5 })),
      ).toBe(true)
    }
  })

  it('never replays over a sound already playing', () => {
    expect(canReplay(state({ sounding: true }))).toBe(false)
    expect(canReplay(state({ beat: 'reveal', sounding: true }))).toBe(false)
  })

  it('has nothing to replay while the question first sounds or before a run', () => {
    expect(canReplay(state({ beat: 'listen' }))).toBe(false)
    expect(canReplay(state({ beat: 'other' }))).toBe(false)
  })
})
