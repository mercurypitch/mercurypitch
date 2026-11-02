import { describe, expect, it } from 'vitest'
import type { HarmonyLine } from './harmony-line'
import type { LineOutcome } from './harmony-machine'
import { harmonyReducer, INITIAL_HARMONY_STATE, isRunPhase, isSinging, liveLine, } from './harmony-machine'

const LINE: HarmonyLine = {
  index: 0,
  tonic: 48,
  merc: [55, 57, 59, 57],
  harmony: [59, 60, 62, 60],
  below: false,
}

const outcome = (inHarmony: boolean): LineOutcome => ({
  line: LINE,
  notes: [true, true, inHarmony, true],
  inHarmony,
  firstMiss: inHarmony ? null : 2,
  short: inHarmony ? null : true,
  voiced: true,
  heardAgain: false,
})

const started = (way: 'turns' | 'together') =>
  harmonyReducer(INITIAL_HARMONY_STATE, {
    type: 'start',
    lines: [LINE, { ...LINE, index: 1 }],
    way,
  })

describe("Harmony's machine", () => {
  it('takes turns: the call, the singer alone, then a line in harmony', () => {
    let state = started('turns')
    expect(state).toMatchObject({ phase: 'starting', way: 'turns', run: 1 })
    state = harmonyReducer(state, { type: 'call', index: 0 })
    expect(liveLine(state)).toEqual(LINE)
    state = harmonyReducer(state, { type: 'turn' })
    expect(state.phase).toBe('sing')
    expect(isSinging(state.phase)).toBe(true)
    state = harmonyReducer(state, { type: 'outcome', outcome: outcome(true) })
    expect(state.phase).toBe('landed')
    state = harmonyReducer(state, { type: 'call', index: 1 })
    expect(state).toMatchObject({ phase: 'call', current: 1, replays: 0 })
  })

  it('sings together after the call, and a missed note is the line missed', () => {
    let state = started('together')
    state = harmonyReducer(state, { type: 'call', index: 0 })
    state = harmonyReducer(state, { type: 'turn' })
    expect(state.phase).toBe('together')
    // "Hear Merc again" is the singer's turn alone.
    expect(harmonyReducer(state, { type: 'hearAgain' })).toBe(state)
    state = harmonyReducer(state, { type: 'outcome', outcome: outcome(false) })
    expect(state.phase).toBe('missed')
    expect(state.outcomes).toHaveLength(1)
    state = harmonyReducer(state, { type: 'finish' })
    expect(state.phase).toBe('result')
    expect(isRunPhase(state.phase)).toBe(false)
  })

  it('hears Merc again from the singer turn, counting it', () => {
    let state = started('turns')
    state = harmonyReducer(state, { type: 'call', index: 0 })
    state = harmonyReducer(state, { type: 'turn' })
    state = harmonyReducer(state, { type: 'hearAgain' })
    expect(state).toMatchObject({ phase: 'call', replays: 1 })
  })

  it('takes an outcome only while the singer sings', () => {
    let state = started('turns')
    state = harmonyReducer(state, { type: 'call', index: 0 })
    expect(
      harmonyReducer(state, { type: 'outcome', outcome: outcome(true) }),
    ).toBe(state)
  })

  it('drops a stopped run back to rest, its way kept', () => {
    let state = started('together')
    state = harmonyReducer(state, { type: 'call', index: 0 })
    state = harmonyReducer(state, { type: 'stop' })
    expect(state).toMatchObject({
      phase: 'intro',
      way: 'together',
      outcomes: [],
    })
  })

  it('blocks only the start the mic answered for', () => {
    const state = started('turns')
    const block = 'denied' as const
    expect(
      harmonyReducer(state, { type: 'blocked', run: 0, block }).phase,
    ).toBe('starting')
    expect(
      harmonyReducer(state, { type: 'blocked', run: 1, block }).phase,
    ).toBe('blocked')
  })
})
